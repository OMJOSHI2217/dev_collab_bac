CREATE DATABASE IF NOT EXISTS devcollab_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE devcollab_db;

-- 1. Users table (Stores complete developer profile including high-res base64 or URL profile pictures in avatar LONGTEXT)
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  username VARCHAR(80) NOT NULL UNIQUE,
  email VARCHAR(180) NOT NULL UNIQUE,
  password VARCHAR(255),
  phone VARCHAR(40),
  avatar LONGTEXT,
  role VARCHAR(80) NOT NULL,
  specialization TEXT,
  experience_level VARCHAR(60),
  years_of_experience INT DEFAULT 0,
  bio TEXT,
  city VARCHAR(100),
  country VARCHAR(100),
  availability VARCHAR(60),
  social_links JSON,  
  privacy JSON,
  projects_count INT DEFAULT 0,
  connections_count INT DEFAULT 0,
  compatibility_score INT DEFAULT 85,
  is_online BOOLEAN DEFAULT false,
  last_active VARCHAR(60),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 2. User Skills table
CREATE TABLE IF NOT EXISTS user_skills (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL,
  skill_name VARCHAR(80) NOT NULL,
  category VARCHAR(60) DEFAULT 'general',
  level VARCHAR(40) DEFAULT 'Intermediate',
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_skill (user_id, skill_name)
);

