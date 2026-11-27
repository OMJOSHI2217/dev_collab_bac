import { Request, Response } from 'express';
import path from 'path';
import { pool } from '../config/db.js';
import { GitService, resolveRepoDiskPath } from '../services/gitService.js';
import { notifyProjectChatOfPush } from '../services/gitChatNotifier.js';

async function getRepoDiskPath(slug: string): Promise<{ id: string; diskPath: string; defaultBranch: string; ownerId: string; projectId?: string } | null> {
  const [rows]: any = await pool.query('SELECT * FROM repositories WHERE slug = ? LIMIT 1', [slug]);
  if (rows.length === 0) return null;
  return {
    id: rows[0].id,
    diskPath: resolveRepoDiskPath(rows[0].disk_path),
    defaultBranch: rows[0].default_branch,
    ownerId: rows[0].owner_id,
    projectId: rows[0].project_id
  };
}

export async function getTree(req: Request, res: Response) {
  try {
    const { owner, repo } = req.params;
    const cleanRepo = repo.replace(/\.git$/, '');
    const slug = `${owner}/${cleanRepo}`;

    const info = await getRepoDiskPath(slug);
    if (!info) return res.status(404).json({ error: 'Repository not found' });

    const branch = (req.query.branch as string) || info.defaultBranch || 'main';
    const subPath = (req.query.path as string) || '';

    const items = await GitService.getTree(info.diskPath, branch, subPath);
    res.json({
      branch,
      path: subPath,
      items
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function getFile(req: Request, res: Response) {
  try {
    const { owner, repo } = req.params;
    const cleanRepo = repo.replace(/\.git$/, '');
    const slug = `${owner}/${cleanRepo}`;

    const info = await getRepoDiskPath(slug);
    if (!info) return res.status(404).json({ error: 'Repository not found' });

    const branch = (req.query.branch as string) || info.defaultBranch || 'main';
    const filePath = req.query.path as string;

    if (!filePath) {
      return res.status(400).json({ error: 'File path parameter "path" is required' });
    }

    const file = await GitService.getFileContent(info.diskPath, branch, filePath);
    res.json({
      branch,
      path: filePath,
      ...file
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function getReadme(req: Request, res: Response) {
  try {
    const { owner, repo } = req.params;
    const cleanRepo = repo.replace(/\.git$/, '');
    const slug = `${owner}/${cleanRepo}`;

    const info = await getRepoDiskPath(slug);
    if (!info) return res.status(404).json({ error: 'Repository not found' });

    const branch = (req.query.branch as string) || info.defaultBranch || 'main';
    const readme = await GitService.getReadme(info.diskPath, branch);

    res.json({ readme });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function getBranches(req: Request, res: Response) {
  try {
    const { owner, repo } = req.params;
    const cleanRepo = repo.replace(/\.git$/, '');
    const slug = `${owner}/${cleanRepo}`;

    const info = await getRepoDiskPath(slug);
    if (!info) return res.status(404).json({ error: 'Repository not found' });

    const branches = await GitService.listBranches(info.diskPath);
    res.json({ branches, defaultBranch: info.defaultBranch });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function createBranch(req: Request, res: Response) {
  try {
    const { owner, repo } = req.params;
    const { newBranch, baseBranch = 'main', userId } = req.body;

    if (!newBranch) {
      return res.status(400).json({ error: 'newBranch name is required' });
    }

    const cleanRepo = repo.replace(/\.git$/, '');
    const slug = `${owner}/${cleanRepo}`;

    const info = await getRepoDiskPath(slug);
    if (!info) return res.status(404).json({ error: 'Repository not found' });

    await GitService.createBranch(info.diskPath, newBranch, baseBranch);

    // Save in database
    await pool.query(`
      INSERT INTO repository_branches (repository_id, name, is_protected, is_default, created_by)
      VALUES (?, ?, false, false, ?)
    `, [info.id, newBranch, userId || null]);

    // Record activity
    await pool.query(`
      INSERT INTO repository_activities (repository_id, user_id, action_type, details)
      VALUES (?, ?, 'branch_created', ?)
    `, [info.id, userId || info.ownerId, JSON.stringify({ branch: newBranch, baseBranch })]);

    res.status(201).json({ success: true, branch: newBranch });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function deleteBranch(req: Request, res: Response) {
  try {
    const { owner, repo, branch } = req.params;
    const { userId } = req.body;

    const cleanRepo = repo.replace(/\.git$/, '');
    const slug = `${owner}/${cleanRepo}`;

    const info = await getRepoDiskPath(slug);
    if (!info) return res.status(404).json({ error: 'Repository not found' });

    if (branch === info.defaultBranch) {
      return res.status(400).json({ error: `Cannot delete default branch "${info.defaultBranch}"` });
    }

    await GitService.deleteBranch(info.diskPath, branch);
    await pool.query('DELETE FROM repository_branches WHERE repository_id = ? AND name = ?', [info.id, branch]);

    await pool.query(`
      INSERT INTO repository_activities (repository_id, user_id, action_type, details)
      VALUES (?, ?, 'branch_deleted', ?)
    `, [info.id, userId || info.ownerId, JSON.stringify({ branch })]);

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function getCommits(req: Request, res: Response) {
  try {
    const { owner, repo } = req.params;
    const cleanRepo = repo.replace(/\.git$/, '');
    const slug = `${owner}/${cleanRepo}`;

    const info = await getRepoDiskPath(slug);
    if (!info) return res.status(404).json({ error: 'Repository not found' });

    const branch = (req.query.branch as string) || info.defaultBranch || 'main';
    const limit = parseInt(req.query.limit as string, 10) || 50;

    const commits = await GitService.getCommitLog(info.diskPath, branch, limit);
    res.json({ commits, branch });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function getCommitDetails(req: Request, res: Response) {
  try {
    const { owner, repo, hash } = req.params;
    const cleanRepo = repo.replace(/\.git$/, '');
    const slug = `${owner}/${cleanRepo}`;

    const info = await getRepoDiskPath(slug);
    if (!info) return res.status(404).json({ error: 'Repository not found' });

    const details = await GitService.getCommitDetails(info.diskPath, hash);
    res.json(details);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function createWebCommit(req: Request, res: Response) {
  try {
    const { owner, repo } = req.params;
    const { 
      branch = 'main', 
      message, 
      actions, 
      userId,
      newBranch 
    } = req.body;

    if (!message || !Array.isArray(actions) || actions.length === 0) {
      return res.status(400).json({ error: 'Commit message and at least one file action are required' });
    }

    const cleanRepo = repo.replace(/\.git$/, '');
    const slug = `${owner}/${cleanRepo}`;

    const info = await getRepoDiskPath(slug);
    if (!info) return res.status(404).json({ error: 'Repository not found' });

    // Lookup user author info
    let author = { name: 'DevCollab Developer', email: 'dev@devcollab.io' };
    if (userId) {
      const [uRows]: any = await pool.query('SELECT name, email FROM users WHERE id = ? LIMIT 1', [userId]);
      if (uRows.length > 0) {
        author = { name: uRows[0].name, email: uRows[0].email };
      }
    }

    const targetBranch = newBranch || branch;
    if (newBranch && newBranch !== branch) {
      await GitService.createBranch(info.diskPath, newBranch, branch);
      await pool.query(`
        INSERT INTO repository_branches (repository_id, name, is_protected, is_default, created_by)
        VALUES (?, ?, false, false, ?)
      `, [info.id, newBranch, userId || null]);
    }

    const commitHash = await GitService.createWebCommit(
      info.diskPath,
      author,
      targetBranch,
      message,
      actions
    );

    // Record activity
    await pool.query(`
      INSERT INTO repository_activities (repository_id, user_id, action_type, details)
      VALUES (?, ?, 'push', ?)
    `, [info.id, userId || info.ownerId, JSON.stringify({ commit: commitHash, branch: targetBranch, message })]);

    await pool.query('UPDATE repositories SET updated_at = CURRENT_TIMESTAMP WHERE id = ?', [info.id]);

    // Automatically post Git Push notification directly into project chat
    try {
      let authorUser: any = null;
      if (userId) {
        const [uRows]: any = await pool.query('SELECT id, name, avatar, role FROM users WHERE id = ? LIMIT 1', [userId]);
        if (uRows.length > 0) authorUser = uRows[0];
      }

      await notifyProjectChatOfPush({
        repositoryId: info.id,
        projectId: info.projectId,
        author: {
          id: authorUser?.id || userId || info.ownerId,
          name: authorUser?.name || author.name,
          avatar: authorUser?.avatar,
          role: authorUser?.role || 'Contributor'
        },
        branch: targetBranch,
        commitHash,
        commitMessage: message,
        filesChanged: actions.map((a: any) => a.path),
        source: 'web-editor'
      });
    } catch (err) {
      console.error('[gitOperationsController] Failed to auto-post web commit message:', err);
    }

    res.status(201).json({
      success: true,
      commitHash,
      branch: targetBranch
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}
