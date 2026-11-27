import { pool } from '../config/db.js';

export interface GitPushNotificationParams {
  repositoryId?: string;
  projectId?: string;
  author: {
    id?: string;
    name: string;
    avatar?: string;
    role?: string;
  };
  branch: string;
  commitHash: string;
  commitMessage: string;
  filesChanged?: string[];
  additions?: number;
  deletions?: number;
  diffSnippet?: string;
  source?: 'git-cli' | 'web-editor' | 'pr-merge';
}

/**
 * Automatically posts a Git Push / Commit notification message into the project's chat.
 */
export async function notifyProjectChatOfPush(params: GitPushNotificationParams): Promise<boolean> {
  try {
    let projectId = params.projectId;
    let repoName = '';

    // If projectId is not directly provided, find by repositoryId
    if (!projectId && params.repositoryId) {
      const [rRows]: any = await pool.query(
        'SELECT id, project_id, name, slug FROM repositories WHERE id = ? OR slug = ? LIMIT 1',
        [params.repositoryId, params.repositoryId]
      );
      if (rRows.length > 0) {
        projectId = rRows[0].project_id;
        repoName = rRows[0].name;
      }
    }

    if (!projectId) {
      // No project linked to this repo
      return false;
    }

    // Find conversation linked to this project
    let [cRows]: any = await pool.query(
      'SELECT id, project_name FROM conversations WHERE project_id = ? OR id = ? LIMIT 1',
      [projectId, `conv_proj_${projectId}`]
    );

    let conversationId = '';
    if (cRows.length > 0) {
      conversationId = cRows[0].id;
    } else {
      // If no conversation exists yet for this project, create one automatically
      conversationId = `conv_proj_${projectId}`;
      const [pRows]: any = await pool.query('SELECT title FROM projects WHERE id = ? LIMIT 1', [projectId]);
      const projName = pRows.length > 0 ? pRows[0].title : (repoName || 'Project Team Workspace');

      await pool.query(
        'INSERT INTO conversations (id, type, project_id, project_name, project_context) VALUES (?, ?, ?, ?, ?)',
        [conversationId, 'project', projectId, projName, `${projName} Team Engineering Channel`]
      );
    }

    const shortHash = (params.commitHash || 'latest').substring(0, 7);
    const msgId = `msg_git_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const isPrMerge = params.source === 'pr-merge';
    const actionTitle = isPrMerge ? `PR Merged into ${params.branch}` : `Git Push [${params.branch}]`;
    const messageText = isPrMerge
      ? `🔀 [Git Merge] ${params.author.name} merged #${shortHash} into ${params.branch}: "${params.commitMessage}"`
      : `🚀 [Git Push] ${params.author.name} pushed code to ${params.branch}: "${params.commitMessage}"`;

    const attachment = {
      type: 'git_action',
      title: actionTitle,
      gitAction: {
        action: isPrMerge ? 'pr' : 'push',
        branch: params.branch,
        commitHash: shortHash,
        commitMessage: params.commitMessage,
        filesChanged: params.filesChanged || [],
        additions: params.additions || 0,
        deletions: params.deletions || 0,
        diffSnippet: params.diffSnippet || undefined,
        isSynced: false,
        prStatus: isPrMerge ? 'merged' : undefined
      }
    };

    // Insert directly into messages table
    await pool.query(
      `INSERT INTO messages 
       (id, conversation_id, sender_id, sender_name, sender_avatar, project_role, text, timestamp, attachments, is_read, is_system)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, false, false)`,
      [
        msgId,
        conversationId,
        params.author.id || 'user_1',
        params.author.name,
        params.author.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb',
        params.author.role || 'Contributor',
        messageText,
        timestamp,
        JSON.stringify([attachment])
      ]
    );

    // Update conversation updated_at
    await pool.query('UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?', [conversationId]);

    console.log(`[GitChatNotifier] Auto-message posted to conversation ${conversationId} for push on ${params.branch} (#${shortHash})`);
    return true;
  } catch (err) {
    console.error('[GitChatNotifier] Error posting push message to project chat:', err);
    return false;
  }
}
