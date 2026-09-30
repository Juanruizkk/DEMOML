import 'dotenv/config';
import { Pool } from 'pg';

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    console.log('Altering tenants.expires_at to BIGINT...');
    await pool.query('ALTER TABLE tenants ALTER COLUMN expires_at TYPE BIGINT;');
    console.log('✅ Column altered successfully to BIGINT.');
  } catch (err: any) {
    console.error('Error altering column:', err.message);
  } finally {
    await pool.end();
  }
}

main();
