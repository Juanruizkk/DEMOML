import { Database as DatabaseType } from "better-sqlite3";
import { IEventRepository } from "../../../application/interfaces/IEventRepository.js";
import { EventLog } from "../../../domain/entities/EventLog.js";

export class SqliteEventRepository implements IEventRepository {
  constructor(private readonly db: DatabaseType) {}

  public async log(event: EventLog): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO events (seller_id, question_id, type, message, duration_ms, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      event.sellerId || null,
      event.questionId || null,
      event.type,
      event.message,
      event.durationMs || null,
      event.createdAt.toISOString()
    );
  }

  public async getRecent(sinceId: number = 0, limit: number = 50): Promise<EventLog[]> {
    const rows = this.db
      .prepare("SELECT * FROM events WHERE id > ? ORDER BY id DESC LIMIT ?")
      .all(sinceId, limit) as any[];
    return rows.map((r) => this.mapToDomain(r)).reverse();
  }

  public async getRecentBySellerId(sellerId: string, sinceId: number = 0, limit: number = 50): Promise<EventLog[]> {
    const rows = this.db
      .prepare("SELECT * FROM events WHERE seller_id = ? AND id > ? ORDER BY id DESC LIMIT ?")
      .all(sellerId, sinceId, limit) as any[];
    return rows.map((r) => this.mapToDomain(r)).reverse();
  }

  private mapToDomain(row: any): EventLog {
    return new EventLog({
      id: row.id,
      sellerId: row.seller_id || undefined,
      questionId: row.question_id || undefined,
      type: row.type,
      message: row.message,
      durationMs: row.duration_ms || undefined,
      createdAt: new Date(row.created_at),
    });
  }
}
