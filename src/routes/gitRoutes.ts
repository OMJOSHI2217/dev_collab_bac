import { Router } from 'express';
import { 
  getRepositories, 
  getRepositoryBySlug, 
  createRepository, 
  updateRepository, 
  addCollaborator, 
  removeCollaborator 
} from '../controllers/repositoriesController.js';
import { 
  getTree, 
  getFile, 
  getReadme, 
  getBranches, 
  createBranch, 
  deleteBranch, 
  getCommits, 
  getCommitDetails, 
  createWebCommit 
} from '../controllers/gitOperationsController.js';
import { 
  getPullRequests, 
  getPullRequestByNumber, 
  getPullRequestDiff, 
  createPullRequest, 
  submitReview, 
  addComment, 
  mergePullRequest, 
  closePullRequest 
} from '../controllers/pullRequestsController.js';
import { 
  getIssues, 
  getIssueByNumber, 
  createIssue, 
  updateIssue, 
  addIssueComment, 
  getRepositoryLabels 
} from '../controllers/issuesController.js';
import { getRepositoryActivities } from '../controllers/activityController.js';

const router = Router();

// 1. Repositories CRUD & Collaborators
router.get('/repos', getRepositories);
router.post('/repos', createRepository);
router.get('/repos/:owner/:repo', getRepositoryBySlug);
router.put('/repos/:id', updateRepository);
router.post('/repos/:id/collaborators', addCollaborator);
router.delete('/repos/:id/collaborators/:userId', removeCollaborator);

// 2. Git Files, Trees & Readme
router.get('/repos/:owner/:repo/tree', getTree);
router.get('/repos/:owner/:repo/blob', getFile);
router.get('/repos/:owner/:repo/readme', getReadme);

// 3. Branches
router.get('/repos/:owner/:repo/branches', getBranches);
router.post('/repos/:owner/:repo/branches', createBranch);
router.delete('/repos/:owner/:repo/branches/:branch', deleteBranch);

// 4. Commits & Web Commit Editor
router.get('/repos/:owner/:repo/commits', getCommits);
router.get('/repos/:owner/:repo/commits/:hash', getCommitDetails);
router.post('/repos/:owner/:repo/commits', createWebCommit);

// 5. Pull Requests & Code Reviews
router.get('/repos/:owner/:repo/pulls', getPullRequests);
router.post('/repos/:owner/:repo/pulls', createPullRequest);
router.get('/repos/:owner/:repo/pulls/:number', getPullRequestByNumber);
router.get('/repos/:owner/:repo/pulls/:number/diff', getPullRequestDiff);
router.post('/repos/:owner/:repo/pulls/:number/reviews', submitReview);
router.post('/repos/:owner/:repo/pulls/:number/comments', addComment);
router.post('/repos/:owner/:repo/pulls/:number/merge', mergePullRequest);
router.post('/repos/:owner/:repo/pulls/:number/close', closePullRequest);

// 6. Issues & Task Tracking
router.get('/repos/:owner/:repo/issues', getIssues);
router.post('/repos/:owner/:repo/issues', createIssue);
router.get('/repos/:owner/:repo/issues/:number', getIssueByNumber);
router.patch('/repos/:owner/:repo/issues/:number', updateIssue);
router.post('/repos/:owner/:repo/issues/:number/comments', addIssueComment);
router.get('/repos/:owner/:repo/labels', getRepositoryLabels);

// 7. Activity stream
router.get('/repos/:owner/:repo/activities', getRepositoryActivities);

export default router;
