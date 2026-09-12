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
    const addColumnIfNotExists = (table: string, column: string, type: string) => {
      try {
        const info = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
        if (info.length > 0 && !info.some((col) => col.name === column)) {
          db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
        }
      } catch (e) {
        // Ignorar si la tabla todavía no existe
      }
    };

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
        seller_id TEXT NOT NULL DEFAULT 'default',
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

      CREATE TABLE IF NOT EXISTS app_config (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS claims (
        id TEXT PRIMARY KEY,
        seller_id TEXT NOT NULL,
        order_id TEXT NOT NULL,
        type TEXT NOT NULL,
        stage TEXT NOT NULL,
        status TEXT NOT NULL,
        reason TEXT NOT NULL,
        buyer_id TEXT,
        actions_json TEXT NOT NULL DEFAULT '[]',
        due_date DATETIME NOT NULL,
        notified_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_claims_seller ON claims(seller_id);
      CREATE INDEX IF NOT EXISTS idx_claims_due_date ON claims(due_date);
    `);

    // Migraciones automáticas seguras si las tablas existían de versiones anteriores
    addColumnIfNotExists("questions", "seller_id", "TEXT NOT NULL DEFAULT 'default'");
    addColumnIfNotExists("questions", "latency_ms", "INTEGER");
    addColumnIfNotExists("questions", "ml_error", "TEXT");
    addColumnIfNotExists("items_cache", "seller_id", "TEXT");
    addColumnIfNotExists("events", "seller_id", "TEXT");
    addColumnIfNotExists("events", "question_id", "TEXT");
    addColumnIfNotExists("events", "duration_ms", "INTEGER");
    addColumnIfNotExists("users", "seller_id", "TEXT");

    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_questions_seller ON questions(seller_id);
      CREATE INDEX IF NOT EXISTS idx_questions_status ON questions(app_status);
      CREATE INDEX IF NOT EXISTS idx_events_seller ON events(seller_id);
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      CREATE INDEX IF NOT EXISTS idx_users_seller ON users(seller_id);
    `);
  }
}
