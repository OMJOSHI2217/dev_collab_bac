import { Request, Response } from 'express';
import { pool } from '../config/db.js';

export async function getProjects(req: Request, res: Response) {
  try {
    const [projects]: any = await pool.query(`
      SELECT p.*, u.name as owner_name, u.avatar as owner_avatar, u.role as owner_role
      FROM projects p
      JOIN users u ON p.owner_id = u.id
      ORDER BY p.created_at DESC
    `);

    // Fetch contributors for all projects
    const projIds = projects.map((p: any) => p.id);
    let contributorsMap: Record<string, any[]> = {};

    if (projIds.length > 0) {
      const [contributors]: any = await pool.query(`
        SELECT pc.*, u.name, u.username, u.avatar, u.role as user_default_role
        FROM project_contributors pc
        JOIN users u ON pc.user_id = u.id
        WHERE pc.project_id IN (?)
      `, [projIds]);

      contributors.forEach((c: any) => {
        if (!contributorsMap[c.project_id]) contributorsMap[c.project_id] = [];
        contributorsMap[c.project_id].push({
          userId: c.user_id,
          role: c.role,
          joinedAt: c.joined_at,
          user: {
            id: c.user_id,
            name: c.name,
            username: c.username,
            avatar: c.avatar,
            role: c.user_default_role
          }
        });
      });
    }

    const formatted = projects.map((p: any) => ({
      id: p.id,
      title: p.title,
      tagline: p.tagline,
      description: p.description,
      goals: typeof p.goals === 'string' ? JSON.parse(p.goals) : (p.goals || []),
      technologies: typeof p.technologies === 'string' ? JSON.parse(p.technologies) : (p.technologies || []),
      ownerId: p.owner_id,
      owner: {
        id: p.owner_id,
        name: p.owner_name,
        avatar: p.owner_avatar,
        role: p.owner_role
      },
      contributors: contributorsMap[p.id] || [],
      status: p.status,
      visibility: p.visibility,
      githubRepo: typeof p.github_repo === 'string' ? JSON.parse(p.github_repo) : p.github_repo,
      openRolesNeeded: typeof p.open_roles_needed === 'string' ? JSON.parse(p.open_roles_needed) : (p.open_roles_needed || []),
      estimatedDuration: p.estimated_duration,
      liveUrl: p.live_url,
      applicationsCount: p.applications_count,
      createdAt: p.created_at
    }));

    res.json({ projects: formatted });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function createProject(req: Request, res: Response) {
  try {
    const { title, tagline, description, goals, technologies, ownerId, openRolesNeeded, liveUrl, githubRepo } = req.body;
    const id = `proj_${Date.now()}`;

    await pool.query(`
      INSERT INTO projects (id, title, tagline, description, goals, technologies, owner_id, status, visibility, github_repo, open_roles_needed, live_url)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'Recruiting Collaborators', 'public', ?, ?, ?)
    `, [
      id,
      title,
      tagline || '',
      description || '',
      JSON.stringify(goals || []),
      JSON.stringify(technologies || []),
      ownerId,
      JSON.stringify(githubRepo || null),
      JSON.stringify(openRolesNeeded || []),
      liveUrl || null
    ]);

    // Insert owner as lead contributor
    await pool.query(`
      INSERT INTO project_contributors (project_id, user_id, role, joined_at)
      VALUES (?, ?, 'Project Lead', 'Just now')
    `, [id, ownerId]);

    res.status(201).json({ id, success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function completeProject(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { liveUrl } = req.body;

    await pool.query(`
      UPDATE projects 
      SET status = 'Completed / Shipped', live_url = ?
      WHERE id = ?
    `, [liveUrl || null, id]);

    // Fetch project and its contributors to archive to project_history
    const [rows]: any = await pool.query('SELECT * FROM projects WHERE id = ?', [id]);
    if (rows.length > 0) {
      const p = rows[0];
      const [contribRows]: any = await pool.query(`
        SELECT pc.*, u.name, u.username, u.avatar
        FROM project_contributors pc
        JOIN users u ON pc.user_id = u.id
        WHERE pc.project_id = ?
      `, [id]);

      const collaborators = contribRows.map((c: any) => ({
        userId: c.user_id,
        name: c.name,
        username: c.username,
        avatar: c.avatar,
        role: c.role
      }));

      // If no contributors found, add owner as collaborator
      if (collaborators.length === 0) {
        const [ownerRows]: any = await pool.query('SELECT name, username, avatar, role FROM users WHERE id = ?', [p.owner_id]);
        if (ownerRows.length > 0) {
          collaborators.push({
            userId: p.owner_id,
            name: ownerRows[0].name,
            username: ownerRows[0].username,
            avatar: ownerRows[0].avatar,
            role: ownerRows[0].role
          });
        }
      }

      const metrics = JSON.stringify({
        stars: 120,
        users: 'Live in Production',
        commits: 48
      });

      // Check if already exists in project_history
      const [existingHist]: any = await pool.query('SELECT id FROM project_history WHERE id = ? OR title = ?', [id, p.title]);

      if (existingHist.length > 0) {
        await pool.query(`
          UPDATE project_history
          SET completed_date = 'Today', live_url = ?, technologies = ?, collaborators = ?, metrics = ?
          WHERE id = ?
        `, [liveUrl || p.live_url, typeof p.technologies === 'string' ? p.technologies : JSON.stringify(p.technologies), JSON.stringify(collaborators), metrics, existingHist[0].id]);
      } else {
        const histId = `hist_${Date.now()}`;
        await pool.query(`
          INSERT INTO project_history (id, title, tagline, description, completed_date, live_url, technologies, collaborators, metrics)
          VALUES (?, ?, ?, ?, 'Today', ?, ?, ?, ?)
        `, [histId, p.title, p.tagline, p.description, liveUrl || p.live_url, typeof p.technologies === 'string' ? p.technologies : JSON.stringify(p.technologies), JSON.stringify(collaborators), metrics]);
      }
    }

    res.json({ success: true, id, status: 'Completed / Shipped', liveUrl });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function getProjectHistory(req: Request, res: Response) {
  try {
    const [history]: any = await pool.query('SELECT * FROM project_history ORDER BY created_at DESC');
    const formatted = history.map((h: any) => ({
      id: h.id,
      title: h.title,
      tagline: h.tagline,
      description: h.description,
      completedDate: h.completed_date,
      liveUrl: h.live_url,
      githubUrl: h.github_url,
      technologies: typeof h.technologies === 'string' ? JSON.parse(h.technologies) : (h.technologies || []),
      collaborators: typeof h.collaborators === 'string' ? JSON.parse(h.collaborators) : (h.collaborators || []),
      metrics: typeof h.metrics === 'string' ? JSON.parse(h.metrics) : (h.metrics || { stars: 100, users: 'Production Live', commits: 50 }),
      testimonial: typeof h.testimonial === 'string' ? JSON.parse(h.testimonial) : h.testimonial
    }));
    res.json({ history: formatted });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}
