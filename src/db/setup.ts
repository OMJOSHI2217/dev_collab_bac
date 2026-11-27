import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runSetup() {
  const host = process.env.DB_HOST || 'localhost';
  const port = Number(process.env.DB_PORT) || 3306;
  const user = process.env.DB_USER || 'root';
  const password = process.env.DB_PASSWORD || '';
  const database = process.env.DB_NAME || 'devcollab_db';

  console.log(`🔌 Connecting to MySQL server at ${host}:${port} as ${user}...`);

  try {
    // Connect without database first to ensure database exists
    const adminConnection = await mysql.createConnection({
      host,
      port,
      user,
      password,
      multipleStatements: true
    });

    await adminConnection.query(`CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
    console.log(`✅ Database "${database}" verified or created.`);
    await adminConnection.end();

    // Now connect to devcollab_db and run schema.sql
    const dbConnection = await mysql.createConnection({
      host,
      port,
      user,
      password,
      database,
      multipleStatements: true
    });

    const schemaPath = path.join(__dirname, 'schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');

    console.log('📦 Executing schema.sql tables creation...');
    await dbConnection.query(schemaSql);

    // Apply migrations if tables already existed previously
    try {
      await dbConnection.query(`ALTER TABLE users MODIFY COLUMN avatar LONGTEXT;`);
      await dbConnection.query(`ALTER TABLE messages MODIFY COLUMN sender_avatar LONGTEXT;`);
      console.log('✅ Ensured avatar & sender_avatar are LONGTEXT for unlimited profile picture storage.');
    } catch {
      // Ignore if table was freshly created
    }

    try {
      await dbConnection.query(`ALTER TABLE users ADD COLUMN password VARCHAR(255);`);
      console.log('✅ Ensured password column exists in users table.');
    } catch {
      // Column might already exist
    }

    try {
      await dbConnection.query(`ALTER TABLE project_history ADD COLUMN testimonial JSON;`);
    } catch {
      // Column might already exist
    }

    console.log('✅ All DevCollab database tables created successfully!');
    await dbConnection.end();

    console.log('🎉 MySQL setup completed!');
    process.exit(0);
  } catch (err: any) {
    console.error('❌ Database setup error:', err.message);
    console.log('\n👉 Make sure your MySQL service is running (e.g. XAMPP, Docker, or native Windows MySQL service).');
    process.exit(1);
  }
}

runSetup();
