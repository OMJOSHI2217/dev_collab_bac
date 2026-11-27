import { Request, Response } from 'express';
import { pool } from '../config/db.js';

function formatUser(d: any, skills: string[] = []) {
  return {
    id: d.id,
    name: d.name,
    username: d.username,
    email: d.email,
    phone: d.phone || '',
    avatar: d.avatar,
    role: d.role,
    specialization: d.specialization || '',
    experienceLevel: d.experience_level || 'Mid-Level (2-5 yrs)',
    yearsOfExperience: d.years_of_experience || 1,
    bio: d.bio || '',
    city: d.city || '',
    country: d.country || '',
    skills: skills.length > 0 ? skills : (d.skills || []),
    preferredCollaboratorRoles: typeof d.preferred_collaborator_roles === 'string'
      ? JSON.parse(d.preferred_collaborator_roles)
      : (d.preferred_collaborator_roles || []),
    availability: d.availability || 'Full-Time Available',
    socialLinks: typeof d.social_links === 'string'
      ? JSON.parse(d.social_links)
      : (d.social_links || {}),
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
    joinedDate: d.created_at ? new Date(d.created_at).toLocaleDateString() : 'Just now'
  };
}

export async function login(req: Request, res: Response) {
  try {
    const { email, password } = req.body;
    if (!email || !email.trim()) {
      return res.status(400).json({ error: 'Email or username is required' });
    }

    const identifier = email.trim();

    // Query user by email OR username (case-insensitive)
    const [rows]: any = await pool.query(
      'SELECT * FROM users WHERE LOWER(email) = LOWER(?) OR LOWER(username) = LOWER(?) LIMIT 1',
      [identifier, identifier]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'No account found with this email or username. Please check your credentials or register.' });
    }

    const user = rows[0];

    // Verify password if user has password saved and password is supplied
    if (user.password && password && user.password !== password) {
      return res.status(401).json({ error: 'Incorrect password. Please try again.' });
    }

    const [skills]: any = await pool.query('SELECT skill_name FROM user_skills WHERE user_id = ?', [user.id]);
    const userSkills = skills.map((s: any) => s.skill_name);

    res.json({ user: formatUser(user, userSkills), message: 'Logged in successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function register(req: Request, res: Response) {
  try {
    const { 
      name, username, email, phone, role, avatar, password,
      specialization, bio, city, country, skills, experienceLevel, yearsOfExperience, availability 
    } = req.body;

    if (!email || !email.trim() || !username || !username.trim() || !name || !name.trim()) {
      return res.status(400).json({ error: 'Name, username, and email are required fields.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanUsername = username.trim().replace(/^@/, '');

    // Check if account with email or username already exists
    const [existing]: any = await pool.query(
      'SELECT id, email, username FROM users WHERE LOWER(email) = ? OR LOWER(username) = ? LIMIT 1',
      [cleanEmail, cleanUsername.toLowerCase()]
    );

    if (existing.length > 0) {
      if (existing[0].email.toLowerCase() === cleanEmail) {
        return res.status(409).json({ error: 'An account with this email already exists. Please sign in instead.' });
      } else {
        return res.status(409).json({ error: 'This username is already taken. Please choose another username.' });
      }
    }
    
    const id = `user_${Date.now()}`;
    const userAvatar = avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(name.trim())}&background=0d9488&color=fff&bold=true`;

    await pool.query(
      `INSERT INTO users (
        id, name, username, email, password, phone, avatar, role, specialization, 
        experience_level, years_of_experience, bio, city, country, availability, is_online, last_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        name.trim(),
        cleanUsername,
        cleanEmail,
        password || null,
        phone?.trim() || '',
        userAvatar,
        role || 'Fullstack Developer',
        specialization || '',
        experienceLevel || 'Mid-Level (2-5 yrs)',
        yearsOfExperience || 1,
        bio || '',
        city || '',
        country || '',
        availability || 'Full-Time Available',
        true,
        'Online'
      ]
    );

    // Save initial skills if provided
    const userSkills = Array.isArray(skills) && skills.length > 0 ? skills : [];

    for (const skill of userSkills) {
      await pool.query('INSERT INTO user_skills (user_id, skill_name) VALUES (?, ?)', [id, skill]);
    }

    const [created]: any = await pool.query('SELECT * FROM users WHERE id = ?', [id]);
    const user = created[0];

    res.status(201).json({ success: true, user: formatUser(user, userSkills), message: 'Account created successfully' });
  } catch (error: any) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'An account with this email or username already exists. Please sign in instead.' });
    }
    res.status(500).json({ error: error.message });
  }
}

export async function updateProfile(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const updates = req.body;

    const fields: string[] = [];
    const values: any[] = [];

    // Map camelCase to snake_case column names
    const allowedKeys: Record<string, string> = {
      name: 'name',
      username: 'username',
      email: 'email',
      phone: 'phone',
      avatar: 'avatar',
      role: 'role',
      specialization: 'specialization',
      experienceLevel: 'experience_level',
      experience_level: 'experience_level',
      yearsOfExperience: 'years_of_experience',
      years_of_experience: 'years_of_experience',
      bio: 'bio',
      city: 'city',
      country: 'country',
      availability: 'availability',
      socialLinks: 'social_links',
      social_links: 'social_links',
      privacy: 'privacy'
    };

    for (const [key, val] of Object.entries(updates)) {
      if (allowedKeys[key]) {
        const col = allowedKeys[key];
        fields.push(`${col} = ?`);
        if (typeof val === 'object' && val !== null) {
          values.push(JSON.stringify(val));
        } else {
          values.push(val);
        }
      }
    }

    if (fields.length > 0) {
      values.push(id);
      await pool.query(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, values);
    }

    // If avatar was updated, keep sender_avatar synced across messages
    if (updates.avatar) {
      await pool.query('UPDATE messages SET sender_avatar = ? WHERE sender_id = ?', [updates.avatar, id]);
    }

    // If skills were updated
    if (Array.isArray(updates.skills)) {
      await pool.query('DELETE FROM user_skills WHERE user_id = ?', [id]);
      for (const s of updates.skills) {
        await pool.query('INSERT INTO user_skills (user_id, skill_name) VALUES (?, ?)', [id, s]);
      }
    }

    const [updated]: any = await pool.query('SELECT * FROM users WHERE id = ?', [id]);
    if (updated.length > 0) {
      const user = updated[0];
      const [skills]: any = await pool.query('SELECT skill_name FROM user_skills WHERE user_id = ?', [id]);
      user.skills = skills.map((s: any) => s.skill_name);
      return res.json({ user });
    }

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function uploadAvatar(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { avatar } = req.body;

    if (!avatar) {
      return res.status(400).json({ error: 'Avatar image data is required' });
    }

    // Saves profile picture (base64 data URL or external URL) to users table
    await pool.query('UPDATE users SET avatar = ? WHERE id = ?', [avatar, id]);
    // Also sync to messages table so message bubbles reflect the new profile picture
    await pool.query('UPDATE messages SET sender_avatar = ? WHERE sender_id = ?', [avatar, id]);

    res.json({ success: true, avatar });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}
