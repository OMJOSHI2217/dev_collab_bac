import { execFile, spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export function getGitBinary(): string {
  if (process.platform === 'win32') {
    if (fs.existsSync('C:\\Program Files\\Git\\cmd\\git.exe')) return 'C:\\Program Files\\Git\\cmd\\git.exe';
    if (fs.existsSync('C:\\Program Files\\Git\\bin\\git.exe')) return 'C:\\Program Files\\Git\\bin\\git.exe';
  }
  return 'git';
}

export function resolveRepoDiskPath(rawPath: string): string {
  const norm = (rawPath || '').replace(/^[\\\/]+/, '');
  const pDirect = path.resolve(process.cwd(), norm);
  if (fs.existsSync(pDirect)) return pDirect;

  const pServer = path.resolve(process.cwd(), 'server', norm);
  if (fs.existsSync(pServer)) return pServer;

  const pNoServer = path.resolve(process.cwd(), norm.replace(/^server[\\\/]/, ''));
  if (fs.existsSync(pNoServer)) return pNoServer;

  return pServer;
}

function getGitEnv(customEnv?: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const gitPath = 'C:\\Program Files\\Git\\cmd;C:\\Program Files\\Git\\bin;C:\\Program Files\\Git\\mingw64\\bin;' + (process.env.PATH || process.env.Path || '');
  return {
    ...process.env,
    PATH: gitPath,
    Path: gitPath,
    SystemRoot: process.env.SystemRoot || 'C:\\Windows',
    ...customEnv
  };
}

export interface GitTreeItem {
  mode: string;
  type: 'blob' | 'tree' | 'commit';
  hash: string;
  size?: number;
  name: string;
  path: string;
}

export interface GitCommit {
  hash: string;
  shortHash: string;
  authorName: string;
  authorEmail: string;
  timestamp: number;
  date: string;
  message: string;
}

export interface GitDiffFile {
  oldPath: string;
  newPath: string;
  additions: number;
  deletions: number;
  isNew: boolean;
  isDeleted: boolean;
  isRenamed: boolean;
  patch: string;
}

export class GitService {
  private static async runGit(
    args: string[], 
    cwd?: string, 
    env?: NodeJS.ProcessEnv, 
    stdin?: string | Buffer
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const gitBin = getGitBinary();
      const child = execFile(gitBin, args, {
        cwd,
        env: getGitEnv(env),
        maxBuffer: 50 * 1024 * 1024,
        encoding: 'utf8'
      }, (error, stdout, stderr) => {
        if (error) {
          return reject(new Error(stderr || error.message));
        }
        resolve(stdout);
      });

      if (stdin && child.stdin) {
        child.stdin.write(stdin);
        child.stdin.end();
      }
    });
  }

  /**
   * Initializes a new bare repository on the filesystem.
   */
  static async initBareRepo(diskPath: string, defaultBranch = 'main'): Promise<void> {
    const fullPath = path.resolve(diskPath);
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true });
    }

    await this.runGit(['init', '--bare', fullPath]);
    await this.runGit(['symbolic-ref', 'HEAD', `refs/heads/${defaultBranch}`], fullPath);
    await this.runGit(['config', 'http.receivepack', 'true'], fullPath);
    await this.runGit(['config', 'core.logAllRefUpdates', 'true'], fullPath);
  }

  /**
   * Seeds an initial commit with files into a bare repository using Git plumbing.
   */
  static async seedInitialCommit(
    diskPath: string,
    author: { name: string; email: string },
    files: { path: string; content: string }[],
    branch = 'main',
    message = 'Initial commit'
  ): Promise<string> {
    const fullPath = path.resolve(diskPath);
    const tempIndex = path.join(os.tmpdir(), `devcollab-index-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);

    try {
      const env: NodeJS.ProcessEnv = {
        GIT_DIR: fullPath,
        GIT_INDEX_FILE: tempIndex,
        GIT_AUTHOR_NAME: author.name,
        GIT_AUTHOR_EMAIL: author.email,
        GIT_COMMITTER_NAME: author.name,
        GIT_COMMITTER_EMAIL: author.email
      };

      // Add each file as a blob and stage in index
      for (const file of files) {
        const cleanPath = file.path.replace(/^\/+/, '');
        const blobHash = (await this.runGit(['hash-object', '-w', '--stdin'], fullPath, env, file.content)).trim();
        await this.runGit(['update-index', '--add', '--cacheinfo', '100644', blobHash, cleanPath], fullPath, env);
      }

      // Write tree
      const treeHash = (await this.runGit(['write-tree'], fullPath, env)).trim();

      // Commit tree
      const commitHash = (await this.runGit(['commit-tree', treeHash, '-m', message], fullPath, env)).trim();

      // Update branch ref
      await this.runGit(['update-ref', `refs/heads/${branch}`, commitHash], fullPath, env);
      await this.runGit(['symbolic-ref', 'HEAD', `refs/heads/${branch}`], fullPath, env);

      return commitHash;
    } finally {
      if (fs.existsSync(tempIndex)) {
        try { fs.unlinkSync(tempIndex); } catch {}
      }
    }
  }

  /**
   * Lists all branches in the repository.
   */
  static async listBranches(diskPath: string): Promise<{ name: string; isDefault: boolean; lastCommit: string; lastCommitDate: string; lastCommitMessage: string }[]> {
    const fullPath = path.resolve(diskPath);
    if (!fs.existsSync(fullPath)) return [];

    try {
      let defaultBranch = 'main';
      try {
        const headRef = (await this.runGit(['symbolic-ref', '--short', 'HEAD'], fullPath)).trim();
        if (headRef) defaultBranch = headRef;
      } catch {}

      const output = await this.runGit([
        'for-each-ref',
        '--format=%(refname:short)|%(objectname)|%(committerdate:iso8601)|%(subject)',
        'refs/heads/'
      ], fullPath);

      const lines = output.trim().split('\n').filter(Boolean);
      return lines.map(line => {
        const [name, lastCommit, lastCommitDate, ...msgParts] = line.split('|');
        return {
          name,
          isDefault: name === defaultBranch,
          lastCommit,
          lastCommitDate,
          lastCommitMessage: msgParts.join('|')
        };
      });
    } catch {
      return [];
    }
  }

  /**
   * Creates a new branch from a base branch.
   */
  static async createBranch(diskPath: string, newBranch: string, baseBranch = 'main'): Promise<void> {
    const fullPath = path.resolve(diskPath);
    await this.runGit(['branch', newBranch, baseBranch], fullPath);
  }

  /**
   * Deletes a branch.
   */
  static async deleteBranch(diskPath: string, branch: string): Promise<void> {
    const fullPath = path.resolve(diskPath);
    await this.runGit(['branch', '-D', branch], fullPath);
  }

  /**
   * Retrieves the commit log for a branch.
   */
  static async getCommitLog(diskPath: string, branch = 'main', limit = 50): Promise<GitCommit[]> {
    const fullPath = path.resolve(diskPath);
    if (!fs.existsSync(fullPath)) return [];

    try {
      const output = await this.runGit([
        'log',
        `refs/heads/${branch}`,
        `--pretty=format:%H|%h|%an|%ae|%at|%s`,
        `-n`,
        String(limit)
      ], fullPath);

      if (!output.trim()) return [];

      return output.trim().split('\n').filter(Boolean).map(line => {
        const [hash, shortHash, authorName, authorEmail, timestampStr, ...msgParts] = line.split('|');
        const ts = parseInt(timestampStr, 10) * 1000;
        return {
          hash,
          shortHash,
          authorName,
          authorEmail,
          timestamp: ts,
          date: new Date(ts).toLocaleString(),
          message: msgParts.join('|')
        };
      });
    } catch {
      return [];
    }
  }

  /**
   * Retrieves detailed information and unified diff for a single commit.
   */
  static async getCommitDetails(diskPath: string, commitHash: string): Promise<{
    commit: GitCommit;
    stat: string;
    diff: string;
    files: { path: string; additions: number; deletions: number }[];
  }> {
    const fullPath = path.resolve(diskPath);
    const header = await this.runGit(['show', '--pretty=format:%H|%h|%an|%ae|%at|%s', '--no-patch', commitHash], fullPath);
    const [hash, shortHash, authorName, authorEmail, timestampStr, ...msgParts] = header.trim().split('|');
    const ts = parseInt(timestampStr, 10) * 1000;

    const stat = await this.runGit(['show', '--stat', '--oneline', commitHash], fullPath);
    const diff = await this.runGit(['show', commitHash], fullPath);

    const numstat = await this.runGit(['show', '--numstat', '--pretty=format:', commitHash], fullPath);
    const files: { path: string; additions: number; deletions: number }[] = [];
    for (const line of numstat.trim().split('\n')) {
      if (!line.trim()) continue;
      const [add, del, filePath] = line.split('\t');
      files.push({
        path: filePath,
        additions: parseInt(add, 10) || 0,
        deletions: parseInt(del, 10) || 0
      });
    }

    return {
      commit: {
        hash,
        shortHash,
        authorName,
        authorEmail,
        timestamp: ts,
        date: new Date(ts).toLocaleString(),
        message: msgParts.join('|')
      },
      stat,
      diff,
      files
    };
  }

  /**
   * Lists files and subdirectories at a given path in a branch.
   */
  static async getTree(diskPath: string, branch = 'main', subPath = ''): Promise<GitTreeItem[]> {
    const fullPath = path.resolve(diskPath);
    if (!fs.existsSync(fullPath)) return [];

    try {
      const treeIsh = subPath ? `${branch}:${subPath.replace(/^\/+|\/+$/g, '')}` : branch;
      const output = await this.runGit(['ls-tree', '-l', treeIsh], fullPath);
      if (!output.trim()) return [];

      const items: GitTreeItem[] = [];
      const lines = output.trim().split('\n').filter(Boolean);

      for (const line of lines) {
        // Format: <mode> <type> <hash> <size>\t<name>
        const tabParts = line.split('\t');
        const metaParts = tabParts[0].split(/\s+/);
        const name = tabParts[1];
        const mode = metaParts[0];
        const type = metaParts[1] as 'blob' | 'tree' | 'commit';
        const hash = metaParts[2];
        const sizeStr = metaParts[3];
        const size = sizeStr !== '-' ? parseInt(sizeStr, 10) : undefined;

        const currentPath = subPath ? `${subPath.replace(/\/+$/, '')}/${name}` : name;

        items.push({
          mode,
          type,
          hash,
          size,
          name,
          path: currentPath
        });
      }

      // Sort: directories (tree) first, then files (blob) alphabetically
      return items.sort((a, b) => {
        if (a.type === 'tree' && b.type !== 'tree') return -1;
        if (a.type !== 'tree' && b.type === 'tree') return 1;
        return a.name.localeCompare(b.name);
      });
    } catch {
      return [];
    }
  }

  /**
   * Retrieves the content of a file in a branch.
   */
  static async getFileContent(diskPath: string, branch = 'main', filePath: string): Promise<{ content: string; size: number; isBinary: boolean }> {
    const fullPath = path.resolve(diskPath);
    const cleanPath = filePath.replace(/^\/+/, '');

    const buffer = await new Promise<Buffer>((resolve, reject) => {
      execFile(getGitBinary(), ['show', `${branch}:${cleanPath}`], {
        cwd: fullPath,
        env: getGitEnv(),
        encoding: 'buffer',
        maxBuffer: 25 * 1024 * 1024
      }, (err, stdout, stderr) => {
        if (err) return reject(new Error(stderr.toString() || err.message));
        resolve(stdout);
      });
    });

    // Detect if binary file
    let isBinary = false;
    for (let i = 0; i < Math.min(buffer.length, 1024); i++) {
      if (buffer[i] === 0) {
        isBinary = true;
        break;
      }
    }

    const content = isBinary ? buffer.toString('base64') : buffer.toString('utf8');
    return {
      content,
      size: buffer.length,
      isBinary
    };
  }

  /**
   * Searches for and returns the README file in a branch if present.
   */
  static async getReadme(diskPath: string, branch = 'main'): Promise<{ fileName: string; content: string } | null> {
    const tree = await this.getTree(diskPath, branch, '');
    const readmeItem = tree.find(item => item.type === 'blob' && /^readme(\.md|\.txt|\.markdown)?$/i.test(item.name));
    if (!readmeItem) return null;

    const file = await this.getFileContent(diskPath, branch, readmeItem.name);
    return {
      fileName: readmeItem.name,
      content: file.content
    };
  }

  /**
   * Commits one or more file changes (create, edit, delete) directly into a branch.
   */
  static async createWebCommit(
    diskPath: string,
    author: { name: string; email: string },
    branch: string,
    message: string,
    actions: { action: 'create' | 'update' | 'delete'; path: string; content?: string }[]
  ): Promise<string> {
    const fullPath = path.resolve(diskPath);
    const tempIndex = path.join(os.tmpdir(), `devcollab-commit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);

    try {
      const env: NodeJS.ProcessEnv = {
        GIT_DIR: fullPath,
        GIT_INDEX_FILE: tempIndex,
        GIT_AUTHOR_NAME: author.name,
        GIT_AUTHOR_EMAIL: author.email,
        GIT_COMMITTER_NAME: author.name,
        GIT_COMMITTER_EMAIL: author.email
      };

      // Read current branch tree into temporary index
      let parentCommit = '';
      try {
        parentCommit = (await this.runGit(['rev-parse', `refs/heads/${branch}`], fullPath)).trim();
        await this.runGit(['read-tree', parentCommit], fullPath, env);
      } catch {
        // New empty branch
      }

      for (const action of actions) {
        const cleanPath = action.path.replace(/^\/+/, '');
        if (action.action === 'delete') {
          await this.runGit(['update-index', '--force-remove', cleanPath], fullPath, env);
        } else {
          const content = action.content || '';
          const blobHash = (await this.runGit(['hash-object', '-w', '--stdin'], fullPath, env, content)).trim();
          await this.runGit(['update-index', '--add', '--cacheinfo', '100644', blobHash, cleanPath], fullPath, env);
        }
      }

      const treeHash = (await this.runGit(['write-tree'], fullPath, env)).trim();

      const commitArgs = ['commit-tree', treeHash, '-m', message];
      if (parentCommit) {
        commitArgs.push('-p', parentCommit);
      }

      const newCommitHash = (await this.runGit(commitArgs, fullPath, env)).trim();
      await this.runGit(['update-ref', `refs/heads/${branch}`, newCommitHash], fullPath, env);

      return newCommitHash;
    } finally {
      if (fs.existsSync(tempIndex)) {
        try { fs.unlinkSync(tempIndex); } catch {}
      }
    }
  }

  /**
   * Computes the diff between two branches or commits (target vs source).
   */
  static async getDiff(diskPath: string, baseBranch: string, headBranch: string): Promise<{
    files: GitDiffFile[];
    totalAdditions: number;
    totalDeletions: number;
    rawDiff: string;
  }> {
    const fullPath = path.resolve(diskPath);

    let rawDiff = '';
    try {
      rawDiff = await this.runGit(['diff', `${baseBranch}...${headBranch}`], fullPath);
    } catch {
      return { files: [], totalAdditions: 0, totalDeletions: 0, rawDiff: '' };
    }

    let numstat = '';
    try {
      numstat = await this.runGit(['diff', '--numstat', `${baseBranch}...${headBranch}`], fullPath);
    } catch {}

    const fileMap = new Map<string, { additions: number; deletions: number }>();
    let totalAdditions = 0;
    let totalDeletions = 0;

    for (const line of numstat.trim().split('\n')) {
      if (!line.trim()) continue;
      const [add, del, filePath] = line.split('\t');
      const additions = parseInt(add, 10) || 0;
      const deletions = parseInt(del, 10) || 0;
      totalAdditions += additions;
      totalDeletions += deletions;
      fileMap.set(filePath, { additions, deletions });
    }

    // Parse raw diff into individual file patches
    const files: GitDiffFile[] = [];
    const patches = rawDiff.split('diff --git ');

    for (const patch of patches) {
      if (!patch.trim()) continue;
      const lines = patch.split('\n');
      const headerLine = lines[0]; // e.g. "a/src/App.tsx b/src/App.tsx"
      const match = headerLine.match(/^a\/(.+?)\s+b\/(.+)$/);
      const oldPath = match ? match[1] : '';
      const newPath = match ? match[2] : oldPath;

      const isNew = patch.includes('new file mode');
      const isDeleted = patch.includes('deleted file mode');
      const isRenamed = patch.includes('similarity index');

      const stats = fileMap.get(newPath) || fileMap.get(oldPath) || { additions: 0, deletions: 0 };

      files.push({
        oldPath,
        newPath,
        additions: stats.additions,
        deletions: stats.deletions,
        isNew,
        isDeleted,
        isRenamed,
        patch: `diff --git ${patch}`
      });
    }

    return {
      files,
      totalAdditions,
      totalDeletions,
      rawDiff
    };
  }

  /**
   * Tests whether a Pull Request can be cleanly merged or has conflicts using modern git merge-tree.
   */
  static async checkMergeConflict(diskPath: string, targetBranch: string, sourceBranch: string): Promise<{
    canMerge: boolean;
    conflicts: string[];
    mergeTreeHash?: string;
  }> {
    const fullPath = path.resolve(diskPath);

    return new Promise((resolve) => {
      execFile(getGitBinary(), ['merge-tree', '--write-tree', targetBranch, sourceBranch], {
        cwd: fullPath,
        env: getGitEnv(),
        encoding: 'utf8'
      }, (err, stdout, stderr) => {
        if (!err && stdout.trim()) {
          const lines = stdout.trim().split('\n');
          const mergeTreeHash = lines[0].trim();
          return resolve({
            canMerge: true,
            conflicts: [],
            mergeTreeHash
          });
        }

        // Conflicts found
        const output = (stdout || '') + (stderr || '');
        const conflictFiles: string[] = [];
        const lines = output.split('\n');
        for (const line of lines) {
          if (line.includes('CONFLICT') || line.includes('Auto-merging')) {
            const m = line.match(/(?:CONFLICT.*?in|Auto-merging)\s+(.+)$/);
            if (m && !conflictFiles.includes(m[1].trim())) {
              conflictFiles.push(m[1].trim());
            }
          }
        }

        resolve({
          canMerge: false,
          conflicts: conflictFiles.length > 0 ? conflictFiles : ['Merge conflicts detected in branches']
        });
      });
    });
  }

  /**
   * Performs an actual Git merge for a Pull Request on the server.
   */
  static async mergePullRequest(
    diskPath: string,
    author: { name: string; email: string },
    targetBranch: string,
    sourceBranch: string,
    commitMessage: string
  ): Promise<string> {
    const fullPath = path.resolve(diskPath);
    const check = await this.checkMergeConflict(diskPath, targetBranch, sourceBranch);

    if (!check.canMerge || !check.mergeTreeHash) {
      throw new Error(`Cannot merge: Unresolved conflicts in [${check.conflicts.join(', ')}]`);
    }

    const targetCommit = (await this.runGit(['rev-parse', `refs/heads/${targetBranch}`], fullPath)).trim();
    const sourceCommit = (await this.runGit(['rev-parse', `refs/heads/${sourceBranch}`], fullPath)).trim();

    const env: NodeJS.ProcessEnv = {
      GIT_DIR: fullPath,
      GIT_AUTHOR_NAME: author.name,
      GIT_AUTHOR_EMAIL: author.email,
      GIT_COMMITTER_NAME: author.name,
      GIT_COMMITTER_EMAIL: author.email
    };

    // Create merge commit with two parents (target and source)
    const mergeCommitHash = (await this.runGit([
      'commit-tree',
      check.mergeTreeHash,
      '-p', targetCommit,
      '-p', sourceCommit,
      '-m', commitMessage
    ], fullPath, env)).trim();

    // Advance target branch ref
    await this.runGit(['update-ref', `refs/heads/${targetBranch}`, mergeCommitHash], fullPath, env);

    return mergeCommitHash;
  }
}
