import Database, { Database as DatabaseType } from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export class SqliteDatabase {
  private static instance: DatabaseType | null = null;

  public static getInstance(dbPath?: string): DatabaseType {
    if (!this.instance) {
      const defaultDir = path.join(__dirname, "../../../../data");
      if (!fs.existsSync(defaultDir)) {
        fs.mkdirSync(defaultDir, { recursive: true });
      }

      const filePath = dbPath || path.join(defaultDir, "meli_bot.db");
      this.instance = new Database(filePath);
      this.instance.pragma("journal_mode = WAL");
      this.initSchema(this.instance);
    }
    return this.instance;
  }

  private static initSchema(db: DatabaseType): void {
    db.exec(`
      CREATE TABLE IF NOT EXISTS tenants (
        id TEXT PRIMARY KEY,
        seller_id TEXT UNIQUE NOT NULL,
        nickname TEXT,
        email TEXT,
        access_token TEXT NOT NULL,
        refresh_token TEXT NOT NULL,
        expires_at INTEGER NOT NULL,
        settings_json TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS questions (
        question_id TEXT PRIMARY KEY,
        seller_id TEXT NOT NULL,
        item_id TEXT NOT NULL,
        buyer_id TEXT,
        text TEXT NOT NULL,
        ml_status TEXT,
        intent TEXT,
        confidence REAL,
        requires_human INTEGER DEFAULT 0,
        reason TEXT,
        suggested_answer TEXT,
        final_answer TEXT,
        app_status TEXT NOT NULL,
        received_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        answered_at DATETIME,
        latency_ms INTEGER,
        ml_error TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_questions_seller ON questions(seller_id);
      CREATE INDEX IF NOT EXISTS idx_questions_status ON questions(app_status);

      CREATE TABLE IF NOT EXISTS items_cache (
        item_id TEXT PRIMARY KEY,
        seller_id TEXT,
        payload_json TEXT NOT NULL,
        cached_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        seller_id TEXT,
        question_id TEXT,
        type TEXT NOT NULL,
        message TEXT NOT NULL,
        duration_ms INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_events_seller ON events(seller_id);

      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        name TEXT NOT NULL,
        role TEXT NOT NULL,
        seller_id TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      CREATE INDEX IF NOT EXISTS idx_users_seller ON users(seller_id);

      CREATE TABLE IF NOT EXISTS app_config (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);
  }
}
