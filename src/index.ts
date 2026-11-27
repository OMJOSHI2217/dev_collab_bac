import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { testDbConnection } from './config/db.js';

// Import Routes
import authRoutes from './routes/authRoutes.js';
import developersRoutes from './routes/developersRoutes.js';
import connectionsRoutes from './routes/connectionsRoutes.js';
import projectsRoutes from './routes/projectsRoutes.js';
import messagesRoutes from './routes/messagesRoutes.js';
import gitHttpRoutes from './routes/gitHttpRoutes.js';
import gitRoutes from './routes/gitRoutes.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());

// Git Smart HTTP Protocol transport (must receive raw binary stream before JSON body parser)
app.use('/git', gitHttpRoutes);

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// API Health Check
app.get('/api/health', async (req, res) => {
  const dbOk = await testDbConnection();
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    mysqlConnected: dbOk,
    database: process.env.DB_NAME || 'devcollab_db',
    port: PORT
  });
});

// HTML / JSON API Dashboard helper
const renderApiDashboard = async (res: express.Response) => {
  const dbOk = await testDbConnection();
  const dbName = process.env.DB_NAME || 'devcollab_db';
  const dbUser = process.env.DB_USER || 'root';

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>DevCollab Backend API Server</title>
  <style>
    :root {
      --bg: #0b1120;
      --card: #1e293b;
      --border: #334155;
      --text: #f8fafc;
      --text-muted: #94a3b8;
      --primary: #0d9488;
      --primary-hover: #0f766e;
      --success: #10b981;
      --warning: #f59e0b;
      --font: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: var(--bg);
      color: var(--text);
      font-family: var(--font);
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 24px;
    }
    .container {
      width: 100%;
      max-width: 760px;
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 32px;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5);
    }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      font-weight: 600;
      padding: 4px 10px;
      border-radius: 9999px;
      background: rgba(16, 185, 129, 0.15);
      color: #34d399;
      border: 1px solid rgba(16, 185, 129, 0.3);
      margin-bottom: 12px;
    }
    .pulse-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #10b981;
      box-shadow: 0 0 10px #10b981;
    }
    h1 {
      font-size: 26px;
      font-weight: 700;
      margin-bottom: 8px;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    p.subtitle {
      color: var(--text-muted);
      font-size: 15px;
      line-height: 1.5;
      margin-bottom: 24px;
    }
    .btn-group {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      margin-bottom: 28px;
    }
    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 12px 20px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 600;
      text-decoration: none;
      transition: all 0.2s ease;
      cursor: pointer;
    }
    .btn-primary {
      background: var(--primary);
      color: #ffffff;
    }
    .btn-primary:hover {
      background: var(--primary-hover);
    }
    .btn-secondary {
      background: #334155;
      color: #f1f5f9;
    }
    .btn-secondary:hover {
      background: #475569;
    }
    .grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      margin-bottom: 24px;
    }
    @media (max-width: 600px) {
      .grid { grid-template-columns: 1fr; }
    }
    .status-card {
      background: #0f172a;
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 16px;
    }
    .status-card h3 {
      font-size: 13px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-muted);
      margin-bottom: 6px;
    }
    .status-card p {
      font-size: 15px;
      font-weight: 600;
    }
    .endpoints-list {
      background: #0f172a;
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 16px;
    }
    .endpoints-list h3 {
      font-size: 13px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-muted);
      margin-bottom: 12px;
    }
    .endpoint-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 12px;
      border-radius: 6px;
      background: #1e293b;
      margin-bottom: 8px;
      font-family: monospace;
      font-size: 13px;
    }
    .endpoint-item:last-child { margin-bottom: 0; }
    .method {
      color: #38bdf8;
      font-weight: 700;
      margin-right: 8px;
    }
    .endpoint-link {
      color: #cbd5e1;
      text-decoration: none;
    }
    .endpoint-link:hover {
      color: #38bdf8;
      text-decoration: underline;
    }
    .footer {
      margin-top: 24px;
      text-align: center;
      font-size: 12px;
      color: var(--text-muted);
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="badge">
      <div class="pulse-dot"></div>
      DevCollab Backend API Online
    </div>
    <h1>⚡ DevCollab REST Server</h1>
    <p class="subtitle">
      You are viewing the backend Express server running on port <strong>${PORT}</strong>. 
      Use the buttons below to open the frontend web app or inspect the MySQL API endpoints.
    </p>

    <div class="btn-group">
      <a href="http://localhost:5173" class="btn btn-primary" target="_blank" rel="noopener">
        🚀 Open Frontend App (Vite: 5173)
      </a>
      <a href="/api/health" class="btn btn-secondary">
        🩺 API Health Check
      </a>
      <a href="/api/developers" class="btn btn-secondary">
        👥 Explore Developers API
      </a>
    </div>

    <div class="grid">
      <div class="status-card">
        <h3>Server Status</h3>
        <p style="color: #34d399;">Running (Port ${PORT})</p>
      </div>
      <div class="status-card">
        <h3>MySQL Database (${dbName})</h3>
        <p style="color: ${dbOk ? '#34d399' : '#f59e0b'};">
          ${dbOk ? '● Connected' : '○ Standby / Not Connected'}
        </p>
      </div>
    </div>

    <div class="endpoints-list">
      <h3>Available API Endpoints</h3>
      <div class="endpoint-item">
        <span><span class="method">GET</span> /api/health</span>
        <a class="endpoint-link" href="/api/health" target="_blank">Test ↗</a>
      </div>
      <div class="endpoint-item">
        <span><span class="method">GET</span> /api/developers</span>
        <a class="endpoint-link" href="/api/developers" target="_blank">Test ↗</a>
      </div>
      <div class="endpoint-item">
        <span><span class="method">GET</span> /api/projects</span>
        <a class="endpoint-link" href="/api/projects" target="_blank">Test ↗</a>
      </div>
      <div class="endpoint-item">
        <span><span class="method">GET</span> /api/messages/conversations?userId=usr_1</span>
        <a class="endpoint-link" href="/api/messages/conversations?userId=usr_1" target="_blank">Test ↗</a>
      </div>
      <div class="endpoint-item">
        <span><span class="method">GET</span> /api/connections/usr_1</span>
        <a class="endpoint-link" href="/api/connections/usr_1" target="_blank">Test ↗</a>
      </div>
    </div>

    <div class="footer">
      DevCollab • Modern Developer Networking & Collaboration Platform
    </div>
  </div>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
};

