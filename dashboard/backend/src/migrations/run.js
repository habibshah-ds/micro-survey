import { readdir, readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function runMigrations() {
  try {
    console.log('📄 Starting database migrations...');

    // Create migrations table if not exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL,
        executed_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Get list of executed migrations
    const executedResult = await pool.query(
      'SELECT name FROM migrations ORDER BY id'
    );
    const executedMigrations = new Set(
      executedResult.rows.map((row) => row.name)
    );

    // Get all SQL files in migrations directory
    const files = await readdir(__dirname);
    const sqlFiles = files
      .filter((file) => file.endsWith('.sql'))
      .sort();

    console.log(`🔍 Found ${sqlFiles.length} migration files`);

    for (const file of sqlFiles) {
      if (executedMigrations.has(file)) {
        console.log(`⏭️  Skipping ${file} (already executed)`);
        continue;
      }

      console.log(`📄 Executing ${file}...`);
      
      const sql = await readFile(join(__dirname, file), 'utf-8');
      
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(sql);
        
        // ✅ FIXED: Use ON CONFLICT DO NOTHING for idempotency
        await client.query(
          'INSERT INTO migrations (name) VALUES ($1) ON CONFLICT (name) DO NOTHING',
          [file]
        );
        
        await client.query('COMMIT');
        console.log(`✅ ${file} executed successfully`);
      } catch (error) {
        await client.query('ROLLBACK');
        console.error(`❌ Error executing ${file}:`, error.message);
        throw error;
      } finally {
        client.release();
      }
    }

    console.log('✅ All migrations completed successfully');
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    await pool.end();
    process.exit(1);
  }
}

runMigrations();
