import { createPool } from './src/db/index.ts';

async function test() {
  const pool = createPool();
  try {
    const res = await pool.query(`
      CREATE TABLE IF NOT EXISTS column_configurations (
        id text PRIMARY KEY,
        company_id text NOT NULL,
        user_id text,
        entity_type text NOT NULL,
        columns_json jsonb DEFAULT '[]'::jsonb,
        updated_at timestamp DEFAULT now()
      )
    `);
    console.log("Table creation result:", res);
  } catch (err) {
    console.error("Table creation error:", err);
  }
}

test();
