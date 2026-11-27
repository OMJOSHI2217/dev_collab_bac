import { Request, Response } from 'express';
import { pool } from '../config/db.js';

export async function getConversations(req: Request, res: Response) {
  try {
    const { userId } = req.query;

    const [conversations]: any = await pool.query(`
      SELECT c.* 
      FROM conversations c
      ORDER BY c.updated_at DESC
    `);

    const convIds = conversations.map((c: any) => c.id);
    let participantsMap: Record<string, any[]> = {};

    if (convIds.length > 0) {
      const [participants]: any = await pool.query(`
        SELECT cp.conversation_id, u.*
        FROM conversation_participants cp
        JOIN users u ON cp.user_id = u.id
        WHERE cp.conversation_id IN (?)
      `, [convIds]);

      participants.forEach((p: any) => {
        if (!participantsMap[p.conversation_id]) participantsMap[p.conversation_id] = [];
        participantsMap[p.conversation_id].push({
          id: p.id,
          name: p.name,
          username: p.username,
          avatar: p.avatar,
          role: p.role,
          isOnline: Boolean(p.is_online)
        });
      });
    }

    const formatted = conversations.map((c: any) => {
      const members = participantsMap[c.id] || [];
      const otherUser = members.find((m: any) => m.id !== userId) || members[0] || {
        id: 'user_fallback',
        name: c.project_name || 'Project Team',
        avatar: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&q=80&w=250',
        role: 'Collaborator',
        isOnline: true
      };

      return {
        id: c.id,
        type: c.type,
        projectId: c.project_id,
        projectName: c.project_name,
        projectContext: c.project_context,
        projectRoles: typeof c.project_roles === 'string' ? JSON.parse(c.project_roles) : (c.project_roles || {}),
        participantIds: members.map((m: any) => m.id),
        participant: otherUser,
        participants: members,
        unreadCount: 0,
        updatedAt: 'Just now'
      };
    });

    res.json({ conversations: formatted });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function getMessages(req: Request, res: Response) {
  try {
    const { conversationId } = req.params;
    const [messages]: any = await pool.query(`
      SELECT * FROM messages
      WHERE conversation_id = ?
      ORDER BY created_at ASC
    `, [conversationId]);

    const formatted = messages.map((m: any) => ({
      id: m.id,
      conversationId: m.conversation_id,
      senderId: m.sender_id,
      senderName: m.sender_name,
      senderAvatar: m.sender_avatar,
      projectRole: m.project_role,
      text: m.text,
      timestamp: m.timestamp,
      attachments: typeof m.attachments === 'string' ? JSON.parse(m.attachments) : (m.attachments || undefined),
      isRead: Boolean(m.is_read),
      isSystem: Boolean(m.is_system)
    }));

    res.json({ messages: formatted });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function sendMessage(req: Request, res: Response) {
  try {
    const { conversationId, senderId, senderName, senderAvatar, projectRole, text, attachments, isSystem } = req.body;
    const id = `msg_${Date.now()}`;
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    await pool.query(`
      INSERT INTO messages (id, conversation_id, sender_id, sender_name, sender_avatar, project_role, text, timestamp, attachments, is_read, is_system)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, false, ?)
    `, [
      id,
      conversationId,
      senderId,
      senderName || null,
      senderAvatar || null,
      projectRole || null,
      text,
      timestamp,
      attachments ? JSON.stringify(attachments) : null,
      Boolean(isSystem)
    ]);

    // Update conversation timestamp
    await pool.query('UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?', [conversationId]);

    res.status(201).json({
      message: {
        id,
        conversationId,
        senderId,
        senderName,
        senderAvatar,
        projectRole,
        text,
        timestamp,
        attachments,
        isRead: false,
        isSystem: Boolean(isSystem)
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function assignProjectRole(req: Request, res: Response) {
  try {
    const { projectId, userId, newRole, senderName } = req.body;
    const convId = `conv_proj_${projectId}`;

    // Update conversation project_roles
    const [convRows]: any = await pool.query('SELECT project_roles FROM conversations WHERE project_id = ? OR id = ?', [projectId, convId]);
    if (convRows.length > 0) {
      const existingRoles = typeof convRows[0].project_roles === 'string' 
        ? JSON.parse(convRows[0].project_roles || '{}') 
        : (convRows[0].project_roles || {});
      existingRoles[userId] = newRole;

      await pool.query('UPDATE conversations SET project_roles = ? WHERE id = ?', [JSON.stringify(existingRoles), convRows[0].id]);
    }

    // Update contributor role
    await pool.query('UPDATE project_contributors SET role = ? WHERE project_id = ? AND user_id = ?', [newRole, projectId, userId]);

    // Record system announcement message in chat
    const msgId = `msg_role_${Date.now()}`;
    await pool.query(`
      INSERT INTO messages (id, conversation_id, sender_id, sender_name, text, timestamp, is_system)
      VALUES (?, ?, 'system', 'Role Manager', ?, ?, true)
    `, [
      msgId,
      convId,
      `📢 ${senderName || 'Lead'} assigned team member to project role: "${newRole}"`,
      new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    ]);

    res.json({ success: true, projectId, userId, newRole });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}
