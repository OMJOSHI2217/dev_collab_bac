import { Request, Response } from 'express';
import { pool } from '../config/db.js';

export async function getIssues(req: Request, res: Response) {
  try {
    const { owner, repo } = req.params;
    const { status = 'all', priority } = req.query;
    const cleanRepo = repo.replace(/\.git$/, '');
    const slug = `${owner}/${cleanRepo}`;

    const [repoRows]: any = await pool.query('SELECT id FROM repositories WHERE slug = ? LIMIT 1', [slug]);
    if (repoRows.length === 0) return res.status(404).json({ error: 'Repository not found' });
    const repoId = repoRows[0].id;

    let query = `
      SELECT i.*, 
             u.name as author_name, u.username as author_username, u.avatar as author_avatar,
             a.name as assignee_name, a.username as assignee_username, a.avatar as assignee_avatar,
             (SELECT count(*) FROM issue_comments WHERE issue_id = i.id) as comments_count
      FROM issues i
      JOIN users u ON i.author_id = u.id
      LEFT JOIN users a ON i.assignee_id = a.id
      WHERE i.repository_id = ?
    `;
    const params: any[] = [repoId];

    if (status !== 'all') {
      query += ' AND i.status = ?';
      params.push(status);
    }

    if (priority) {
      query += ' AND i.priority = ?';
      params.push(priority);
    }

    query += ' ORDER BY i.created_at DESC';

    const [issues]: any = await pool.query(query, params);

    // Fetch labels for each issue
    const issueIds = issues.map((iss: any) => iss.id);
    if (issueIds.length > 0) {
      const [labelRows]: any = await pool.query(`
        SELECT ilm.issue_id, l.*
        FROM issue_label_mappings ilm
        JOIN issue_labels l ON ilm.label_id = l.id
        WHERE ilm.issue_id IN (?)
      `, [issueIds]);

      const labelMap: Record<string, any[]> = {};
      labelRows.forEach((row: any) => {
        if (!labelMap[row.issue_id]) labelMap[row.issue_id] = [];
        labelMap[row.issue_id].push(row);
      });

      issues.forEach((iss: any) => {
        iss.labels = labelMap[iss.id] || [];
      });
    }

    res.json({ issues });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function getIssueByNumber(req: Request, res: Response) {
  try {
    const { owner, repo, number } = req.params;
    const cleanRepo = repo.replace(/\.git$/, '');
    const slug = `${owner}/${cleanRepo}`;

    const [repoRows]: any = await pool.query('SELECT id FROM repositories WHERE slug = ? LIMIT 1', [slug]);
    if (repoRows.length === 0) return res.status(404).json({ error: 'Repository not found' });
    const repoId = repoRows[0].id;

    const [rows]: any = await pool.query(`
      SELECT i.*, 
             u.name as author_name, u.username as author_username, u.avatar as author_avatar,
             a.name as assignee_name, a.username as assignee_username, a.avatar as assignee_avatar
      FROM issues i
      JOIN users u ON i.author_id = u.id
      LEFT JOIN users a ON i.assignee_id = a.id
      WHERE i.repository_id = ? AND i.number = ?
      LIMIT 1
    `, [repoId, number]);

    if (rows.length === 0) return res.status(404).json({ error: 'Issue not found' });
    const issue = rows[0];

    // Fetch comments
    const [comments]: any = await pool.query(`
      SELECT ic.*, u.name as user_name, u.username as user_username, u.avatar as user_avatar
      FROM issue_comments ic
      JOIN users u ON ic.user_id = u.id
      WHERE ic.issue_id = ?
      ORDER BY ic.created_at ASC
    `, [issue.id]);

    // Fetch labels
    const [labels]: any = await pool.query(`
      SELECT l.*
      FROM issue_label_mappings ilm
      JOIN issue_labels l ON ilm.label_id = l.id
      WHERE ilm.issue_id = ?
    `, [issue.id]);

    issue.labels = labels;

    res.json({
      issue,
      comments
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function createIssue(req: Request, res: Response) {
  try {
    const { owner, repo } = req.params;
    const { title, description, authorId, assigneeId, priority = 'medium', labelIds } = req.body;

    if (!title || !authorId) {
      return res.status(400).json({ error: 'title and authorId are required' });
    }

    const cleanRepo = repo.replace(/\.git$/, '');
    const slug = `${owner}/${cleanRepo}`;

    const [repoRows]: any = await pool.query('SELECT id FROM repositories WHERE slug = ? LIMIT 1', [slug]);
    if (repoRows.length === 0) return res.status(404).json({ error: 'Repository not found' });
    const repoId = repoRows[0].id;

    // Get next issue number
    const [numRows]: any = await pool.query(
      'SELECT coalesce(max(number), 0) + 1 as nextNum FROM issues WHERE repository_id = ?',
      [repoId]
    );
    const issueNumber = numRows[0].nextNum;
    const issueId = `issue_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    await pool.query(`
      INSERT INTO issues (
        id, repository_id, number, title, description, 
        author_id, assignee_id, status, priority
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'open', ?)
    `, [
      issueId, repoId, issueNumber, title, description || '', 
      authorId, assigneeId || null, priority
    ]);

    // Link labels if provided
    if (Array.isArray(labelIds) && labelIds.length > 0) {
      for (const lid of labelIds) {
        await pool.query('INSERT IGNORE INTO issue_label_mappings (issue_id, label_id) VALUES (?, ?)', [issueId, lid]);
      }
    }

    await pool.query(`
      INSERT INTO repository_activities (repository_id, user_id, action_type, details)
      VALUES (?, ?, 'issue_opened', ?)
    `, [repoId, authorId, JSON.stringify({ number: issueNumber, title })]);

    await pool.query('UPDATE repositories SET open_issues_count = open_issues_count + 1 WHERE id = ?', [repoId]);

    const [created]: any = await pool.query('SELECT * FROM issues WHERE id = ?', [issueId]);
    res.status(201).json({ issue: created[0] });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function updateIssue(req: Request, res: Response) {
  try {
    const { owner, repo, number } = req.params;
    const { status, title, description, priority, assigneeId, userId } = req.body;

    const cleanRepo = repo.replace(/\.git$/, '');
    const slug = `${owner}/${cleanRepo}`;

    const [repoRows]: any = await pool.query('SELECT id FROM repositories WHERE slug = ? LIMIT 1', [slug]);
    if (repoRows.length === 0) return res.status(404).json({ error: 'Repository not found' });
    const repoId = repoRows[0].id;

    const fields: string[] = [];
    const values: any[] = [];

    if (title) { fields.push('title = ?'); values.push(title); }
    if (description !== undefined) { fields.push('description = ?'); values.push(description); }
    if (priority) { fields.push('priority = ?'); values.push(priority); }
    if (assigneeId !== undefined) { fields.push('assignee_id = ?'); values.push(assigneeId || null); }
    if (status) {
      fields.push('status = ?');
      values.push(status);
      if (status === 'closed') {
        fields.push('closed_at = CURRENT_TIMESTAMP');
      } else {
        fields.push('closed_at = NULL');
      }
    }

    if (fields.length > 0) {
      values.push(repoId, number);
      await pool.query(`UPDATE issues SET ${fields.join(', ')} WHERE repository_id = ? AND number = ?`, values);
    }

    if (status) {
      const actType = status === 'closed' ? 'issue_closed' : 'issue_opened';
      await pool.query(`
        INSERT INTO repository_activities (repository_id, user_id, action_type, details)
        VALUES (?, ?, ?, ?)
      `, [repoId, userId || null, actType, JSON.stringify({ number })]);

      if (status === 'closed') {
        await pool.query('UPDATE repositories SET open_issues_count = GREATEST(0, open_issues_count - 1) WHERE id = ?', [repoId]);
      } else {
        await pool.query('UPDATE repositories SET open_issues_count = open_issues_count + 1 WHERE id = ?', [repoId]);
      }
    }

    const [updated]: any = await pool.query('SELECT * FROM issues WHERE repository_id = ? AND number = ?', [repoId, number]);
    res.json({ issue: updated[0] });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function addIssueComment(req: Request, res: Response) {
  try {
    const { owner, repo, number } = req.params;
    const { userId, body } = req.body;

    if (!userId || !body) return res.status(400).json({ error: 'userId and body are required' });

    const cleanRepo = repo.replace(/\.git$/, '');
    const slug = `${owner}/${cleanRepo}`;

    const [repoRows]: any = await pool.query('SELECT id FROM repositories WHERE slug = ? LIMIT 1', [slug]);
    if (repoRows.length === 0) return res.status(404).json({ error: 'Repository not found' });
    const repoId = repoRows[0].id;

    const [issRows]: any = await pool.query('SELECT id FROM issues WHERE repository_id = ? AND number = ? LIMIT 1', [repoId, number]);
    if (issRows.length === 0) return res.status(404).json({ error: 'Issue not found' });

    const commentId = `ic_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    await pool.query(`
      INSERT INTO issue_comments (id, issue_id, user_id, body)
      VALUES (?, ?, ?, ?)
    `, [commentId, issRows[0].id, userId, body]);

    res.status(201).json({ success: true, commentId });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function getRepositoryLabels(req: Request, res: Response) {
  try {
    const { owner, repo } = req.params;
    const cleanRepo = repo.replace(/\.git$/, '');
    const slug = `${owner}/${cleanRepo}`;

    const [repoRows]: any = await pool.query('SELECT id FROM repositories WHERE slug = ? LIMIT 1', [slug]);
    if (repoRows.length === 0) return res.status(404).json({ error: 'Repository not found' });

    const [labels]: any = await pool.query('SELECT * FROM issue_labels WHERE repository_id = ? ORDER BY name ASC', [repoRows[0].id]);
    res.json({ labels });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}
