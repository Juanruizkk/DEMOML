import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, "..", "data");
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(path.join(dataDir, "meli_bot.db"));
db.pragma("journal_mode = WAL");

db.exec(`
CREATE TABLE IF NOT EXISTS tokens (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS questions (
  question_id TEXT PRIMARY KEY,
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
  payload_json TEXT NOT NULL,
  cached_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  question_id TEXT,
  type TEXT NOT NULL,
  message TEXT NOT NULL,
  duration_ms INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS app_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`);

// Config inicial de respuesta automática, tomada del entorno si no existe todavía.
const existingAutoAnswer = db.prepare("SELECT value FROM app_config WHERE key = ?").get("auto_answer_enabled");
if (!existingAutoAnswer) {
  db.prepare("INSERT INTO app_config (key, value) VALUES (?, ?)").run(
    "auto_answer_enabled",
    String(process.env.AUTO_ANSWER_ENABLED ?? "true")
  );
}

export default db;
