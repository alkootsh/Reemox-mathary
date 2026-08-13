import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
async function fix() {
  try {
    await pool.query('DELETE FROM memberships;');
    await pool.query('DELETE FROM users;');
    console.log('Cleared users and memberships.');
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}
fix();
