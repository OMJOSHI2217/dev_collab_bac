import { Request, Response } from 'express';
import path from 'path';
import { pool } from '../config/db.js';
import { GitService, resolveRepoDiskPath } from '../services/gitService.js';
import { notifyProjectChatOfPush } from '../services/gitChatNotifier.js';

async function getRepoInfo(slug: string): Promise<any | null> {
  const [rows]: any = await pool.query('SELECT * FROM repositories WHERE slug = ? LIMIT 1', [slug]);
  if (rows.length === 0) return null;
  const repo = rows[0];
  repo.diskPath = resolveRepoDiskPath(repo.disk_path);
  return repo;
}

export async function getPullRequests(req: Request, res: Response) {
  try {
    const { owner, repo } = req.params;
    const { status = 'all' } = req.query;
    const cleanRepo = repo.replace(/\.git$/, '');
    const slug = `${owner}/${cleanRepo}`;

    const repository = await getRepoInfo(slug);
    if (!repository) return res.status(404).json({ error: 'Repository not found' });

    let query = `
      SELECT pr.*, 
             u.name as author_name, u.username as author_username, u.avatar as author_avatar,
             m.name as merged_by_name,
             (SELECT count(*) FROM pull_request_comments WHERE pull_request_id = pr.id) as comments_count,
             (SELECT count(*) FROM pull_request_reviews WHERE pull_request_id = pr.id AND decision = 'approved') as approvals_count
      FROM pull_requests pr
      JOIN users u ON pr.author_id = u.id
      LEFT JOIN users m ON pr.merged_by = m.id
      WHERE pr.repository_id = ?
    `;
    const params: any[] = [repository.id];

    if (status !== 'all') {
      query += ' AND pr.status = ?';
      params.push(status);
    }

    query += ' ORDER BY pr.created_at DESC';

    const [prs]: any = await pool.query(query, params);
    res.json({ pullRequests: prs });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function getPullRequestByNumber(req: Request, res: Response) {
  try {
    const { owner, repo, number } = req.params;
    const cleanRepo = repo.replace(/\.git$/, '');
    const slug = `${owner}/${cleanRepo}`;

    const repository = await getRepoInfo(slug);
    if (!repository) return res.status(404).json({ error: 'Repository not found' });

    const [rows]: any = await pool.query(`
      SELECT pr.*, 
             u.name as author_name, u.username as author_username, u.avatar as author_avatar,
             m.name as merged_by_name
      FROM pull_requests pr
      JOIN users u ON pr.author_id = u.id
      LEFT JOIN users m ON pr.merged_by = m.id
      WHERE pr.repository_id = ? AND pr.number = ?
      LIMIT 1
    `, [repository.id, number]);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Pull Request not found' });
    }

    const pr = rows[0];

    // Check merge conflict state in real-time
    const conflictCheck = await GitService.checkMergeConflict(
      repository.diskPath,
      pr.target_branch,
      pr.source_branch
    );
    pr.can_merge = conflictCheck.canMerge;
    pr.conflicts = conflictCheck.conflicts;

    // Fetch reviews
    const [reviews]: any = await pool.query(`
      SELECT r.*, u.name as reviewer_name, u.username as reviewer_username, u.avatar as reviewer_avatar
      FROM pull_request_reviews r
      JOIN users u ON r.reviewer_id = u.id
      WHERE r.pull_request_id = ?
      ORDER BY r.created_at ASC
    `, [pr.id]);

    // Fetch comments
    const [comments]: any = await pool.query(`
      SELECT c.*, u.name as user_name, u.username as user_username, u.avatar as user_avatar
      FROM pull_request_comments c
      JOIN users u ON c.user_id = u.id
      WHERE c.pull_request_id = ?
      ORDER BY c.created_at ASC
    `, [pr.id]);

    res.json({
      pullRequest: pr,
      reviews,
      comments
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function getPullRequestDiff(req: Request, res: Response) {
  try {
    const { owner, repo, number } = req.params;
    const cleanRepo = repo.replace(/\.git$/, '');
    const slug = `${owner}/${cleanRepo}`;

    const repository = await getRepoInfo(slug);
    if (!repository) return res.status(404).json({ error: 'Repository not found' });

    const [rows]: any = await pool.query(
      'SELECT source_branch, target_branch FROM pull_requests WHERE repository_id = ? AND number = ? LIMIT 1',
      [repository.id, number]
    );

    if (rows.length === 0) return res.status(404).json({ error: 'Pull Request not found' });

    const diff = await GitService.getDiff(repository.diskPath, rows[0].target_branch, rows[0].source_branch);
    res.json(diff);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function createPullRequest(req: Request, res: Response) {
  try {
    const { owner, repo } = req.params;
    const { title, description, sourceBranch, targetBranch, authorId } = req.body;

    if (!title || !sourceBranch || !targetBranch || !authorId) {
      return res.status(400).json({ error: 'title, sourceBranch, targetBranch, and authorId are required' });
    }

    const cleanRepo = repo.replace(/\.git$/, '');
    const slug = `${owner}/${cleanRepo}`;

    const repository = await getRepoInfo(slug);
    if (!repository) return res.status(404).json({ error: 'Repository not found' });

    // Verify merge conflict status
    const conflictCheck = await GitService.checkMergeConflict(repository.diskPath, targetBranch, sourceBranch);
    const mergeableState = conflictCheck.canMerge ? 'clean' : 'conflict';

    // Get next PR number
    const [numRows]: any = await pool.query(
      'SELECT coalesce(max(number), 0) + 1 as nextNum FROM pull_requests WHERE repository_id = ?',
      [repository.id]
    );
    const prNumber = numRows[0].nextNum;
    const prId = `pr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    await pool.query(`
      INSERT INTO pull_requests (
        id, repository_id, number, title, description, author_id, 
        source_branch, target_branch, status, mergeable_state
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'open', ?)
    `, [
      prId, repository.id, prNumber, title, description || '', 
      authorId, sourceBranch, targetBranch, mergeableState
    ]);

    await pool.query(`
      INSERT INTO repository_activities (repository_id, user_id, action_type, details)
      VALUES (?, ?, 'pr_opened', ?)
    `, [repository.id, authorId, JSON.stringify({ number: prNumber, title, sourceBranch, targetBranch })]);

    await pool.query('UPDATE repositories SET open_prs_count = open_prs_count + 1 WHERE id = ?', [repository.id]);

    const [created]: any = await pool.query('SELECT * FROM pull_requests WHERE id = ?', [prId]);
    res.status(201).json({ pullRequest: created[0] });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function submitReview(req: Request, res: Response) {
  try {
    const { owner, repo, number } = req.params;
    const { reviewerId, decision = 'approved', body } = req.body;

    const cleanRepo = repo.replace(/\.git$/, '');
    const slug = `${owner}/${cleanRepo}`;

    const repository = await getRepoInfo(slug);
    if (!repository) return res.status(404).json({ error: 'Repository not found' });

    const [prRows]: any = await pool.query(
      'SELECT id FROM pull_requests WHERE repository_id = ? AND number = ? LIMIT 1',
      [repository.id, number]
    );
    if (prRows.length === 0) return res.status(404).json({ error: 'Pull request not found' });

    const prId = prRows[0].id;
    const reviewId = `rev_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    await pool.query(`
      INSERT INTO pull_request_reviews (id, pull_request_id, reviewer_id, decision, body)
      VALUES (?, ?, ?, ?, ?)
    `, [reviewId, prId, reviewerId, decision, body || '']);

    await pool.query(`
      INSERT INTO repository_activities (repository_id, user_id, action_type, details)
      VALUES (?, ?, 'pr_opened', ?)
    `, [repository.id, reviewerId, JSON.stringify({ prNumber: number, reviewDecision: decision })]);

    res.status(201).json({ success: true, reviewId, decision });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function addComment(req: Request, res: Response) {
  try {
    const { owner, repo, number } = req.params;
    const { userId, body, filePath, lineNumber, diffHunk } = req.body;

    if (!body || !userId) {
      return res.status(400).json({ error: 'userId and comment body are required' });
    }

    const cleanRepo = repo.replace(/\.git$/, '');
    const slug = `${owner}/${cleanRepo}`;

    const repository = await getRepoInfo(slug);
    if (!repository) return res.status(404).json({ error: 'Repository not found' });

    const [prRows]: any = await pool.query(
      'SELECT id FROM pull_requests WHERE repository_id = ? AND number = ? LIMIT 1',
      [repository.id, number]
    );
    if (prRows.length === 0) return res.status(404).json({ error: 'Pull request not found' });

    const prId = prRows[0].id;
    const commentId = `prc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    await pool.query(`
      INSERT INTO pull_request_comments (id, pull_request_id, user_id, file_path, line_number, diff_hunk, body)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [commentId, prId, userId, filePath || null, lineNumber || null, diffHunk || null, body]);

    res.status(201).json({ success: true, commentId });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function mergePullRequest(req: Request, res: Response) {
  try {
    const { owner, repo, number } = req.params;
    const { userId, commitMessage } = req.body;

    const cleanRepo = repo.replace(/\.git$/, '');
    const slug = `${owner}/${cleanRepo}`;

    const repository = await getRepoInfo(slug);
    if (!repository) return res.status(404).json({ error: 'Repository not found' });

    const [prRows]: any = await pool.query(
      'SELECT * FROM pull_requests WHERE repository_id = ? AND number = ? LIMIT 1',
      [repository.id, number]
    );
    if (prRows.length === 0) return res.status(404).json({ error: 'Pull request not found' });

    const pr = prRows[0];
    if (pr.status === 'merged') {
      return res.status(400).json({ error: 'Pull Request is already merged' });
    }

    // Lookup user author
    let author = { name: 'DevCollab Reviewer', email: 'reviewer@devcollab.io' };
    if (userId) {
      const [uRows]: any = await pool.query('SELECT name, email FROM users WHERE id = ? LIMIT 1', [userId]);
      if (uRows.length > 0) author = { name: uRows[0].name, email: uRows[0].email };
    }

    const finalMessage = commitMessage || `Merge pull request #${pr.number} from ${pr.source_branch} into ${pr.target_branch}\n\n${pr.title}`;

    // Perform actual Git merge
    const mergeCommitHash = await GitService.mergePullRequest(
      repository.diskPath,
      author,
      pr.target_branch,
      pr.source_branch,
      finalMessage
    );

    // Update PR in database
    await pool.query(`
      UPDATE pull_requests 
      SET status = 'merged', merged_by = ?, merged_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [userId || null, pr.id]);

    await pool.query(`
      INSERT INTO repository_activities (repository_id, user_id, action_type, details)
      VALUES (?, ?, 'pr_merged', ?)
    `, [repository.id, userId || repository.owner_id, JSON.stringify({ number: pr.number, title: pr.title, commit: mergeCommitHash })]);

    await pool.query('UPDATE repositories SET open_prs_count = GREATEST(0, open_prs_count - 1), updated_at = CURRENT_TIMESTAMP WHERE id = ?', [repository.id]);

    // Automatically post PR Merge notification to project chat
    try {
      let authorUser: any = null;
      if (userId) {
        const [uRows]: any = await pool.query('SELECT id, name, avatar, role FROM users WHERE id = ? LIMIT 1', [userId]);
        if (uRows.length > 0) authorUser = uRows[0];
      }

      await notifyProjectChatOfPush({
        repositoryId: repository.id,
        projectId: repository.project_id,
        author: {
          id: authorUser?.id || userId || repository.owner_id,
          name: authorUser?.name || author.name,
          avatar: authorUser?.avatar,
          role: authorUser?.role || 'Reviewer'
        },
        branch: pr.target_branch,
        commitHash: mergeCommitHash,
        commitMessage: finalMessage,
        source: 'pr-merge'
      });
    } catch (err) {
      console.error('[pullRequestsController] Failed to auto-post PR merge notification to chat:', err);
    }

    res.json({
      success: true,
      mergeCommitHash,
      status: 'merged'
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function closePullRequest(req: Request, res: Response) {
  try {
    const { owner, repo, number } = req.params;
    const { userId } = req.body;

    const cleanRepo = repo.replace(/\.git$/, '');
    const slug = `${owner}/${cleanRepo}`;

    const repository = await getRepoInfo(slug);
    if (!repository) return res.status(404).json({ error: 'Repository not found' });

    await pool.query(`
      UPDATE pull_requests 
      SET status = 'closed', closed_at = CURRENT_TIMESTAMP
      WHERE repository_id = ? AND number = ?
    `, [repository.id, number]);

    await pool.query(`
      INSERT INTO repository_activities (repository_id, user_id, action_type, details)
      VALUES (?, ?, 'pr_closed', ?)
    `, [repository.id, userId || repository.owner_id, JSON.stringify({ number })]);

    await pool.query('UPDATE repositories SET open_prs_count = GREATEST(0, open_prs_count - 1) WHERE id = ?', [repository.id]);

    res.json({ success: true, status: 'closed' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}
