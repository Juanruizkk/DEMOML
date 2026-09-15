import { eq, gt, desc, and } from 'drizzle-orm';
import { DrizzleDB } from '../drizzle/db.js';
import { events } from '../drizzle/schema.js';
import { IEventRepository } from '../../../application/interfaces/IEventRepository.js';
import { EventLog } from '../../../domain/entities/EventLog.js';

export class PostgresEventRepository implements IEventRepository {
  constructor(private readonly db: DrizzleDB) {}

  public async log(event: EventLog): Promise<void> {
    await this.db.insert(events).values({
      sellerId: event.sellerId ?? null,
      questionId: event.questionId ?? null,
      type: event.type,
      message: event.message,
      durationMs: event.durationMs ?? null,
      createdAt: event.createdAt,
    });
  }

  public async getRecent(sinceId = 0, limit = 50): Promise<EventLog[]> {
    const rows = await this.db.select().from(events)
      .where(gt(events.id, sinceId))
      .orderBy(desc(events.id))
      .limit(limit);
    return rows.reverse().map(r => this.map(r));
  }

  public async getRecentBySellerId(sellerId: string, sinceId = 0, limit = 50): Promise<EventLog[]> {
    const rows = await this.db.select().from(events)
      .where(and(eq(events.sellerId, sellerId), gt(events.id, sinceId)))
      .orderBy(desc(events.id))
      .limit(limit);
    return rows.reverse().map(r => this.map(r));
  }

  private map(row: typeof events.$inferSelect): EventLog {
    return new EventLog({
      id: row.id,
      sellerId: row.sellerId ?? undefined,
      questionId: row.questionId ?? undefined,
      type: row.type,
      message: row.message,
      durationMs: row.durationMs ?? undefined,
      createdAt: row.createdAt ?? new Date(),
    });
  }
}
