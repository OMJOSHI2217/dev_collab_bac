import { Request, Response } from 'express';
import { pool } from '../config/db.js';

export async function getRepositoryActivities(req: Request, res: Response) {
  try {
    const { owner, repo } = req.params;
    const cleanRepo = repo.replace(/\.git$/, '');
    const slug = `${owner}/${cleanRepo}`;

    const [repoRows]: any = await pool.query('SELECT id FROM repositories WHERE slug = ? LIMIT 1', [slug]);
    if (repoRows.length === 0) return res.status(404).json({ error: 'Repository not found' });

    const [activities]: any = await pool.query(`
      SELECT ra.*, u.name as user_name, u.username as user_username, u.avatar as user_avatar
      FROM repository_activities ra
      JOIN users u ON ra.user_id = u.id
      WHERE ra.repository_id = ?
      ORDER BY ra.created_at DESC
      LIMIT 50
    `, [repoRows[0].id]);

    res.json({ activities });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}
