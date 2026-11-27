import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';
import { GitService } from '../services/gitService.js';

dotenv.config();

async function runSeed() {
  const host = process.env.DB_HOST || 'localhost';
  const port = Number(process.env.DB_PORT) || 3306;
  const user = process.env.DB_USER || 'root';
  const password = process.env.DB_PASSWORD || '';
  const database = process.env.DB_NAME || 'devcollab_db';

  console.log(`🌱 Seeding complete DevCollab website data into MySQL "${database}"...`);

  try {
    const conn = await mysql.createConnection({
      host,
      port,
      user,
      password,
      database,
      multipleStatements: true
    });

    // 1. Seed Current User
    await conn.query(`
      INSERT INTO users (
        id, name, username, email, password, phone, avatar, role, specialization, 
        experience_level, years_of_experience, bio, city, country, availability, 
        social_links, privacy, projects_count, connections_count, compatibility_score, is_online, last_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE 
        name=VALUES(name), phone=VALUES(phone), avatar=VALUES(avatar), password=VALUES(password),
        role=VALUES(role), bio=VALUES(bio), city=VALUES(city);
    `, [
      'user_current',
      'Alex Rivera',
      'alexrivera_dev',
      'alex.rivera@devcollab.io',
      'password123',
      '+1 (415) 892-3490',
      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=250',
      'Backend Developer',
      'Distributed Systems & High-Throughput APIs',
      'Senior (5-8 yrs)',
      6,
      'Passionate about building scalable backend services, microservices architecture, and real-time streaming pipelines. Currently looking to partner with skilled Frontend and UI/UX developers to build open-source developer tooling.',
      'San Francisco',
      'United States',
      'Part-Time (10-15h/wk)',
      JSON.stringify({
        github: 'https://github.com/alexrivera-dev',
        linkedin: 'https://linkedin.com/in/alexrivera-dev',
        portfolio: 'https://alexrivera.dev',
        twitter: 'https://x.com/alexrivera_code'
      }),
      JSON.stringify({
        profileVisibility: 'public',
        showExactLocation: true,
        showSocialLinksPublicly: true,
        showPhoneToConnections: true,
        allowProjectInvites: true,
        showOnlineStatus: true
      }),
      8,
      14,
      100,
      true,
      'Just now'
    ]);

    // Current User Skills
    const currentUserSkills = ['Go', 'Node.js', 'PostgreSQL', 'Docker', 'Kubernetes', 'Redis', 'GraphQL', 'gRPC', 'AWS'];
    await conn.query('DELETE FROM user_skills WHERE user_id = ?', ['user_current']);
    for (const skill of currentUserSkills) {
      await conn.query('INSERT INTO user_skills (user_id, skill_name) VALUES (?, ?)', ['user_current', skill]);
    }

    // 2. Seed All Developers
    const allDevelopers = [
      {
        id: 'user_1',
        name: 'Elena Rostova',
        username: 'elena_codes',
        email: 'elena.rostova@example.com',
        phone: '+49 30 5683 9281',
        avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=250',
        role: 'Frontend Developer',
        specialization: 'Interactive 3D WebGL & Modern React Architectures',
        experience_level: 'Senior (5-8 yrs)',
        years_of_experience: 5,
        bio: 'Crafting responsive, tactile, and performant web interfaces. Big fan of WebGL, Tailwind, and React Server Components. Seeking backend partners to ship ambitious SaaS tools.',
        city: 'San Francisco',
        country: 'United States',
        availability: 'Part-Time (10-15h/wk)',
        social_links: { github: 'https://github.com/elena-codes', linkedin: 'https://linkedin.com/in/elenarostova', portfolio: 'https://elena.design-code.io' },
        privacy: { profileVisibility: 'public', showExactLocation: true, showSocialLinksPublicly: false, showPhoneToConnections: true, allowProjectInvites: true, showOnlineStatus: true },
        projects_count: 12,
        connections_count: 42,
        compatibility_score: 99,
        is_online: true,
        last_active: 'Online',
        skills: ['React', 'TypeScript', 'Next.js', 'Tailwind CSS', 'Three.js', 'WebGL', 'Zustand', 'Vite']
      },
      {
        id: 'user_2',
        name: 'Sofia Martinez',
        username: 'sofia_ux',
        email: 'sofia.design@example.com',
        phone: '+34 93 412 8790',
        avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&q=80&w=250',
        role: 'UI/UX & Product Designer',
        specialization: 'Design Systems, Micro-interactions & Developer Ergonomics',
        experience_level: 'Mid-Level (2-5 yrs)',
        years_of_experience: 4,
        bio: 'I turn complex technical workflows into dead-simple, accessible, delightful developer experiences. Proficient in Figma, Design Tokens, and writing production Tailwind code.',
        city: 'Barcelona',
        country: 'Spain',
        availability: 'Weekends & Hackathons',
        social_links: { github: 'https://github.com/sofia-martinez-ux', linkedin: 'https://linkedin.com/in/sofiamartinez', portfolio: 'https://sofia.work' },
        privacy: { profileVisibility: 'public', showExactLocation: true, showSocialLinksPublicly: true, showPhoneToConnections: true, allowProjectInvites: true, showOnlineStatus: true },
        projects_count: 7,
        connections_count: 29,
        compatibility_score: 94,
        is_online: true,
        last_active: '5m ago',
        skills: ['Figma', 'Design Systems', 'Tailwind CSS', 'UI Prototyping', 'User Research', 'HTML/CSS', 'Storybook']
      },
      {
        id: 'user_3',
        name: 'Priya Sharma',
        username: 'priya_ml',
        email: 'priya.sharma@example.com',
        phone: '+91 98450 12894',
        avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=250',
        role: 'AI & Machine Learning Engineer',
        specialization: 'LLM Fine-tuning, RAG Architecture & Vector Search',
        experience_level: 'Senior (5-8 yrs)',
        years_of_experience: 6,
        bio: 'Deep learning researcher turned AI builder. Focused on lightweight fine-tuning, latency-optimized inference, and semantic retrieval agents. Excited to pair with developers building AI-driven products.',
        city: 'Bengaluru',
        country: 'India',
        availability: 'Part-Time (10-15h/wk)',
        social_links: { github: 'https://github.com/priyasharma-ai', linkedin: 'https://linkedin.com/in/priyasharma-ml', portfolio: 'https://priya-ml.dev' },
        privacy: { profileVisibility: 'public', showExactLocation: true, showSocialLinksPublicly: false, showPhoneToConnections: false, allowProjectInvites: true, showOnlineStatus: false },
        projects_count: 9,
        connections_count: 38,
        compatibility_score: 91,
        is_online: false,
        last_active: '2 hours ago',
        skills: ['Python', 'PyTorch', 'LangChain', 'FastAPI', 'Hugging Face', 'Vector DBs (Qdrant)', 'Docker', 'CUDA']
      },
      {
        id: 'user_4',
        name: 'Marcus Chen',
        username: 'marcus_cloud',
        email: 'marcus.chen@example.com',
        phone: '+1 (416) 728-9102',
        avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=250',
        role: 'DevOps & Cloud Engineer',
        specialization: 'Infrastructure as Code, Kubernetes & Zero-Trust CI/CD',
        experience_level: 'Senior (5-8 yrs)',
        years_of_experience: 7,
        bio: 'Automating everything between git push and production. Dedicated to self-healing clusters, multi-region failovers, and cost-efficient cloud setups.',
        city: 'Toronto',
        country: 'Canada',
        availability: 'Part-Time (10-15h/wk)',
        social_links: { github: 'https://github.com/marcuschen-ops', linkedin: 'https://linkedin.com/in/marcus-chen-cloud' },
        privacy: { profileVisibility: 'public', showExactLocation: true, showSocialLinksPublicly: true, showPhoneToConnections: true, allowProjectInvites: true, showOnlineStatus: true },
        projects_count: 15,
        connections_count: 56,
        compatibility_score: 89,
        is_online: true,
        last_active: 'Online',
        skills: ['Kubernetes', 'Terraform', 'AWS', 'GitHub Actions', 'Prometheus', 'Grafana', 'Go', 'Linux', 'Helm']
      },
      {
        id: 'user_5',
        name: 'Liam O’Connor',
        username: 'liam_mobile',
        email: 'liam.mobile@example.com',
        phone: '+353 1 496 0192',
        avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=250',
        role: 'Mobile Developer',
        specialization: 'Cross-Platform React Native & Native Swift iOS',
        experience_level: 'Mid-Level (2-5 yrs)',
        years_of_experience: 3,
        bio: 'Building fluid mobile experiences with 60 FPS gesture animations. Looking for backend wizards who can expose clean, lightning-fast GraphQL or REST endpoints.',
        city: 'Dublin',
        country: 'Ireland',
        availability: 'Weekends & Hackathons',
        social_links: { github: 'https://github.com/liam-mobile-dev', portfolio: 'https://liamdev.app' },
        privacy: { profileVisibility: 'public', showExactLocation: true, showSocialLinksPublicly: true, showPhoneToConnections: true, allowProjectInvites: true, showOnlineStatus: false },
        projects_count: 5,
        connections_count: 22,
        compatibility_score: 88,
        is_online: false,
        last_active: 'Yesterday',
        skills: ['React Native', 'Swift', 'iOS', 'TypeScript', 'Expo', 'GraphQL', 'Tailwind', 'App Store Deploy']
      },
      {
        id: 'user_6',
        name: 'David Kim',
        username: 'david_sys',
        email: 'david.kim@example.com',
        phone: '+1 (206) 555-0198',
        avatar: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&q=80&w=250',
        role: 'Systems & Security Engineer',
        specialization: 'Rust, High-Concurrency Network Daemons & Cryptography',
        experience_level: 'Lead / Staff (8+ yrs)',
        years_of_experience: 9,
        bio: 'Low-level systems enthusiast. Profiling CPU cache misses, asynchronous I/O with Tokio, and building privacy-preserving peer-to-peer protocols.',
        city: 'Seattle',
        country: 'United States',
        availability: 'Advisory & Mentorship',
        social_links: { github: 'https://github.com/davidkim-sys', linkedin: 'https://linkedin.com/in/davidkim-systems' },
        privacy: { profileVisibility: 'public', showExactLocation: false, showSocialLinksPublicly: false, showPhoneToConnections: false, allowProjectInvites: false, showOnlineStatus: true },
        projects_count: 18,
        connections_count: 65,
        compatibility_score: 78,
        is_online: true,
        last_active: 'Online',
        skills: ['Rust', 'C++', 'Linux Kernel', 'Tokio', 'WebAssembly', 'Cryptography', 'Go', 'Docker']
      },
      {
        id: 'user_7',
        name: 'Aisha Diallo',
        username: 'aisha_fullstack',
        email: 'aisha.diallo@example.com',
        phone: '+44 20 7946 0912',
        avatar: 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?auto=format&fit=crop&q=80&w=250',
        role: 'Fullstack Developer',
        specialization: 'Next.js 14, Supabase & Distributed Edge Functions',
        experience_level: 'Mid-Level (2-5 yrs)',
        years_of_experience: 4,
        bio: 'Jack of all trades with a bias for shipping quickly. Love hacking on open source, developer productivity tools, and real-time collaboration engines.',
        city: 'London',
        country: 'United Kingdom',
        availability: 'Part-Time (10-15h/wk)',
        social_links: { github: 'https://github.com/aishadiallo', portfolio: 'https://aishafullstack.com' },
        privacy: { profileVisibility: 'public', showExactLocation: true, showSocialLinksPublicly: true, showPhoneToConnections: true, allowProjectInvites: true, showOnlineStatus: true },
        projects_count: 11,
        connections_count: 34,
        compatibility_score: 92,
        is_online: true,
        last_active: 'Online',
        skills: ['TypeScript', 'Next.js', 'React', 'Node.js', 'PostgreSQL', 'Prisma', 'Tailwind CSS', 'Redis']
      },
      {
        id: 'user_8',
        name: 'Maya Patel',
        username: 'maya_creative_dev',
        email: 'maya.patel@example.com',
        phone: '+1 (512) 670-3841',
        avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=250',
        role: 'Frontend Developer',
        specialization: 'Data Visualizations, Svelte & Canvas Interactions',
        experience_level: 'Junior (0-2 yrs)',
        years_of_experience: 2,
        bio: 'Passionate about creative coding, charts, interactive analytics dashboards and typography. Always eager to learn, pair-program, and contribute to cool web experiments.',
        city: 'Austin',
        country: 'United States',
        availability: 'Full-Time Available',
        social_links: { github: 'https://github.com/mayapatel-dev', linkedin: 'https://linkedin.com/in/mayapatel-creative' },
        privacy: { profileVisibility: 'public', showExactLocation: true, showSocialLinksPublicly: true, showPhoneToConnections: true, allowProjectInvites: true, showOnlineStatus: false },
        projects_count: 4,
        connections_count: 16,
        compatibility_score: 85,
        is_online: false,
        last_active: '3 hours ago',
        skills: ['SvelteKit', 'D3.js', 'React', 'JavaScript', 'Tailwind CSS', 'SVG Animations', 'Chart.js']
      },
      {
        id: 'user_9',
        name: 'Lucas Silva',
        username: 'lucas_data',
        email: 'lucas.silva@example.com',
        phone: '+55 11 98123-4567',
        avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&q=80&w=250',
        role: 'Data Engineer',
        specialization: 'Streaming Pipelines, Apache Kafka & Lakehouse Architecture',
        experience_level: 'Senior (5-8 yrs)',
        years_of_experience: 7,
        bio: 'Architecting batch and streaming data foundations. Looking for AI/ML engineers and Fullstack devs to turn raw data lakes into interactive intelligence dashboards.',
        city: 'São Paulo',
        country: 'Brazil',
        availability: 'Part-Time (10-15h/wk)',
        social_links: { github: 'https://github.com/lucassilva-data' },
        privacy: { profileVisibility: 'public', showExactLocation: true, showSocialLinksPublicly: false, showPhoneToConnections: false, allowProjectInvites: true, showOnlineStatus: false },
        projects_count: 6,
        connections_count: 25,
        compatibility_score: 81,
        is_online: false,
        last_active: '1 day ago',
        skills: ['Python', 'Apache Kafka', 'Apache Spark', 'SQL', 'Snowflake', 'dbt', 'Airflow', 'GCP']
      }
    ];

    for (const dev of allDevelopers) {
      await conn.query(`
        INSERT INTO users (
          id, name, username, email, password, phone, avatar, role, specialization, 
          experience_level, years_of_experience, bio, city, country, availability, 
          social_links, privacy, projects_count, connections_count, compatibility_score, is_online, last_active
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE 
          name=VALUES(name), phone=VALUES(phone), avatar=VALUES(avatar), password=VALUES(password),
          role=VALUES(role), bio=VALUES(bio), city=VALUES(city);
      `, [
        dev.id, dev.name, dev.username, dev.email, 'password123', dev.phone, dev.avatar, dev.role, dev.specialization,
        dev.experience_level, dev.years_of_experience, dev.bio, dev.city, dev.country, dev.availability,
        JSON.stringify(dev.social_links), JSON.stringify(dev.privacy), dev.projects_count,
        dev.connections_count, dev.compatibility_score, dev.is_online, dev.last_active
      ]);

      await conn.query('DELETE FROM user_skills WHERE user_id = ?', [dev.id]);
      for (const skill of dev.skills) {
        await conn.query('INSERT INTO user_skills (user_id, skill_name) VALUES (?, ?)', [dev.id, skill]);
      }
    }
    console.log(`✅ Seeded 10 developers & skills with profile picture avatars.`);

    // 3. Seed Connection Requests
    const connectionRequests = [
      {
        id: 'req_rec_1',
        from_user_id: 'user_1',
        to_user_id: 'user_current',
        status: 'pending',
        message: 'Hey Alex! I saw your work on distributed Go systems. I am building a real-time collaborative canvas with WebGL and need a strong backend partner for the WebSocket sync layer. Would love to collaborate!',
        project_interest: 'Real-time Canvas Sync'
      },
      {
        id: 'req_rec_2',
        from_user_id: 'user_3',
        to_user_id: 'user_current',
        status: 'pending',
        message: 'Hi Alex, loved your GitHub repository on high-throughput microservices. I am working on an LLM-assisted code review engine and we need someone with your backend and Redis caching experience.',
        project_interest: 'AI Code Reviewer Engine'
      },
      {
        id: 'req_sent_1',
        from_user_id: 'user_current',
        to_user_id: 'user_4',
        status: 'pending',
        message: 'Hi Marcus, would love to connect and chat about automated CI/CD for our open-source telemetry engine.',
        project_interest: 'Telemetry Cloud Infra'
      },
      {
        id: 'req_acc_1',
        from_user_id: 'user_2',
        to_user_id: 'user_current',
        status: 'accepted',
        message: 'Accepted your invitation! Looking forward to designing the design system together.',
        project_interest: null
      },
      {
        id: 'req_acc_2',
        from_user_id: 'user_6',
        to_user_id: 'user_current',
        status: 'accepted',
        message: 'Connected. Let us discuss Rust and Go interop whenever you are ready.',
        project_interest: null
      },
      {
        id: 'req_dec_1',
        from_user_id: 'user_current',
        to_user_id: 'user_5',
        status: 'declined',
        message: null,
        project_interest: null
      }
    ];

    for (const req of connectionRequests) {
      await conn.query(`
        INSERT INTO connection_requests (id, from_user_id, to_user_id, status, message, project_interest)
        VALUES (?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE status=VALUES(status), message=VALUES(message);
      `, [req.id, req.from_user_id, req.to_user_id, req.status, req.message, req.project_interest]);
    }
    console.log(`✅ Seeded ${connectionRequests.length} connection requests.`);

    // 4. Seed Active Projects
    const projects = [
      {
        id: 'proj_1',
        title: 'DevPulse Telemetry Engine',
        tagline: 'Lightweight, eBPF-powered real-time service observability for local dev and cloud clusters.',
        description: 'DevPulse is a high-performance open-source telemetry engine designed to inspect microservice network calls, database queries, and distributed latency traces with near-zero overhead.',
        goals: ['Build eBPF kernel probes for Linux HTTP/gRPC traffic', 'Create an intuitive real-time trace visualizer in React + WebGL', 'Support OpenTelemetry export protocols and local docker-compose setups'],
        technologies: ['Go', 'eBPF', 'React', 'TypeScript', 'WebSockets', 'ClickHouse', 'Docker'],
        owner_id: 'user_current',
        status: 'In Active Development',
        visibility: 'public',
        github_repo: { name: 'devcollab-community/devpulse-engine', url: 'https://github.com/devcollab-community/devpulse-engine', stars: 342, forks: 48, openIssues: 12, primaryLanguage: 'Go' },
        open_roles_needed: ['Frontend Developer', 'DevOps & Cloud Engineer'],
        estimated_duration: '3-4 months',
        live_url: 'https://devpulse.devcollab.io',
        applications_count: 4
      },
      {
        id: 'proj_2',
        title: 'NeuralCanvas Studio',
        tagline: 'Collaborative infinite canvas for visual AI prompt engineering and model pipelines.',
        description: 'A shared visual studio where developers and ML engineers can chain prompts, test multi-modal models, compare latent embeddings, and export production TypeScript SDK code.',
        goals: ['Multi-user real-time canvas with CRDT synchronization', 'Pluggable model execution nodes for OpenAI, Claude, and local Ollama', 'Exportable pipeline definitions in JSON and Python'],
        technologies: ['React', 'TypeScript', 'Tailwind CSS', 'FastAPI', 'Python', 'Yjs', 'PyTorch'],
        owner_id: 'user_1',
        status: 'Recruiting Collaborators',
        visibility: 'public',
        github_repo: { name: 'elena-codes/neural-canvas-studio', url: 'https://github.com/elena-codes/neural-canvas-studio', stars: 819, forks: 92, openIssues: 19, primaryLanguage: 'TypeScript' },
        open_roles_needed: ['Backend Developer', 'UI/UX & Product Designer'],
        estimated_duration: '2 months',
        live_url: null,
        applications_count: 7
      },
      {
        id: 'proj_3',
        title: 'CloudKube Zero-Trust Mesh',
        tagline: 'Automated mTLS and ephemeral identity management for hybrid multi-cloud Kubernetes clusters.',
        description: 'Simplifies service-to-service encryption by issuing ephemeral SPIFFE/SPIRE certificates with zero manual YAML overhead and automated Envoy proxy sidecar injection.',
        goals: ['Automatic rotation of 1-hour certificates with hardware security module support', 'Web-based audit log viewer for compliance and connection graph', 'Single-command Helm install with zero downtime migration'],
        technologies: ['Kubernetes', 'Go', 'Envoy', 'Terraform', 'Prometheus', 'React'],
        owner_id: 'user_4',
        status: 'Recruiting Collaborators',
        visibility: 'public',
        github_repo: { name: 'marcuschen-ops/cloudkube-mesh', url: 'https://github.com/marcuschen-ops/cloudkube-mesh', stars: 512, forks: 64, openIssues: 8, primaryLanguage: 'Go' },
        open_roles_needed: ['Backend Developer', 'Systems & Security Engineer', 'Frontend Developer'],
        estimated_duration: '4 months',
        live_url: null,
        applications_count: 3
      },
      {
        id: 'proj_4',
        title: 'DevSync CLI & Live Pair Coding',
        tagline: 'Terminal-native pair programming tool with bidirectional AST syntax diffing.',
        description: 'Enables developers to share interactive code buffers securely through SSH tunnels with vim and VS Code keybinding fidelity, zero lag, and optional audio whisper channels.',
        goals: ['Sub-15ms peer-to-peer data channel via WebRTC & UDP', 'Tree-sitter powered syntax aware conflict resolution', 'Clean CLI client in Rust with zero runtime dependencies'],
        technologies: ['Rust', 'WebRTC', 'Tree-sitter', 'Tokio', 'SQLite'],
        owner_id: 'user_6',
        status: 'In Active Development',
        visibility: 'public',
        github_repo: { name: 'davidkim-sys/devsync-cli', url: 'https://github.com/davidkim-sys/devsync-cli', stars: 1240, forks: 140, openIssues: 24, primaryLanguage: 'Rust' },
        open_roles_needed: ['Frontend Developer', 'UI/UX & Product Designer'],
        estimated_duration: '3 months',
        live_url: null,
        applications_count: 6
      }
    ];

    for (const p of projects) {
      await conn.query(`
        INSERT INTO projects (
          id, title, tagline, description, goals, technologies, owner_id, 
          status, visibility, github_repo, open_roles_needed, estimated_duration, live_url, applications_count
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE title=VALUES(title), tagline=VALUES(tagline), status=VALUES(status);
      `, [
        p.id, p.title, p.tagline, p.description, JSON.stringify(p.goals), JSON.stringify(p.technologies),
        p.owner_id, p.status, p.visibility, JSON.stringify(p.github_repo), JSON.stringify(p.open_roles_needed),
        p.estimated_duration, p.live_url, p.applications_count
      ]);
    }
    console.log(`✅ Seeded ${projects.length} collaboration projects.`);

    // 5. Seed Project Contributors
    const projectContributors = [
      { projectId: 'proj_1', userId: 'user_current', role: 'Lead Architect & Maintainer', joinedAt: 'Jan 2024' },
      { projectId: 'proj_1', userId: 'user_2', role: 'UI/UX & Product Designer', joinedAt: 'Feb 2024' },
      { projectId: 'proj_1', userId: 'user_4', role: 'DevOps & Cloud Engineer', joinedAt: 'Feb 2024' },
      { projectId: 'proj_1', userId: 'user_1', role: 'Frontend Developer', joinedAt: 'Mar 2024' },
      { projectId: 'proj_2', userId: 'user_1', role: 'Frontend & Canvas Lead', joinedAt: 'Feb 2024' },
      { projectId: 'proj_2', userId: 'user_3', role: 'AI Model Integration', joinedAt: 'Mar 2024' },
      { projectId: 'proj_3', userId: 'user_4', role: 'Infrastructure Architect', joinedAt: 'Dec 2023' },
      { projectId: 'proj_4', userId: 'user_6', role: 'Core Systems Maintainer', joinedAt: 'Oct 2023' }
    ];

    for (const pc of projectContributors) {
      await conn.query(`
        INSERT INTO project_contributors (project_id, user_id, role, joined_at)
        VALUES (?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE role=VALUES(role);
      `, [pc.projectId, pc.userId, pc.role, pc.joinedAt]);
    }
    console.log(`✅ Seeded ${projectContributors.length} project contributors.`);

    // 6. Seed Conversations
    const conversations = [
      {
        id: 'conv_proj_1',
        type: 'project',
        project_id: 'proj_1',
        project_name: 'DevPulse Telemetry Engine',
        project_context: 'DevPulse Telemetry Engine',
        project_roles: {
          'user_current': 'Lead Architect & Maintainer',
          'user_2': 'UI/UX & Product Designer',
          'user_4': 'DevOps & Cloud Engineer',
          'user_1': 'Frontend Developer'
        },
        participants: ['user_current', 'user_2', 'user_4', 'user_1']
      },
      {
        id: 'conv_1',
        type: 'direct',
        project_id: null,
        project_name: null,
        project_context: 'DevCollab Design System',
        project_roles: null,
        participants: ['user_current', 'user_2']
      },
      {
        id: 'conv_2',
        type: 'direct',
        project_id: null,
        project_name: null,
        project_context: 'High-Concurrency Benchmark',
        project_roles: null,
        participants: ['user_current', 'user_6']
      }
    ];

    for (const conv of conversations) {
      await conn.query(`
        INSERT INTO conversations (id, type, project_id, project_name, project_context, project_roles)
        VALUES (?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE project_name=VALUES(project_name), project_context=VALUES(project_context);
      `, [conv.id, conv.type, conv.project_id, conv.project_name, conv.project_context, conv.project_roles ? JSON.stringify(conv.project_roles) : null]);

      await conn.query('DELETE FROM conversation_participants WHERE conversation_id = ?', [conv.id]);
      for (const p of conv.participants) {
        await conn.query('INSERT INTO conversation_participants (conversation_id, user_id) VALUES (?, ?)', [conv.id, p]);
      }
    }
    console.log(`✅ Seeded ${conversations.length} conversations and participants.`);

    // 7. Seed Messages
    const messages = [
      // conv_proj_1 (DevPulse Team Channel)
      {
        id: 'msg_proj_init',
        conversation_id: 'conv_proj_1',
        sender_id: 'system',
        sender_name: 'DevCollab Project Automation',
        sender_avatar: null,
        project_role: null,
        text: '🚀 Project Team Channel created for "DevPulse Telemetry Engine". 4 active developers collaborating.',
        timestamp: 'Yesterday',
        attachments: null,
        is_read: true,
        is_system: true
      },
      {
        id: 'msg_proj_1',
        conversation_id: 'conv_proj_1',
        sender_id: 'user_current',
        sender_name: 'Alex Rivera',
        sender_avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=250',
        project_role: 'Lead Architect & Maintainer',
        text: 'Welcome to the DevPulse team chat! Sofia is leading UI/UX, Marcus is on DevOps/Cloud Kubernetes setup, and Elena is building the React WebGL visualizer.',
        timestamp: 'Yesterday, 4:00 PM',
        attachments: null,
        is_read: true,
        is_system: false
      },
      {
        id: 'msg_proj_2',
        conversation_id: 'conv_proj_1',
        sender_id: 'user_4',
        sender_name: 'Marcus Chen',
        sender_avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=250',
        project_role: 'DevOps & Cloud Engineer',
        text: 'Hey team! The eBPF kernel probes and ClickHouse distributed storage instance are successfully running on our staging cluster.',
        timestamp: 'Yesterday, 4:15 PM',
        attachments: null,
        is_read: true,
        is_system: false
      },
      {
        id: 'msg_proj_3',
        conversation_id: 'conv_proj_1',
        sender_id: 'user_1',
        sender_name: 'Elena Rostova',
        sender_avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=250',
        project_role: 'Frontend Developer',
        text: 'I started wiring up the WebGL canvas for trace node topologies. The telemetry pipeline benchmarks look super responsive!',
        timestamp: '1:30 PM',
        attachments: null,
        is_read: true,
        is_system: false
      },
      {
        id: 'msg_proj_4',
        conversation_id: 'conv_proj_1',
        sender_id: 'user_2',
        sender_name: 'Sofia Martinez',
        sender_avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&q=80&w=250',
        project_role: 'UI/UX & Product Designer',
        text: 'Updated the WebSockets telemetry dashboard mocks in Figma. Ready for the frontend team to inspect!',
        timestamp: '2:15 PM',
        attachments: null,
        is_read: false,
        is_system: false
      },

      // conv_1 (Direct Chat with Sofia)
      {
        id: 'msg_1_1',
        conversation_id: 'conv_1',
        sender_id: 'user_current',
        sender_name: 'Alex Rivera',
        sender_avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=250',
        project_role: null,
        text: 'Hey Sofia! Excited to collaborate on the UI component library for developer workspaces.',
        timestamp: '10:15 AM',
        attachments: null,
        is_read: true,
        is_system: false
      },
      {
        id: 'msg_1_2',
        conversation_id: 'conv_1',
        sender_id: 'user_2',
        sender_name: 'Sofia Martinez',
        sender_avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&q=80&w=250',
        project_role: null,
        text: 'Hey Alex! Glad we connected. I have drafted the wireframes for the collaboration dashboard and discovery cards.',
        timestamp: '10:20 AM',
        attachments: null,
        is_read: true,
        is_system: false
      },
      {
        id: 'msg_1_3',
        conversation_id: 'conv_1',
        sender_id: 'user_current',
        sender_name: 'Alex Rivera',
        sender_avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=250',
        project_role: null,
        text: 'Awesome! Did you set up the Tailwind color variables for both dark and light mode?',
        timestamp: '11:05 AM',
        attachments: null,
        is_read: true,
        is_system: false
      },
      {
        id: 'msg_1_6',
        conversation_id: 'conv_1',
        sender_id: 'user_2',
        sender_name: 'Sofia Martinez',
        sender_avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&q=80&w=250',
        project_role: null,
        text: 'I also submitted Pull Request #14 against main. You can review and merge it right here without leaving chat.',
        timestamp: '1:10 PM',
        attachments: [
          {
            type: 'git_action',
            title: 'PR #14: Dynamic Theme Tokens & Accent System',
            gitAction: {
              action: 'pr',
              branch: 'feature/theme-tokens',
              prNumber: 14,
              prStatus: 'open',
              commitMessage: 'Dynamic Theme Tokens & High-Contrast Dark Accents'
            }
          }
        ],
        is_read: false,
        is_system: false
      },

      // conv_2 (Direct Chat with David Kim)
      {
        id: 'msg_2_1',
        conversation_id: 'conv_2',
        sender_id: 'user_current',
        sender_name: 'Alex Rivera',
        sender_avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=250',
        project_role: null,
        text: 'Hi David, how did the Zero-Copy buffer tests go on the Linux server?',
        timestamp: 'Nov 18, 4:10 PM',
        attachments: null,
        is_read: true,
        is_system: false
      },
      {
        id: 'msg_2_2',
        conversation_id: 'conv_2',
        sender_id: 'user_6',
        sender_name: 'David Kim',
        sender_avatar: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&q=80&w=250',
        project_role: null,
        text: 'We saw an 80% decrease in context switches by leveraging io_uring. The benchmarks are looking very promising.',
        timestamp: 'Nov 18, 5:30 PM',
        attachments: null,
        is_read: true,
        is_system: false
      },
      {
        id: 'msg_2_3',
        conversation_id: 'conv_2',
        sender_id: 'user_6',
        sender_name: 'David Kim',
        sender_avatar: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&q=80&w=250',
        project_role: null,
        text: 'Here is the Rust benchmarking repository with memory profiling charts. We achieved 420,000 req/sec over TCP.',
        timestamp: 'Yesterday',
        attachments: [
          {
            type: 'repo',
            title: 'davidkim-sys/turbo-tcp-bench',
            url: 'https://github.com/davidkim-sys/turbo-tcp-bench',
            language: 'Rust'
          }
        ],
        is_read: true,
        is_system: false
      }
    ];

    for (const msg of messages) {
      await conn.query(`
        INSERT INTO messages (
          id, conversation_id, sender_id, sender_name, sender_avatar, 
          project_role, text, timestamp, attachments, is_read, is_system
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE text=VALUES(text), timestamp=VALUES(timestamp);
      `, [
        msg.id, msg.conversation_id, msg.sender_id, msg.sender_name, msg.sender_avatar,
        msg.project_role, msg.text, msg.timestamp, msg.attachments ? JSON.stringify(msg.attachments) : null,
        msg.is_read, msg.is_system
      ]);
    }
    console.log(`✅ Seeded ${messages.length} messages with profile picture avatars and GitHub attachments.`);

    // 8. Seed Completed Project History
    const projectHistory = [
      {
        id: 'hist_1',
        title: 'StreamSQL: Distributed Query Engine',
        tagline: 'SQL engine for real-time Kafka streams with sliding window aggregations.',
        description: 'Built during an open-source collaboration sprint between 3 developers who met on DevCollab. We implemented a vectorized query engine running on Apache Arrow format that benchmarks 4x faster than existing alternatives.',
        completed_date: 'November 2023',
        live_url: 'https://streamsql.demo.devcollab.io',
        github_url: 'https://github.com/devcollab-community/streamsql',
        technologies: ['Go', 'Apache Arrow', 'Kafka', 'React', 'Tailwind CSS'],
        collaborators: [
          { userId: 'user_current', name: 'Alex Rivera', username: 'alexrivera_dev', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=250', role: 'Storage Engine & Raft Consensus' },
          { userId: 'user_1', name: 'Elena Rostova', username: 'elena_codes', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=250', role: 'Web Query Playground UI' },
          { userId: 'user_4', name: 'Marcus Chen', username: 'marcus_cloud', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=250', role: 'Kubernetes Helm & Benchmark Harness' }
        ],
        testimonial: {
          author: 'Elena Rostova',
          authorRole: 'Frontend Architect',
          avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=250',
          quote: 'Alex’s API design made integration a breeze. We shipped our MVP 2 weeks ahead of our hackathon deadline!'
        },
        metrics: { stars: 1850, users: '12k+ downloads', commits: 248 }
      },
      {
        id: 'hist_2',
        title: 'PromptForge: Local LLM Testbench',
        tagline: 'Developer tool to run automated regression tests against local LLM endpoints.',
        description: 'An open-source regression testing harness for local language model pipelines. Provides assertions for hallucinations, latency bounds, and semantic drift across version upgrades.',
        completed_date: 'September 2023',
        live_url: 'https://promptforge.dev',
        github_url: 'https://github.com/devcollab-community/promptforge',
        technologies: ['Python', 'FastAPI', 'Next.js', 'PostgreSQL', 'Docker'],
        collaborators: [
          { userId: 'user_current', name: 'Alex Rivera', username: 'alexrivera_dev', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=250', role: 'FastAPI Service & Worker Queues' },
          { userId: 'user_3', name: 'Priya Sharma', username: 'priya_ml', avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=250', role: 'Semantic Evaluation Metrics' }
        ],
        testimonial: {
          author: 'Priya Sharma',
          authorRole: 'AI Research Engineer',
          avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=250',
          quote: 'Partnering on DevCollab unlocked a project I had parked for 6 months. High engineering standards and super reliable communication.'
        },
        metrics: { stars: 920, users: '3.5k devs', commits: 165 }
      }
    ];

    for (const h of projectHistory) {
      await conn.query(`
        INSERT INTO project_history (
          id, title, tagline, description, completed_date, live_url, github_url, 
          technologies, collaborators, testimonial, metrics
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE title=VALUES(title), tagline=VALUES(tagline);
      `, [
        h.id, h.title, h.tagline, h.description, h.completed_date, h.live_url, h.github_url,
        JSON.stringify(h.technologies), JSON.stringify(h.collaborators), JSON.stringify(h.testimonial), JSON.stringify(h.metrics)
      ]);
    }
    console.log(`✅ Seeded ${projectHistory.length} completed project history items.`);

    // 9. Seed Real Git Repositories
    console.log('📦 Initializing server-managed Git bare repositories on disk...');

    const repoSeeds = [
      {
        id: 'repo_devpulse',
        projectId: 'proj_1',
        ownerId: 'user_current',
        ownerUsername: 'alexrivera_dev',
        name: 'devpulse-engine',
        description: 'Lightweight, eBPF-powered real-time service observability engine for local dev and cloud clusters.',
        visibility: 'public',
        defaultBranch: 'main',
        files: [
          {
            path: 'README.md',
            content: `# DevPulse Telemetry Engine 🚀

Lightweight, eBPF-powered real-time service observability for local dev and cloud clusters.

## Features
- Kernel-space socket inspection via eBPF probes (zero context switch overhead)
- Sub-millisecond distributed trace visualizer in React + WebGL
- ClickHouse columnar telemetry storage
- OpenTelemetry gRPC / OTLP forwarders

## Getting Started

\`\`\`bash
# Clone directly from this DevCollab server
git clone http://localhost:5000/git/alexrivera_dev/devpulse-engine.git
cd devpulse-engine

# Run with docker compose
docker compose up -d
\`\`\`

## Contributing
Branch naming: \`feature/<feature-name>\` or \`fix/<bug-name>\`. Submit pull requests for review.
`
          },
          {
            path: 'go.mod',
            content: `module github.com/devcollab-community/devpulse-engine

go 1.22

require (
\tgithub.com/cilium/ebpf v0.12.3
\tgithub.com/gorilla/websocket v1.5.1
\tgithub.com/gin-gonic/gin v1.9.1
)
`
          },
          {
            path: 'cmd/server/main.go',
            content: `package main

import (
\t"fmt"
\t"log"
\t"net/http"
)

func main() {
\tfmt.Println("⚡ DevPulse Telemetry Engine starting on :8080...")
\thttp.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
\t\tw.WriteHeader(http.StatusOK)
\t\tw.Write([]byte("{\"status\":\"healthy\",\"engine\":\"ebpf-v1\"}"))
\t})
\tlog.Fatal(http.ListenAndServe(":8080", nil))
}
`
          },
          {
            path: 'pkg/telemetry/ebpf.go',
            content: `package telemetry

// AttachKernelProbe attaches the eBPF tracepoints to the host network stack.
func AttachKernelProbe(interfaceName string) error {
\t// eBPF map initialization and socket filter attach
\treturn nil
}
`
          },
          {
            path: 'docker-compose.yml',
            content: `version: '3.8'
services:
  devpulse-engine:
    build: .
    ports:
      - "8080:8080"
    privileged: true
    environment:
      - LOG_LEVEL=debug
`
          },
          {
            path: '.gitignore',
            content: `bin/\n*.log\n.env\nvendor/\n`
          }
        ]
      },
      {
        id: 'repo_neuralcanvas',
        projectId: 'proj_2',
        ownerId: 'user_1',
        ownerUsername: 'elena_codes',
        name: 'neural-canvas-studio',
        description: 'Collaborative infinite canvas for visual AI prompt engineering and model pipelines.',
        visibility: 'public',
        defaultBranch: 'main',
        files: [
          {
            path: 'README.md',
            content: `# NeuralCanvas Studio 🎨✨\n\nCollaborative infinite canvas for visual AI prompt engineering and multi-modal model pipelines.\n\n\`\`\`bash\ngit clone http://localhost:5000/git/elena_codes/neural-canvas-studio.git\n\`\`\`\n`
          },
          {
            path: 'package.json',
            content: `{\n  "name": "neural-canvas-studio",\n  "version": "0.9.0",\n  "scripts": { "dev": "vite" }\n}\n`
          }
        ]
      },
      {
        id: 'repo_cloudkube',
        projectId: 'proj_3',
        ownerId: 'user_4',
        ownerUsername: 'marcus_cloud',
        name: 'cloudkube-mesh',
        description: 'Automated mTLS and ephemeral identity management for hybrid multi-cloud Kubernetes clusters.',
        visibility: 'public',
        defaultBranch: 'main',
        files: [
          {
            path: 'README.md',
            content: `# CloudKube Zero-Trust Mesh 🛡️\n\nAutomated SPIFFE/SPIRE certificate rotation and Envoy sidecar injection.\n\n\`\`\`bash\ngit clone http://localhost:5000/git/marcus_cloud/cloudkube-mesh.git\n\`\`\`\n`
          }
        ]
      },
      {
        id: 'repo_devsync',
        projectId: 'proj_4',
        ownerId: 'user_6',
        ownerUsername: 'david_sys',
        name: 'devsync-cli',
        description: 'Terminal-native pair programming tool with bidirectional AST syntax diffing.',
        visibility: 'public',
        defaultBranch: 'main',
        files: [
          {
            path: 'README.md',
            content: `# DevSync CLI ⚡\n\nPeer-to-peer interactive code buffer sync with vim and VS Code fidelity.\n\n\`\`\`bash\ngit clone http://localhost:5000/git/david_sys/devsync-cli.git\n\`\`\`\n`
          },
          {
            path: 'Cargo.toml',
            content: `[package]\nname = "devsync-cli"\nversion = "0.4.1"\nedition = "2021"\n`
          }
        ]
      }
    ];

    for (const r of repoSeeds) {
      const diskPath = path.join('git-repositories', r.ownerUsername, `${r.name}.git`);
      const slug = `${r.ownerUsername}/${r.name}`;

      // Initialize bare Git repo on filesystem
      await GitService.initBareRepo(diskPath, r.defaultBranch);

      // Seed initial commit
      await GitService.seedInitialCommit(
        diskPath,
        { name: 'Alex Rivera', email: 'alex.rivera@devcollab.io' },
        r.files,
        r.defaultBranch,
        'Initial repository scaffolding'
      );

      // Insert record to database
      await conn.query(`
        INSERT INTO repositories (
          id, project_id, name, slug, description, owner_id, 
          visibility, default_branch, disk_path, stars_count, forks_count
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE description=VALUES(description), disk_path=VALUES(disk_path);
      `, [
        r.id, r.projectId, r.name, slug, r.description, r.ownerId,
        r.visibility, r.defaultBranch, diskPath, 142, 28
      ]);

      // Seed owner as repository member
      await conn.query(`
        INSERT INTO repository_members (repository_id, user_id, role, can_push, can_merge)
        VALUES (?, ?, 'owner', true, true)
        ON DUPLICATE KEY UPDATE role='owner';
      `, [r.id, r.ownerId]);

      // Seed default branch
      await conn.query(`
        INSERT INTO repository_branches (repository_id, name, is_protected, is_default, created_by)
        VALUES (?, ?, true, true, ?)
        ON DUPLICATE KEY UPDATE is_default=true;
      `, [r.id, r.defaultBranch, r.ownerId]);

      // Seed default labels
      const labels = [
        { name: 'bug', color: '#ef4444' },
        { name: 'enhancement', color: '#3b82f6' },
        { name: 'documentation', color: '#10b981' },
        { name: 'good first issue', color: '#8b5cf6' }
      ];
      for (const l of labels) {
        await conn.query(`
          INSERT IGNORE INTO issue_labels (repository_id, name, color)
          VALUES (?, ?, ?)
        `, [r.id, l.name, l.color]);
      }
    }

    // Additional branches and feature work for devpulse-engine
    const devpulseDisk = path.join('git-repositories', 'alexrivera_dev', 'devpulse-engine.git');

    // Create branch "feature/theme-tokens"
    try {
      await GitService.createBranch(devpulseDisk, 'feature/theme-tokens', 'main');
      await GitService.createWebCommit(
        devpulseDisk,
        { name: 'Sofia Martinez', email: 'sofia.design@example.com' },
        'feature/theme-tokens',
        'Add high-contrast Dark Mode theme tokens for trace graphs',
        [
          {
            action: 'create',
            path: 'web/src/theme.ts',
            content: `export const telemetryTheme = {\n  primary: '#0d9488',\n  accent: '#6366f1',\n  bgDark: '#0b1120',\n  nodeActive: '#34d399',\n  nodeError: '#ef4444'\n};\n`
          }
        ]
      );
    } catch {}

    // Create branch "feature/ebpf-grpc"
    try {
      await GitService.createBranch(devpulseDisk, 'feature/ebpf-grpc', 'main');
    } catch {}

    // Add collaborators to devpulse-engine
    const devpulseMembers = [
      { userId: 'user_2', role: 'collaborator' },
      { userId: 'user_4', role: 'collaborator' },
      { userId: 'user_1', role: 'reviewer' }
    ];
    for (const m of devpulseMembers) {
      await conn.query(`
        INSERT INTO repository_members (repository_id, user_id, role, can_push, can_merge)
        VALUES ('repo_devpulse', ?, ?, true, true)
        ON DUPLICATE KEY UPDATE role=VALUES(role);
      `, [m.userId, m.role]);
    }

    // Seed Pull Requests for devpulse-engine
    await conn.query(`
      INSERT INTO pull_requests (
        id, repository_id, number, title, description, author_id, 
        source_branch, target_branch, status, mergeable_state
      ) VALUES (?, 'repo_devpulse', 1, 'Dynamic Theme Tokens & Accent System', 'Implements high-contrast dark accents and accessible palette for eBPF latency traces.', 'user_2', 'feature/theme-tokens', 'main', 'open', 'clean')
      ON DUPLICATE KEY UPDATE title=VALUES(title);
    `, ['pr_devpulse_1']);

    // Seed PR review
    await conn.query(`
      INSERT INTO pull_request_reviews (id, pull_request_id, reviewer_id, decision, body)
      VALUES (?, 'pr_devpulse_1', 'user_current', 'approved', 'Looks super clean! The color contrast ratio exceeds WCAG AAA standards. Ready to merge.')
      ON DUPLICATE KEY UPDATE decision=VALUES(decision);
    `, ['rev_1']);

    // Seed PR comment
    await conn.query(`
      INSERT INTO pull_request_comments (id, pull_request_id, user_id, file_path, line_number, body)
      VALUES (?, 'pr_devpulse_1', 'user_1', 'web/src/theme.ts', 2, 'Great choice of emerald and indigo accents! I tested it on the WebGL canvas and it looks crisp.')
      ON DUPLICATE KEY UPDATE body=VALUES(body);
    `, ['prc_1']);

    // Seed Issues for devpulse-engine
    await conn.query(`
      INSERT INTO issues (
        id, repository_id, number, title, description, author_id, assignee_id, status, priority
      ) VALUES 
      ('issue_devpulse_1', 'repo_devpulse', 1, 'Support Kubernetes daemonset auto-injection', 'Need automated Helm chart sidecar injection for cluster-wide eBPF daemonsets.', 'user_4', 'user_current', 'open', 'high'),
      ('issue_devpulse_2', 'repo_devpulse', 2, 'WebSockets heartbeat timeout under high trace throughput', 'Investigate socket backpressure when trace buffer exceeds 500,000 events/second.', 'user_1', 'user_2', 'open', 'medium')
      ON DUPLICATE KEY UPDATE title=VALUES(title);
    `, []);

    // Seed Activities for devpulse-engine
    await conn.query(`
      INSERT INTO repository_activities (repository_id, user_id, action_type, details)
      VALUES 
      ('repo_devpulse', 'user_current', 'branch_created', JSON_OBJECT('branch', 'main', 'initial', true)),
      ('repo_devpulse', 'user_2', 'branch_created', JSON_OBJECT('branch', 'feature/theme-tokens', 'baseBranch', 'main')),
      ('repo_devpulse', 'user_2', 'pr_opened', JSON_OBJECT('number', 1, 'title', 'Dynamic Theme Tokens & Accent System')),
      ('repo_devpulse', 'user_current', 'pr_opened', JSON_OBJECT('prNumber', 1, 'reviewDecision', 'approved')),
      ('repo_devpulse', 'user_4', 'issue_opened', JSON_OBJECT('number', 1, 'title', 'Support Kubernetes daemonset auto-injection'))
    `, []);

    console.log('✅ Real Git repositories initialized on disk and seeded in database.');


    await conn.end();
    console.log('🎉 MySQL Database seeding completed successfully! All website data & profile pictures are loaded.');
    process.exit(0);
  } catch (err: any) {
    console.error('❌ Seeding error:', err.message);
    process.exit(1);
  }
}

runSeed();
