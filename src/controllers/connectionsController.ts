import { Request, Response } from 'express';
import { pool } from '../config/db.js';

export async function getRequests(req: Request, res: Response) {
  try {
    const { userId } = req.query;
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const [requests]: any = await pool.query(
      `SELECT r.*, 
              fu.name as from_name, fu.username as from_username, fu.email as from_email, 
              fu.avatar as from_avatar, fu.role as from_role, fu.experience_level as from_exp, 
              fu.city as from_city, fu.country as from_country, fu.bio as from_bio,
              tu.name as to_name, tu.username as to_username, tu.email as to_email, 
              tu.avatar as to_avatar, tu.role as to_role, tu.experience_level as to_exp, 
              tu.city as to_city, tu.country as to_country, tu.bio as to_bio
       FROM connection_requests r
       LEFT JOIN users fu ON r.from_user_id = fu.id
       LEFT JOIN users tu ON r.to_user_id = tu.id
       WHERE r.from_user_id = ? OR r.to_user_id = ?
       ORDER BY r.created_at DESC`,
      [userId, userId]
    );

    // Collect all unique user IDs to fetch skills
    const userIds = new Set<string>();
    requests.forEach((r: any) => {
      if (r.from_user_id) userIds.add(r.from_user_id);
      if (r.to_user_id) userIds.add(r.to_user_id);
    });

    let skillsMap: Record<string, string[]> = {};
    if (userIds.size > 0) {
      const [skills]: any = await pool.query(
        'SELECT user_id, skill_name FROM user_skills WHERE user_id IN (?)',
        [Array.from(userIds)]
      );
      skills.forEach((s: any) => {
        if (!skillsMap[s.user_id]) skillsMap[s.user_id] = [];
        skillsMap[s.user_id].push(s.skill_name);
      });
    }

    const formatted = requests.map((r: any) => ({
      id: r.id,
      fromUserId: r.from_user_id,
      toUserId: r.to_user_id,
      fromUser: {
        id: r.from_user_id,
        name: r.from_name || 'Developer',
        username: r.from_username || 'dev',
        email: r.from_email || '',
        avatar: r.from_avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=250',
        role: r.from_role || 'Developer',
        experienceLevel: r.from_exp || 'Mid-Level',
        city: r.from_city || '',
        country: r.from_country || '',
        bio: r.from_bio || '',
        skills: skillsMap[r.from_user_id] || ['TypeScript', 'React']
      },
      toUser: {
        id: r.to_user_id,
        name: r.to_name || 'Developer',
        username: r.to_username || 'dev',
        email: r.to_email || '',
        avatar: r.to_avatar || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=250',
        role: r.to_role || 'Developer',
        experienceLevel: r.to_exp || 'Mid-Level',
        city: r.to_city || '',
        country: r.to_country || '',
        bio: r.to_bio || '',
        skills: skillsMap[r.to_user_id] || ['Node.js', 'Go']
      },
      status: r.status,
      message: r.message,
      projectInterest: r.project_interest,
      createdAt: r.created_at ? new Date(r.created_at).toLocaleDateString() : 'Recently'
    }));

    res.json({ requests: formatted });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function sendRequest(req: Request, res: Response) {
  try {
    const { fromUserId, toUserId, message, projectInterest } = req.body;
    const id = `req_${Date.now()}`;

    // Clear any previous declined requests between these users so they can reconnect cleanly
    await pool.query(
      `DELETE FROM connection_requests 
       WHERE ((from_user_id = ? AND to_user_id = ?) OR (from_user_id = ? AND to_user_id = ?))
         AND status = 'declined'`,
      [fromUserId, toUserId, toUserId, fromUserId]
    );

    await pool.query(
      `INSERT INTO connection_requests (id, from_user_id, to_user_id, status, message, project_interest)
       VALUES (?, ?, ?, 'pending', ?, ?)`,
      [id, fromUserId, toUserId, message || '', projectInterest || null]
    );

    res.status(201).json({ id, status: 'pending' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function updateRequestStatus(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['accepted', 'declined'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    await pool.query('UPDATE connection_requests SET status = ? WHERE id = ?', [status, id]);
    res.json({ success: true, id, status });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}
