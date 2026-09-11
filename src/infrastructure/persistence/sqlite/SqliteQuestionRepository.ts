import { Database as DatabaseType } from "better-sqlite3";
import { IQuestionRepository, QuestionCountsByStatus } from "../../../application/interfaces/IQuestionRepository.js";
import { Question, QuestionAppStatus } from "../../../domain/entities/Question.js";

export class SqliteQuestionRepository implements IQuestionRepository {
  constructor(private readonly db: DatabaseType) {}

  public async findById(id: string): Promise<Question | null> {
    const row = this.db.prepare("SELECT * FROM questions WHERE question_id = ?").get(id) as any;
    if (!row) return null;
    return this.mapToDomain(row);
  }

  public async save(question: Question): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO questions (
        question_id, seller_id, item_id, buyer_id, text, ml_status,
        intent, confidence, requires_human, reason, suggested_answer,
        final_answer, app_status, received_at, answered_at, latency_ms, ml_error
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(question_id) DO UPDATE SET
        seller_id = excluded.seller_id,
        item_id = excluded.item_id,
        buyer_id = excluded.buyer_id,
        text = excluded.text,
        ml_status = excluded.ml_status,
        intent = excluded.intent,
        confidence = excluded.confidence,
        requires_human = excluded.requires_human,
        reason = excluded.reason,
        suggested_answer = excluded.suggested_answer,
        final_answer = excluded.final_answer,
        app_status = excluded.app_status,
        answered_at = excluded.answered_at,
        latency_ms = excluded.latency_ms,
        ml_error = excluded.ml_error
    `);

    stmt.run(
      question.id,
      question.sellerId,
      question.itemId,
      question.buyerId || null,
      question.text,
      question.mlStatus || null,
      question.intent || null,
      question.confidence ?? null,
      question.requiresHuman ? 1 : 0,
      question.reason || null,
      question.suggestedAnswer || null,
      question.finalAnswer || null,
      question.appStatus,
      question.receivedAt.toISOString(),
      question.answeredAt ? question.answeredAt.toISOString() : null,
      question.latencyMs || null,
      question.mlError || null
    );
  }

  public async findBySellerId(sellerId: string, limit: number = 100): Promise<Question[]> {
    const rows = this.db
      .prepare("SELECT * FROM questions WHERE seller_id = ? ORDER BY received_at DESC LIMIT ?")
      .all(sellerId, limit) as any[];
    return rows.map((r) => this.mapToDomain(r));
  }

  public async findByStatus(status: QuestionAppStatus, limit: number = 100): Promise<Question[]> {
    const rows = this.db
      .prepare("SELECT * FROM questions WHERE app_status = ? ORDER BY received_at DESC LIMIT ?")
      .all(status, limit) as any[];
    return rows.map((r) => this.mapToDomain(r));
  }

  public async getCountsByStatus(): Promise<QuestionCountsByStatus> {
    const rows = this.db
      .prepare("SELECT app_status, COUNT(*) as count FROM questions GROUP BY app_status")
      .all() as Array<{ app_status: string; count: number }>;

    const counts: QuestionCountsByStatus = {
      total: 0,
      auto_answered: 0,
      approved: 0,
      pending_review: 0,
      rejected: 0,
      error: 0,
    };

    for (const r of rows) {
      counts.total += r.count;
      if (r.app_status === "auto_answered") counts.auto_answered = r.count;
      else if (r.app_status === "approved") counts.approved = r.count;
      else if (r.app_status === "pending_review") counts.pending_review = r.count;
      else if (r.app_status === "rejected") counts.rejected = r.count;
      else if (r.app_status === "error") counts.error = r.count;
    }

    return counts;
  }

  public async getAverageLatency(): Promise<number> {
    const row = this.db
      .prepare("SELECT AVG(latency_ms) as avg_latency FROM questions WHERE latency_ms IS NOT NULL")
      .get() as any;
    return Math.round(row?.avg_latency || 0);
  }

  public async getIntentDistribution(): Promise<Record<string, number>> {
    const rows = this.db
      .prepare("SELECT intent, COUNT(*) as count FROM questions WHERE intent IS NOT NULL GROUP BY intent")
      .all() as Array<{ intent: string; count: number }>;

    const dist: Record<string, number> = {};
    for (const r of rows) {
      dist[r.intent] = r.count;
    }
    return dist;
  }

  public async getStatsBySellerId(sellerId: string): Promise<{ total: number; autoAnswered: number }> {
    const row = this.db
      .prepare(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN app_status IN ('auto_answered', 'approved') THEN 1 ELSE 0 END) as auto_answered
        FROM questions 
        WHERE seller_id = ?
      `)
      .get(sellerId) as any;

    return {
      total: row?.total || 0,
      autoAnswered: row?.auto_answered || 0,
    };
  }

  private mapToDomain(row: any): Question {
    return new Question({
      id: row.question_id,
      sellerId: row.seller_id,
      itemId: row.item_id,
      buyerId: row.buyer_id || undefined,
      text: row.text,
      mlStatus: row.ml_status || undefined,
      intent: row.intent || undefined,
      confidence: row.confidence ?? undefined,
      requiresHuman: Boolean(row.requires_human),
      reason: row.reason || null,
      suggestedAnswer: row.suggested_answer || undefined,
      finalAnswer: row.final_answer || undefined,
      appStatus: row.app_status,
      receivedAt: new Date(row.received_at),
      answeredAt: row.answered_at ? new Date(row.answered_at) : null,
      latencyMs: row.latency_ms ?? null,
      mlError: row.ml_error || null,
    });
  }
}