// API Info Dashboard Route
app.get('/api', async (req, res) => {
  if (req.accepts('html')) {
    await renderApiDashboard(res);
  } else {
    const dbOk = await testDbConnection();
    res.json({
      name: 'DevCollab REST API',
      version: '1.0.0',
      status: 'online',
      port: PORT,
      mysqlConnected: dbOk,
      frontendUrl: 'http://localhost:5173',
      endpoints: [
        'GET /api/health',
        'POST /api/auth/register',
        'POST /api/auth/login',
        'GET /api/developers',
        'GET /api/developers/:id',
        'GET /api/projects',
        'POST /api/projects',
        'GET /api/connections/:userId',
        'GET /api/messages/conversations?userId=:id'
      ]
    });
  }
});

// Mount API Routes
app.use('/api/auth', authRoutes);
app.use('/api/developers', developersRoutes);
app.use('/api/connections', connectionsRoutes);
app.use('/api/projects', projectsRoutes);
app.use('/api/messages', messagesRoutes);
app.use('/api/git', gitRoutes);

// Look for frontend build in dist directory
const candidates = [
  path.resolve(process.cwd(), 'dist'),
  path.resolve(process.cwd(), '../dist'),
  path.resolve(__dirname, '../../dist'),
  path.resolve(__dirname, '../../../dist'),
];
const distPath = candidates.find(p => fs.existsSync(p) && fs.existsSync(path.join(p, 'index.html')));

if (distPath) {
  console.log(`📁 Serving frontend static build from: ${distPath}`);
  app.use(express.static(distPath));

  // Client-side single page app routing fallback for non-API routes
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api')) {
      return res.status(404).json({ error: 'Endpoint not found', path: req.path });
    }
    res.sendFile(path.join(distPath, 'index.html'));
  });
} else {
  // If no dist folder is built, show the friendly API dashboard at root GET /
  app.get('/', async (req, res) => {
    await renderApiDashboard(res);
  });

  // Catch-all 404 for unhandled routes
  app.use((req, res) => {
    if (req.path.startsWith('/api')) {
      res.status(404).json({ error: 'API route not found', path: req.path });
    } else {
      res.status(404).send(`
        <!DOCTYPE html>
        <html>
        <head><title>404 - Not Found</title></head>
        <body style="font-family: sans-serif; background: #0f172a; color: #f8fafc; text-align: center; padding: 60px;">
          <h2>404 - Page Not Found</h2>
          <p style="color: #94a3b8; margin: 16px 0;">The requested path "${req.path}" was not found.</p>
          <p><a href="/" style="color: #38bdf8;">Return to API Dashboard</a> or <a href="http://localhost:5173" style="color: #34d399;">Open Frontend on Port 5173</a></p>
        </body>
        </html>
      `);
    }
  });
}

app.listen(PORT, async () => {
  console.log(`🚀 DevCollab MySQL Backend API running on http://localhost:${PORT}`);
  if (distPath) {
    console.log(`🌐 Full web app is accessible at http://localhost:${PORT}`);
  } else {
    console.log(`💡 Dev frontend is accessible at http://localhost:5173`);
  }
  await testDbConnection();
});
