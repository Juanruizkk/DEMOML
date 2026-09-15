import { eq, desc, and } from 'drizzle-orm';
import { DrizzleDB } from '../drizzle/db.js';
import { orderMessages } from '../drizzle/schema.js';
import { IOrderMessageRepository, OrderMessageFilters } from '../../../application/interfaces/IOrderMessageRepository.js';
import { OrderMessage } from '../../../domain/entities/OrderMessage.js';

export class PostgresOrderMessageRepository implements IOrderMessageRepository {
  constructor(private readonly db: DrizzleDB) {}

  public async save(msg: OrderMessage): Promise<void> {
    await this.db.insert(orderMessages).values({
      id: msg.id,
      sellerId: msg.sellerId,
      packId: msg.packId,
      orderId: msg.orderId ?? null,
      buyerId: msg.buyerId,
      buyerNickname: msg.buyerNickname ?? null,
      itemId: msg.itemId ?? null,
      itemTitle: msg.itemTitle ?? null,
      messageText: msg.messageText,
      senderRole: msg.senderRole,
      intent: msg.intent ?? null,
      confidence: msg.confidence ?? null,
      requiresHuman: msg.requiresHuman ?? false,
      reason: msg.reason ?? null,
      suggestedAnswer: msg.suggestedAnswer ?? null,
      finalAnswer: msg.finalAnswer ?? null,
      status: msg.status,
      createdAt: msg.createdAt,
      repliedAt: msg.repliedAt ?? null,
      latencyMs: msg.latencyMs ?? null,
      mlError: msg.mlError ?? null,
    }).onConflictDoUpdate({
      target: orderMessages.id,
      set: {
        intent: msg.intent ?? null,
        confidence: msg.confidence ?? null,
        requiresHuman: msg.requiresHuman ?? false,
        reason: msg.reason ?? null,
        suggestedAnswer: msg.suggestedAnswer ?? null,
        finalAnswer: msg.finalAnswer ?? null,
        status: msg.status,
        repliedAt: msg.repliedAt ?? null,
        latencyMs: msg.latencyMs ?? null,
        mlError: msg.mlError ?? null,
      },
    });
  }

  public async findById(id: string): Promise<OrderMessage | null> {
    const [row] = await this.db.select().from(orderMessages).where(eq(orderMessages.id, id));
    return row ? this.map(row) : null;
  }

  public async findByPackId(packId: string): Promise<OrderMessage[]> {
    const rows = await this.db.select().from(orderMessages)
      .where(eq(orderMessages.packId, packId))
      .orderBy(orderMessages.createdAt);
    return rows.map(r => this.map(r));
  }

  public async list(filters: OrderMessageFilters): Promise<{ data: OrderMessage[]; total: number }> {
    const conditions: any[] = [];

    if (filters.sellerId) {
      conditions.push(eq(orderMessages.sellerId, filters.sellerId));
    }
    if (filters.status) {
      conditions.push(eq(orderMessages.status, filters.status));
    }
    if (filters.intent) {
      conditions.push(eq(orderMessages.intent, filters.intent));
    }
    if (filters.packId) {
      conditions.push(eq(orderMessages.packId, filters.packId));
    }
    if (filters.search) {
      // Search in message text and buyer nickname
      // Note: For full-text search, consider using PostgreSQL's tsvector
      // For now, we'll do a simple contains search on message_text
      // This may need optimization for large datasets
    }

    const whereCondition = conditions.length > 0 ? and(...conditions) : undefined;

    // Get total count
    const countResult = await this.db
      .select()
      .from(orderMessages)
      .where(whereCondition);
    const total = countResult.length;

    // Get paginated results
    const limit = filters.limit ?? 50;
    const offset = filters.offset ?? 0;

    const rows = await this.db.select()
      .from(orderMessages)
      .where(whereCondition)
      .orderBy(desc(orderMessages.createdAt))
      .limit(limit)
      .offset(offset);

    return {
      data: rows.map(r => this.map(r)),
      total,
    };
  }

  public async listBySeller(sellerId: string, filters?: OrderMessageFilters): Promise<OrderMessage[]> {
    const conditions = [eq(orderMessages.sellerId, sellerId)];

    if (filters?.status) {
      conditions.push(eq(orderMessages.status, filters.status));
    }
    if (filters?.intent) {
      conditions.push(eq(orderMessages.intent, filters.intent));
    }
    if (filters?.packId) {
      conditions.push(eq(orderMessages.packId, filters.packId));
    }

    const limit = filters?.limit ?? 100;

    const rows = await this.db.select()
      .from(orderMessages)
      .where(and(...conditions))
      .orderBy(desc(orderMessages.createdAt))
      .limit(limit);

    return rows.map(r => this.map(r));
  }

  public async countPending(sellerId: string): Promise<number> {
    const rows = await this.db.select()
      .from(orderMessages)
      .where(
        and(
          eq(orderMessages.sellerId, sellerId),
          eq(orderMessages.status, 'pending_review')
        )
      );
    return rows.length;
  }

  private map(row: typeof orderMessages.$inferSelect): OrderMessage {
    return new OrderMessage({
      id: row.id,
      sellerId: row.sellerId,
      packId: row.packId,
      orderId: row.orderId ?? undefined,
      buyerId: row.buyerId,
      buyerNickname: row.buyerNickname ?? undefined,
      itemId: row.itemId ?? undefined,
      itemTitle: row.itemTitle ?? undefined,
      messageText: row.messageText,
      senderRole: row.senderRole as any,
      intent: row.intent ?? undefined,
      confidence: row.confidence ?? undefined,
      requiresHuman: row.requiresHuman ?? false,
      reason: row.reason ?? undefined,
      suggestedAnswer: row.suggestedAnswer ?? undefined,
      finalAnswer: row.finalAnswer ?? undefined,
      status: row.status as any,
      createdAt: row.createdAt ?? new Date(),
      repliedAt: row.repliedAt ?? null,
      latencyMs: row.latencyMs ?? undefined,
      mlError: row.mlError ?? undefined,
    });
  }
}
