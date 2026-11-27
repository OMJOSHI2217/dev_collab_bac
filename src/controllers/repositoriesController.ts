import { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { pool } from '../config/db.js';
import { GitService } from '../services/gitService.js';

export async function getRepositories(req: Request, res: Response) {
  try {
    const { search, projectId, userId } = req.query;

    let query = `
      SELECT r.*, u.name as owner_name, u.username as owner_username, u.avatar as owner_avatar,
             p.title as project_title
      FROM repositories r
      JOIN users u ON r.owner_id = u.id
      LEFT JOIN projects p ON r.project_id = p.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (projectId) {
      query += ' AND r.project_id = ?';
      params.push(projectId);
    }

    if (userId) {
      // User can see public repos + private repos they own or are members of
      query += ` AND (
        r.visibility = 'public' 
        OR r.owner_id = ? 
        OR r.id IN (SELECT repository_id FROM repository_members WHERE user_id = ?)
      )`;
      params.push(userId, userId);
    } else {
      query += ` AND r.visibility = 'public'`;
    }

    if (search) {
      query += ' AND (r.name LIKE ? OR r.description LIKE ? OR u.name LIKE ?)';
      const s = `%${search}%`;
      params.push(s, s, s);
    }

    query += ' ORDER BY r.updated_at DESC';

    const [repos]: any = await pool.query(query, params);
    res.json({ repositories: repos });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function getRepositoryBySlug(req: Request, res: Response) {
  try {
    const { owner, repo } = req.params;
    const cleanRepo = repo.replace(/\.git$/, '');
    const slug = `${owner}/${cleanRepo}`;

    const [rows]: any = await pool.query(`
      SELECT r.*, u.name as owner_name, u.username as owner_username, u.avatar as owner_avatar,
             p.title as project_title
      FROM repositories r
      JOIN users u ON r.owner_id = u.id
      LEFT JOIN projects p ON r.project_id = p.id
      WHERE r.slug = ?
      LIMIT 1
    `, [slug]);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Repository not found' });
    }

    const repository = rows[0];

    // Count open PRs & Issues
    const [prCount]: any = await pool.query('SELECT count(*) as count FROM pull_requests WHERE repository_id = ? AND status = "open"', [repository.id]);
    const [issueCount]: any = await pool.query('SELECT count(*) as count FROM issues WHERE repository_id = ? AND status = "open"', [repository.id]);
    repository.open_prs_count = prCount[0].count;
    repository.open_issues_count = issueCount[0].count;

    // Fetch branches
    const branches = await GitService.listBranches(repository.disk_path);

    // Fetch README preview if available
    const readme = await GitService.getReadme(repository.disk_path, repository.default_branch);

    // Fetch collaborators
    const [members]: any = await pool.query(`
      SELECT rm.*, u.name, u.username, u.avatar, u.role as dev_role
      FROM repository_members rm
      JOIN users u ON rm.user_id = u.id
      WHERE rm.repository_id = ?
    `, [repository.id]);

    res.json({
      repository,
      branches,
      readme,
      collaborators: members
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function createRepository(req: Request, res: Response) {
  try {
    const { 
      name, 
      description, 
      visibility = 'public', 
      defaultBranch = 'main',
      projectId, 
      ownerId,
      template = 'default'
    } = req.body;

    if (!name || !ownerId) {
      return res.status(400).json({ error: 'Repository name and ownerId are required' });
    }

    // Lookup owner
    const [ownerRows]: any = await pool.query('SELECT * FROM users WHERE id = ? LIMIT 1', [ownerId]);
    if (ownerRows.length === 0) {
      return res.status(404).json({ error: 'Owner user not found' });
    }
    const owner = ownerRows[0];

    const cleanName = name.trim().toLowerCase().replace(/[^a-z0-9-_]/g, '-');
    const slug = `${owner.username}/${cleanName}`;

    // Check if slug exists
    const [existing]: any = await pool.query('SELECT id FROM repositories WHERE slug = ? LIMIT 1', [slug]);
    if (existing.length > 0) {
      return res.status(409).json({ error: `Repository "${slug}" already exists.` });
    }

    const repoId = `repo_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const diskPath = path.join('git-repositories', owner.username, `${cleanName}.git`);

    // 1. Initialize real Git bare repository on server
    await GitService.initBareRepo(diskPath, defaultBranch);

    // 2. Seed initial files (README.md, .gitignore)
    const initialFiles = [
      {
        path: 'README.md',
        content: `# ${name}\n\n${description || 'A collaborative engineering project on DevCollab.'}\n\n## Getting Started\n\n\`\`\`bash\ngit clone http://localhost:5000/git/${slug}.git\ncd ${cleanName}\n\`\`\`\n\n## Collaboration\n\nBuilt with [DevCollab](http://localhost:5173). Push code, create branches, and open Pull Requests directly from VS Code, the terminal, or our web interface.\n`
      },
      {
        path: '.gitignore',
        content: `node_modules/\ndist/\n.env\n*.log\n.DS_Store\ncoverage/\n`
      }
    ];

    await GitService.seedInitialCommit(
      diskPath,
      { name: owner.name, email: owner.email },
      initialFiles,
      defaultBranch,
      'Initial commit with project setup'
    );

    // 3. Save repository record to MySQL
    await pool.query(`
      INSERT INTO repositories (
        id, project_id, name, slug, description, owner_id, 
        visibility, default_branch, disk_path
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      repoId, projectId || null, cleanName, slug, description || '', 
      ownerId, visibility, defaultBranch, diskPath
    ]);

    // 4. Add owner to repository_members
    await pool.query(`
      INSERT INTO repository_members (repository_id, user_id, role, can_push, can_merge)
      VALUES (?, ?, 'owner', true, true)
    `, [repoId, ownerId]);

    // 5. Add default branch to repository_branches
    await pool.query(`
      INSERT INTO repository_branches (repository_id, name, is_protected, is_default, created_by)
      VALUES (?, ?, true, true, ?)
    `, [repoId, defaultBranch, ownerId]);

    // 6. Record activity
    await pool.query(`
      INSERT INTO repository_activities (repository_id, user_id, action_type, details)
      VALUES (?, ?, 'branch_created', ?)
    `, [repoId, ownerId, JSON.stringify({ branch: defaultBranch, initial: true })]);

    // 7. Seed default issue labels
    const defaultLabels = [
      { name: 'bug', color: '#ef4444', description: 'Something is not working' },
      { name: 'enhancement', color: '#3b82f6', description: 'New feature or improvement' },
      { name: 'documentation', color: '#10b981', description: 'Improvements or additions to documentation' },
      { name: 'good first issue', color: '#8b5cf6', description: 'Good for newcomers' },
      { name: 'help wanted', color: '#f59e0b', description: 'Extra attention is needed' }
    ];

    for (const label of defaultLabels) {
      await pool.query(`
        INSERT INTO issue_labels (repository_id, name, color, description)
        VALUES (?, ?, ?, ?)
      `, [repoId, label.name, label.color, label.description]);
    }

    const [created]: any = await pool.query('SELECT * FROM repositories WHERE id = ?', [repoId]);
    res.status(201).json({ repository: created[0] });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function updateRepository(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { description, visibility, defaultBranch } = req.body;

    const fields: string[] = [];
    const values: any[] = [];

    if (description !== undefined) {
      fields.push('description = ?');
      values.push(description);
    }
    if (visibility) {
      fields.push('visibility = ?');
      values.push(visibility);
    }
    if (defaultBranch) {
      fields.push('default_branch = ?');
      values.push(defaultBranch);
    }

    if (fields.length > 0) {
      values.push(id);
      await pool.query(`UPDATE repositories SET ${fields.join(', ')} WHERE id = ?`, values);
    }

    const [updated]: any = await pool.query('SELECT * FROM repositories WHERE id = ?', [id]);
    res.json({ repository: updated[0] });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function addCollaborator(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { userId, role = 'collaborator' } = req.body;

    const canPush = role === 'owner' || role === 'collaborator';
    const canMerge = role === 'owner' || role === 'collaborator';

    await pool.query(`
      INSERT INTO repository_members (repository_id, user_id, role, can_push, can_merge)
      VALUES (?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE role=VALUES(role), can_push=VALUES(can_push), can_merge=VALUES(can_merge)
    `, [id, userId, role, canPush, canMerge]);

    await pool.query(`
      INSERT INTO repository_activities (repository_id, user_id, action_type, details)
      VALUES (?, ?, 'member_added', ?)
    `, [id, userId, JSON.stringify({ role })]);

    res.json({ success: true, message: 'Collaborator added successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function removeCollaborator(req: Request, res: Response) {
  try {
    const { id, userId } = req.params;
    await pool.query('DELETE FROM repository_members WHERE repository_id = ? AND user_id = ?', [id, userId]);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}