-- 3. Connection Requests table
CREATE TABLE IF NOT EXISTS connection_requests (
  id VARCHAR(64) PRIMARY KEY,
  from_user_id VARCHAR(64) NOT NULL,
  to_user_id VARCHAR(64) NOT NULL,
  status ENUM('pending', 'accepted', 'declined') DEFAULT 'pending',
  message TEXT,
  project_interest VARCHAR(180),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (from_user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (to_user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_request_users (from_user_id, to_user_id)
);

-- 4. Projects table
CREATE TABLE IF NOT EXISTS projects (
  id VARCHAR(64) PRIMARY KEY,
  title VARCHAR(180) NOT NULL,
  tagline TEXT,
  description TEXT,
  goals JSON,
  technologies JSON,
  owner_id VARCHAR(64) NOT NULL,
  status VARCHAR(60) DEFAULT 'Recruiting Collaborators',
  visibility VARCHAR(40) DEFAULT 'public',
  github_repo JSON,
  open_roles_needed JSON,
  estimated_duration VARCHAR(60),
  live_url TEXT,
  applications_count INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 5. Project Contributors table
CREATE TABLE IF NOT EXISTS project_contributors (
  id INT AUTO_INCREMENT PRIMARY KEY,
  project_id VARCHAR(64) NOT NULL,
  user_id VARCHAR(64) NOT NULL,
  role VARCHAR(100) NOT NULL,
  joined_at VARCHAR(60),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY unique_proj_user (project_id, user_id)
);

-- 6. Conversations table
CREATE TABLE IF NOT EXISTS conversations (
  id VARCHAR(64) PRIMARY KEY,
  type ENUM('direct', 'project') DEFAULT 'direct',
  project_id VARCHAR(64),
  project_name VARCHAR(180),
  project_context VARCHAR(180),
  project_roles JSON,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 7. Conversation Participants table
CREATE TABLE IF NOT EXISTS conversation_participants (
  id INT AUTO_INCREMENT PRIMARY KEY,
  conversation_id VARCHAR(64) NOT NULL,
  user_id VARCHAR(64) NOT NULL,
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY unique_conv_user (conversation_id, user_id)
);

-- 8. Messages table (Supports base64 or URL profile pictures in sender_avatar LONGTEXT)
CREATE TABLE IF NOT EXISTS messages (
  id VARCHAR(64) PRIMARY KEY,
  conversation_id VARCHAR(64) NOT NULL,
  sender_id VARCHAR(64) NOT NULL,
  sender_name VARCHAR(120),
  sender_avatar LONGTEXT,
  project_role VARCHAR(100),
  text TEXT NOT NULL,
  timestamp VARCHAR(60),
  attachments JSON,
  is_read BOOLEAN DEFAULT false,
  is_system BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
  INDEX idx_conv_created (conversation_id, created_at)
);

-- 9. Project History (Completed Portfolio) table
CREATE TABLE IF NOT EXISTS project_history (
  id VARCHAR(64) PRIMARY KEY,
  title VARCHAR(180) NOT NULL,
  tagline TEXT,
  description TEXT,
  completed_date VARCHAR(60),
  live_url TEXT,
  github_url TEXT,
  technologies JSON,
  collaborators JSON,
  testimonial JSON,
  metrics JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 10. Repositories table (Real Git engine metadata)
CREATE TABLE IF NOT EXISTS repositories (
  id VARCHAR(64) PRIMARY KEY,
  project_id VARCHAR(64),
  name VARCHAR(120) NOT NULL,
  slug VARCHAR(180) NOT NULL UNIQUE,
  description TEXT,
  owner_id VARCHAR(64) NOT NULL,
  visibility ENUM('public', 'private') DEFAULT 'public',
  default_branch VARCHAR(80) DEFAULT 'main',
  disk_path VARCHAR(255) NOT NULL,
  stars_count INT DEFAULT 0,
  forks_count INT DEFAULT 0,
  open_issues_count INT DEFAULT 0,
  open_prs_count INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
  FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_repo_owner (owner_id),
  INDEX idx_repo_project (project_id)
);

-- 11. Repository Members (Role-based access control)
CREATE TABLE IF NOT EXISTS repository_members (
  id INT AUTO_INCREMENT PRIMARY KEY,
  repository_id VARCHAR(64) NOT NULL,
  user_id VARCHAR(64) NOT NULL,
  role ENUM('owner', 'collaborator', 'reviewer') DEFAULT 'collaborator',
  can_push BOOLEAN DEFAULT true,
  can_merge BOOLEAN DEFAULT true,
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (repository_id) REFERENCES repositories(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY unique_repo_user (repository_id, user_id)
);

-- 12. Repository Branches metadata
CREATE TABLE IF NOT EXISTS repository_branches (
  id INT AUTO_INCREMENT PRIMARY KEY,
  repository_id VARCHAR(64) NOT NULL,
  name VARCHAR(100) NOT NULL,
  is_protected BOOLEAN DEFAULT false,
  is_default BOOLEAN DEFAULT false,
  created_by VARCHAR(64),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (repository_id) REFERENCES repositories(id) ON DELETE CASCADE,
  UNIQUE KEY unique_repo_branch (repository_id, name)
);

-- 13. Pull Requests table
CREATE TABLE IF NOT EXISTS pull_requests (
  id VARCHAR(64) PRIMARY KEY,
  repository_id VARCHAR(64) NOT NULL,
  number INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  author_id VARCHAR(64) NOT NULL,
  source_branch VARCHAR(100) NOT NULL,
  target_branch VARCHAR(100) NOT NULL,
  status ENUM('open', 'merged', 'closed') DEFAULT 'open',
  mergeable_state ENUM('clean', 'conflict', 'unknown') DEFAULT 'clean',
  merged_by VARCHAR(64),
  merged_at TIMESTAMP NULL,
  closed_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (repository_id) REFERENCES repositories(id) ON DELETE CASCADE,
  FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (merged_by) REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE KEY unique_repo_pr_num (repository_id, number),
  INDEX idx_pr_repo_status (repository_id, status)
);

-- 14. Pull Request Reviews
CREATE TABLE IF NOT EXISTS pull_request_reviews (
  id VARCHAR(64) PRIMARY KEY,
  pull_request_id VARCHAR(64) NOT NULL,
  reviewer_id VARCHAR(64) NOT NULL,
  decision ENUM('approved', 'changes_requested', 'commented') DEFAULT 'commented',
  body TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (pull_request_id) REFERENCES pull_requests(id) ON DELETE CASCADE,
  FOREIGN KEY (reviewer_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 15. Pull Request Comments (General and Line-level Code Reviews)
CREATE TABLE IF NOT EXISTS pull_request_comments (
  id VARCHAR(64) PRIMARY KEY,
  pull_request_id VARCHAR(64) NOT NULL,
  user_id VARCHAR(64) NOT NULL,
  file_path VARCHAR(255),
  line_number INT,
  diff_hunk TEXT,
  body TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (pull_request_id) REFERENCES pull_requests(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 16. Issues table
CREATE TABLE IF NOT EXISTS issues (
  id VARCHAR(64) PRIMARY KEY,
  repository_id VARCHAR(64) NOT NULL,
  number INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  author_id VARCHAR(64) NOT NULL,
  assignee_id VARCHAR(64),
  status ENUM('open', 'closed') DEFAULT 'open',
  priority ENUM('low', 'medium', 'high', 'urgent') DEFAULT 'medium',
  closed_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (repository_id) REFERENCES repositories(id) ON DELETE CASCADE,
  FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (assignee_id) REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE KEY unique_repo_issue_num (repository_id, number),
  INDEX idx_issue_repo_status (repository_id, status)
);

-- 17. Issue Labels table
CREATE TABLE IF NOT EXISTS issue_labels (
  id INT AUTO_INCREMENT PRIMARY KEY,
  repository_id VARCHAR(64) NOT NULL,
  name VARCHAR(50) NOT NULL,
  color VARCHAR(20) DEFAULT '#0d9488',
  description VARCHAR(180),
  FOREIGN KEY (repository_id) REFERENCES repositories(id) ON DELETE CASCADE,
  UNIQUE KEY unique_repo_label (repository_id, name)
);

-- 18. Issue Label Mappings table
CREATE TABLE IF NOT EXISTS issue_label_mappings (
  issue_id VARCHAR(64) NOT NULL,
  label_id INT NOT NULL,
  PRIMARY KEY (issue_id, label_id),
  FOREIGN KEY (issue_id) REFERENCES issues(id) ON DELETE CASCADE,
  FOREIGN KEY (label_id) REFERENCES issue_labels(id) ON DELETE CASCADE
);

-- 19. Issue Comments table
CREATE TABLE IF NOT EXISTS issue_comments (
  id VARCHAR(64) PRIMARY KEY,
  issue_id VARCHAR(64) NOT NULL,
  user_id VARCHAR(64) NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (issue_id) REFERENCES issues(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 20. Repository Activities table (Audit & Live Event stream)
CREATE TABLE IF NOT EXISTS repository_activities (
  id INT AUTO_INCREMENT PRIMARY KEY,
  repository_id VARCHAR(64) NOT NULL,
  user_id VARCHAR(64) NOT NULL,
  action_type ENUM('push', 'branch_created', 'branch_deleted', 'pr_opened', 'pr_merged', 'pr_closed', 'issue_opened', 'issue_closed', 'member_added') NOT NULL,
  details JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (repository_id) REFERENCES repositories(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_repo_activity (repository_id, created_at)
);
