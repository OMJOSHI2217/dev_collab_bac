import { Request, Response } from 'express';
import { pool } from '../config/db.js';

export async function getDevelopers(req: Request, res: Response) {
  try {
    const { search, role, location } = req.query;

    let query = 'SELECT * FROM users WHERE 1=1';
    const params: any[] = [];

    if (search) {
      query += ' AND (name LIKE ? OR role LIKE ? OR specialization LIKE ? OR city LIKE ?)';
      const s = `%${search}%`;
      params.push(s, s, s, s);
    }

    if (role && role !== 'all') {
      query += ' AND role = ?';
      params.push(role);
    }

    if (location && location !== 'all') {
      query += ' AND (city LIKE ? OR country LIKE ?)';
      params.push(`%${location}%`, `%${location}%`);
    }

    query += ' ORDER BY compatibility_score DESC, created_at DESC';

    const [developers]: any = await pool.query(query, params);

    // Fetch skills for each developer
    const userIds = developers.map((d: any) => d.id);
    let skillsMap: Record<string, string[]> = {};
    if (userIds.length > 0) {
      const [skills]: any = await pool.query('SELECT user_id, skill_name, category, level FROM user_skills WHERE user_id IN (?)', [userIds]);
      
      skills.forEach((s: any) => {
        if (!skillsMap[s.user_id]) skillsMap[s.user_id] = [];
        skillsMap[s.user_id].push(s.skill_name);
      });
    }

    const formatted = developers.map((d: any) => ({
      id: d.id,
      name: d.name,
      username: d.username,
      email: d.email,
      phone: d.phone || null,
      avatar: d.avatar,
      role: d.role,
      specialization: d.specialization || 'Full Stack & Distributed Systems',
      experienceLevel: d.experience_level || 'Senior (5-8 yrs)',
      yearsOfExperience: d.years_of_experience || 5,
      bio: d.bio || '',
      city: d.city || 'San Francisco',
      country: d.country || 'United States',
      skills: skillsMap[d.id] || ['TypeScript', 'React', 'Node.js'],
      preferredCollaboratorRoles: typeof d.preferred_collaborator_roles === 'string'
        ? JSON.parse(d.preferred_collaborator_roles)
        : (d.preferred_collaborator_roles || ['Frontend Developer', 'Backend Developer', 'DevOps & Cloud Engineer']),
      availability: d.availability || 'Part-Time (10-15h/wk)',
      socialLinks: typeof d.social_links === 'string'
        ? JSON.parse(d.social_links)
        : (d.social_links || { github: `https://github.com/${d.username}` }),
      privacy: typeof d.privacy === 'string'
        ? JSON.parse(d.privacy)
        : (d.privacy || {
            profileVisibility: 'public',
            showExactLocation: true,
            showSocialLinksPublicly: false,
            showPhoneToConnections: true,
            allowProjectInvites: true,
            showOnlineStatus: true
          }),
      projectsCount: d.projects_count || 0,
      connectionsCount: d.connections_count || 0,
      compatibilityScore: d.compatibility_score || 95,
      isOnline: Boolean(d.is_online),
      lastActive: d.last_active || 'Online',
      joinedDate: d.joined_date || 'January 2024'
    }));

    res.json({ developers: formatted });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function getDeveloperById(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const [rows]: any = await pool.query('SELECT * FROM users WHERE id = ? LIMIT 1', [id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Developer not found' });
    }

    const dev = rows[0];
    const [skills]: any = await pool.query('SELECT skill_name, category, level FROM user_skills WHERE user_id = ?', [id]);
    
    const formatted = {
      id: dev.id,
      name: dev.name,
      username: dev.username,
      email: dev.email,
      phone: dev.phone || null,
      avatar: dev.avatar,
      role: dev.role,
      specialization: dev.specialization || 'Full Stack & Distributed Systems',
      experienceLevel: dev.experience_level || 'Senior (5-8 yrs)',
      yearsOfExperience: dev.years_of_experience || 5,
      bio: dev.bio || '',
      city: dev.city || 'San Francisco',
      country: dev.country || 'United States',
      skills: skills.map((s: any) => s.skill_name),
      preferredCollaboratorRoles: typeof dev.preferred_collaborator_roles === 'string'
        ? JSON.parse(dev.preferred_collaborator_roles)
        : (dev.preferred_collaborator_roles || ['Frontend Developer', 'Backend Developer', 'DevOps & Cloud Engineer']),
      availability: dev.availability || 'Part-Time (10-15h/wk)',
      socialLinks: typeof dev.social_links === 'string'
        ? JSON.parse(dev.social_links)
        : (dev.social_links || { github: `https://github.com/${dev.username}` }),
      privacy: typeof dev.privacy === 'string'
        ? JSON.parse(dev.privacy)
        : (dev.privacy || {
            profileVisibility: 'public',
            showExactLocation: true,
            showSocialLinksPublicly: false,
            showPhoneToConnections: true,
            allowProjectInvites: true,
            showOnlineStatus: true
          }),
      projectsCount: dev.projects_count || 0,
      connectionsCount: dev.connections_count || 0,
      compatibilityScore: dev.compatibility_score || 95,
      isOnline: Boolean(dev.is_online),
      lastActive: dev.last_active || 'Online',
      joinedDate: dev.joined_date || 'January 2024'
    };

    res.json({ developer: formatted });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}
