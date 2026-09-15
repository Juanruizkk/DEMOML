import { eq, desc, sql, and } from 'drizzle-orm';
import { DrizzleDB } from '../drizzle/db.js';
import { questions } from '../drizzle/schema.js';
import { IQuestionRepository, QuestionCountsByStatus } from '../../../application/interfaces/IQuestionRepository.js';
import { Question, QuestionAppStatus } from '../../../domain/entities/Question.js';

export class PostgresQuestionRepository implements IQuestionRepository {
  constructor(private readonly db: DrizzleDB) {}

  public async findById(id: string): Promise<Question | null> {
    const [row] = await this.db.select().from(questions).where(eq(questions.questionId, id));
    return row ? this.map(row) : null;
  }

  public async save(question: Question): Promise<void> {
    await this.db.insert(questions).values({
      questionId: question.id,
      sellerId: question.sellerId,
      itemId: question.itemId,
      buyerId: question.buyerId ?? null,
      text: question.text,
      mlStatus: question.mlStatus ?? null,
      intent: question.intent ?? null,
      confidence: question.confidence ?? null,
      requiresHuman: question.requiresHuman,
      reason: question.reason ?? null,
      suggestedAnswer: question.suggestedAnswer ?? null,
      finalAnswer: question.finalAnswer ?? null,
      appStatus: question.appStatus,
      receivedAt: question.receivedAt,
      answeredAt: question.answeredAt ?? null,
      latencyMs: question.latencyMs ?? null,
      mlError: question.mlError ?? null,
    }).onConflictDoUpdate({
      target: questions.questionId,
      set: {
        sellerId: question.sellerId,
        itemId: question.itemId,
        buyerId: question.buyerId ?? null,
        text: question.text,
        mlStatus: question.mlStatus ?? null,
        intent: question.intent ?? null,
        confidence: question.confidence ?? null,
        requiresHuman: question.requiresHuman,
        reason: question.reason ?? null,
        suggestedAnswer: question.suggestedAnswer ?? null,
        finalAnswer: question.finalAnswer ?? null,
        appStatus: question.appStatus,
        answeredAt: question.answeredAt ?? null,
        latencyMs: question.latencyMs ?? null,
        mlError: question.mlError ?? null,
      },
    });
  }

  public async findBySellerId(sellerId: string, limit = 100): Promise<Question[]> {
    const rows = await this.db.select().from(questions)
      .where(eq(questions.sellerId, sellerId))
      .orderBy(desc(questions.receivedAt))
      .limit(limit);
    return rows.map(r => this.map(r));
  }

  public async findByStatus(status: QuestionAppStatus, limit = 100): Promise<Question[]> {
    const rows = await this.db.select().from(questions)
      .where(eq(questions.appStatus, status))
      .orderBy(desc(questions.receivedAt))
      .limit(limit);
    return rows.map(r => this.map(r));
  }

  public async getCountsByStatus(): Promise<QuestionCountsByStatus> {
    const rows = await this.db.select({
      appStatus: questions.appStatus,
      count: sql<number>`count(*)::int`,
    }).from(questions).groupBy(questions.appStatus);

    const counts: QuestionCountsByStatus = {
      total: 0,
      auto_answered: 0,
      approved: 0,
      pending_review: 0,
      rejected: 0,
      error: 0,
    };

    for (const r of rows) {
      const s = r.appStatus as keyof QuestionCountsByStatus;
      if (s in counts) counts[s] = r.count;
      counts.total += r.count;
    }

    return counts;
  }

  public async getAverageLatency(): Promise<number> {
    const result = await this.db.select({
      avg: sql<number>`avg(latency_ms)::int`,
    }).from(questions).where(sql`latency_ms IS NOT NULL`);

    return result[0]?.avg ?? 0;
  }

  public async getIntentDistribution(): Promise<Record<string, number>> {
    const rows = await this.db.select({
      intent: questions.intent,
      count: sql<number>`count(*)::int`,
    }).from(questions)
      .where(sql`intent IS NOT NULL`)
      .groupBy(questions.intent);

    const distribution: Record<string, number> = {};
    for (const r of rows) {
      if (r.intent) {
        distribution[r.intent] = r.count;
      }
    }

    return distribution;
  }

  public async getStatsBySellerId(sellerId: string): Promise<{ total: number; autoAnswered: number }> {
    const result = await this.db.select({
      total: sql<number>`count(*)::int`,
      autoAnswered: sql<number>`count(case when app_status = 'auto_answered' then 1 end)::int`,
    }).from(questions)
      .where(eq(questions.sellerId, sellerId));

    return {
      total: result[0]?.total ?? 0,
      autoAnswered: result[0]?.autoAnswered ?? 0,
    };
  }

  private map(row: typeof questions.$inferSelect): Question {
    return new Question({
      id: row.questionId,
      sellerId: row.sellerId,
      itemId: row.itemId,
      buyerId: row.buyerId ?? undefined,
      text: row.text,
      mlStatus: row.mlStatus ?? undefined,
      intent: row.intent ?? undefined,
      confidence: row.confidence ?? undefined,
      requiresHuman: row.requiresHuman ?? false,
      reason: row.reason ?? undefined,
      suggestedAnswer: row.suggestedAnswer ?? undefined,
      finalAnswer: row.finalAnswer ?? undefined,
      appStatus: row.appStatus as QuestionAppStatus,
      receivedAt: row.receivedAt ?? new Date(),
      answeredAt: row.answeredAt ?? undefined,
      latencyMs: row.latencyMs ?? undefined,
      mlError: row.mlError ?? undefined,
    });
  }
}
