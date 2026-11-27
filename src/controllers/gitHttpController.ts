import { Request, Response } from 'express';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { pool } from '../config/db.js';
import { GitService, getGitBinary, resolveRepoDiskPath } from '../services/gitService.js';
import { notifyProjectChatOfPush } from '../services/gitChatNotifier.js';

function packetLine(str: string): string {
  const len = (str.length + 4).toString(16).padStart(4, '0');
  return `${len}${str}`;
}

export async function handleInfoRefs(req: Request, res: Response) {
  try {
    const { owner, repo } = req.params;
    const service = req.query.service as string;

    if (!service || (service !== 'git-upload-pack' && service !== 'git-receive-pack')) {
      return res.status(400).send('Invalid or missing git service');
    }

    const cleanRepo = repo.replace(/\.git$/, '');
    const slug = `${owner}/${cleanRepo}`;

    // Lookup repository in MySQL
    const [rows]: any = await pool.query('SELECT * FROM repositories WHERE slug = ? LIMIT 1', [slug]);
    if (rows.length === 0) {
      return res.status(404).send('Repository not found');
    }

    const repository = rows[0];
    const diskPath = resolveRepoDiskPath(repository.disk_path);

    if (!fs.existsSync(diskPath)) {
      return res.status(404).send('Repository git directory not found on server');
    }

    // Check basic auth for private repos or push operations
    if (repository.visibility === 'private' || service === 'git-receive-pack') {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Basic ')) {
        res.setHeader('WWW-Authenticate', 'Basic realm="DevCollab Git"');
        return res.status(401).send('Authentication required');
      }

      const credentials = Buffer.from(authHeader.split(' ')[1], 'base64').toString('utf8');
      const [username] = credentials.split(':');

      // Verify user has permissions
      const [userRows]: any = await pool.query('SELECT * FROM users WHERE username = ? OR email = ? LIMIT 1', [username, username]);
      if (userRows.length === 0) {
        res.setHeader('WWW-Authenticate', 'Basic realm="DevCollab Git"');
        return res.status(401).send('Invalid credentials');
      }

      const user = userRows[0];
      if (service === 'git-receive-pack') {
        // Must be owner or collaborator
        if (user.id !== repository.owner_id) {
          const [memberRows]: any = await pool.query(
            'SELECT * FROM repository_members WHERE repository_id = ? AND user_id = ? LIMIT 1',
            [repository.id, user.id]
          );
          if (memberRows.length === 0 || !memberRows[0].can_push) {
            return res.status(403).send('Write permission denied for this repository');
          }
        }
      }
    }

    res.setHeader('Content-Type', `application/x-${service}-advertisement`);
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    // Write Smart HTTP protocol packet header: # service=<service>\n + 0000 flush
    res.write(packetLine(`# service=${service}\n`));
    res.write('0000');

    const cmd = service.replace('git-', '');
    const child = spawn('git', [cmd, '--stateless-rpc', '--advertise-refs', diskPath]);

    child.stdout.pipe(res);
    child.stderr.on('data', () => {});
    child.on('error', () => {
      if (!res.headersSent) res.status(500).send('Git server error');
    });
  } catch (err: any) {
    if (!res.headersSent) res.status(500).send(err.message);
  }
}

export async function handleRpc(req: Request, res: Response) {
  try {
    const { owner, repo, service } = req.params;

    if (service !== 'git-upload-pack' && service !== 'git-receive-pack') {
      return res.status(400).send('Unsupported service');
    }

    const cleanRepo = repo.replace(/\.git$/, '');
    const slug = `${owner}/${cleanRepo}`;

    const [rows]: any = await pool.query('SELECT * FROM repositories WHERE slug = ? LIMIT 1', [slug]);
    if (rows.length === 0) {
      return res.status(404).send('Repository not found');
    }

    const repository = rows[0];
    const diskPath = resolveRepoDiskPath(repository.disk_path);

    if (!fs.existsSync(diskPath)) {
      return res.status(404).send('Repository storage not found');
    }

    // Permission checks for push or private repos
    let actingUser: any = null;
    if (repository.visibility === 'private' || service === 'git-receive-pack') {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Basic ')) {
        res.setHeader('WWW-Authenticate', 'Basic realm="DevCollab Git"');
        return res.status(401).send('Authentication required');
      }

      const credentials = Buffer.from(authHeader.split(' ')[1], 'base64').toString('utf8');
      const [username] = credentials.split(':');
      const [userRows]: any = await pool.query('SELECT * FROM users WHERE username = ? OR email = ? LIMIT 1', [username, username]);
      if (userRows.length === 0) {
        res.setHeader('WWW-Authenticate', 'Basic realm="DevCollab Git"');
        return res.status(401).send('Invalid credentials');
      }
      actingUser = userRows[0];

      if (service === 'git-receive-pack') {
        if (actingUser.id !== repository.owner_id) {
          const [memberRows]: any = await pool.query(
            'SELECT * FROM repository_members WHERE repository_id = ? AND user_id = ? LIMIT 1',
            [repository.id, actingUser.id]
          );
          if (memberRows.length === 0 || !memberRows[0].can_push) {
            return res.status(403).send('Write permission denied for this repository');
          }
        }
      }
    }

    res.setHeader('Content-Type', `application/x-${service}-result`);
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

    const cmd = service.replace('git-', '');
    const child = spawn(getGitBinary(), [cmd, '--stateless-rpc', diskPath]);

    req.pipe(child.stdin);
    child.stdout.pipe(res);

    child.on('close', async (code) => {
      // If push succeeded, record activity and auto-post to project chat
      if (code === 0 && service === 'git-receive-pack') {
        try {
          await pool.query(
            'INSERT INTO repository_activities (repository_id, user_id, action_type, details) VALUES (?, ?, ?, ?)',
            [repository.id, actingUser?.id || repository.owner_id, 'push', JSON.stringify({ via: 'git-cli' })]
          );
          await pool.query('UPDATE repositories SET updated_at = CURRENT_TIMESTAMP WHERE id = ?', [repository.id]);

          // Fetch latest commit pushed to provide rich commit info
          const commits = await GitService.getCommitLog(diskPath, 'HEAD', 1);
          const latest = commits[0];
          let details: any = null;
          if (latest) {
            try {
              details = await GitService.getCommitDetails(diskPath, latest.hash);
            } catch {}
          }

          await notifyProjectChatOfPush({
            repositoryId: repository.id,
            projectId: repository.project_id,
            author: {
              id: actingUser?.id || repository.owner_id,
              name: actingUser?.name || latest?.authorName || 'Git Collaborator',
              avatar: actingUser?.avatar || undefined,
              role: actingUser?.role || 'Contributor'
            },
            branch: repository.default_branch || 'main',
            commitHash: latest?.hash || 'HEAD',
            commitMessage: latest?.message || 'Pushed new code updates via Git CLI',
            filesChanged: details?.files?.map((f: any) => f.path) || [],
            additions: details?.stats?.additions || 0,
            deletions: details?.stats?.deletions || 0,
            diffSnippet: details?.diff || undefined,
            source: 'git-cli'
          });
        } catch (err) {
          console.error('[gitHttpController] Error recording push activity or notifying chat:', err);
        }
      }
    });

    child.on('error', () => {
      if (!res.headersSent) res.status(500).send('Git execution error');
    });
  } catch (err: any) {
    if (!res.headersSent) res.status(500).send(err.message);
  }
}
