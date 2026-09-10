import db from "./db.js";
import { broadcast } from "./sse.js";

const insertEvent = db.prepare(
  "INSERT INTO events (question_id, type, message, duration_ms) VALUES (?, ?, ?, ?)"
);

/**
 * Registra un evento de telemetría en SQLite y lo emite en vivo por SSE.
 * duration_ms es el costo de ESA fase puntual (no el acumulado).
 */
export function logEvent({ questionId = null, type, message, durationMs = null }) {
  const info = insertEvent.run(questionId, type, message, durationMs);
  const event = {
    id: info.lastInsertRowid,
    question_id: questionId,
    type,
    message,
    duration_ms: durationMs,
    created_at: new Date().toISOString(),
  };
  broadcast("event", event);
  return event;
}

export function getRecentEvents(sinceId = 0, limit = 200) {
  return db
    .prepare("SELECT * FROM events WHERE id > ? ORDER BY id ASC LIMIT ?")
    .all(sinceId, limit);
}
