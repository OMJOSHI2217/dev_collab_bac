import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

async function runCheck() {
  const host = process.env.DB_HOST || 'localhost';
  const port = Number(process.env.DB_PORT) || 3306;
  const user = process.env.DB_USER || 'root';
  const password = process.env.DB_PASSWORD || '';
  const database = process.env.DB_NAME || 'devcollab_db';

  console.log(`\n🔍 Connecting to MySQL database "${database}" on ${host}:${port}...`);

  try {
    const conn = await mysql.createConnection({
      host,
      port,
      user,
      password,
      database
    });

    console.log('\n============================================================');
    console.log('             1. USERS & CREDENTIALS IN DATABASE            ');
    console.log('============================================================');
    const [users]: any = await conn.query('SELECT id, name, username, email, password, role FROM users');
    console.table(users);

    console.log('\n============================================================');
    console.log('             2. DATABASE TABLES SUMMARY COUNTS             ');
    console.log('============================================================');
    const [counts]: any = await conn.query(`
      SELECT 'users' AS Table_Name, COUNT(*) AS Total_Rows FROM users
      UNION ALL
      SELECT 'user_skills', COUNT(*) FROM user_skills
      UNION ALL
      SELECT 'projects', COUNT(*) FROM projects
      UNION ALL
      SELECT 'connection_requests', COUNT(*) FROM connection_requests
      UNION ALL
      SELECT 'conversations', COUNT(*) FROM conversations
      UNION ALL
      SELECT 'messages', COUNT(*) FROM messages
    `);
    console.table(counts);

    console.log('\n============================================================');
    console.log('             3. USER TABLE COLUMNS (AUTH VERIFICATION)     ');
    console.log('============================================================');
    const [columns]: any = await conn.query('DESCRIBE users');
    const authCols = columns.filter((c: any) => 
      ['id', 'name', 'username', 'email', 'password', 'role'].includes(c.Field)
    );
    console.table(authCols.map((c: any) => ({ Field: c.Field, Type: c.Type, Null: c.Null, Key: c.Key })));

    await conn.end();
    console.log('\n✅ Database check completed successfully!\n');
    process.exit(0);
  } catch (err: any) {
    console.error('❌ Database check error:', err.message);
    process.exit(1);
  }
}

runCheck();
