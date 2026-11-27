import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

export const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'devcollab_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000
});

// Helper to test connectivity and ensure schema
export async function testDbConnection(): Promise<boolean> {
  try {
    const connection = await pool.getConnection();
    await connection.ping();
    
    // Ensure password column exists in users table
    try {
      await connection.query('ALTER TABLE users ADD COLUMN password VARCHAR(255);');
    } catch {
      // Column already exists
    }

    connection.release();
    console.log('✅ Connected to MySQL Database:', process.env.DB_NAME || 'devcollab_db');
    return true;
  } catch (error: any) {
    console.warn('⚠️ MySQL connection warning:', error.message);
    return false;
  }
}
