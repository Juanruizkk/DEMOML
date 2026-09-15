import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);

console.log('Applying migrations...');

await migrate(db, {
  migrationsFolder: path.join(__dirname, '../../src/infrastructure/persistence/drizzle/migrations'),
});

console.log('Migrations applied successfully.');
await pool.end();
