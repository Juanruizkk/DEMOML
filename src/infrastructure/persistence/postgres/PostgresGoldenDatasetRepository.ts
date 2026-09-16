import { eq, desc } from "drizzle-orm";
import { DrizzleDB } from "../drizzle/db.js";
import { goldenDataset } from "../drizzle/schema.js";
import { IGoldenDatasetRepository, GoldenDatasetFilters, GoldenDatasetMetrics } from "../../../application/interfaces/IGoldenDatasetRepository.js";
import { GoldenDatasetEntry, GoldenDecision } from "../../../domain/entities/GoldenDatasetEntry.js";
import { IntentType } from "../../../domain/value-objects/Intent.js";

export class PostgresGoldenDatasetRepository implements IGoldenDatasetRepository {
  constructor(private readonly db: DrizzleDB) {}

  public async save(entry: GoldenDatasetEntry): Promise<void> {
    if (entry.qualityRating !== null && (entry.qualityRating < 1 || entry.qualityRating > 5)) {
      throw new Error(`qualityRating debe estar entre 1 y 5, recibido: ${entry.qualityRating}`);
    }
    const validDecisions: GoldenDecision[] = ["approved", "edited", "edited_from_scratch"];
    if (!validDecisions.includes(entry.decision)) {
      throw new Error(`decision inválida: ${entry.decision}`);
    }

    await this.db.insert(goldenDataset).values({
      id: entry.id,
      sellerId: entry.sellerId,
      sourceQuestionId: entry.sourceQuestionId,
      questionText: entry.questionText,
      itemSnapshot: JSON.stringify(entry.itemSnapshot),
      llmIntent: entry.llmIntent,
      humanIntent: entry.humanIntent,
      llmAnswer: entry.llmAnswer,
      finalAnswer: entry.finalAnswer,
      decision: entry.decision,
      qualityRating: entry.qualityRating ?? null,
      reviewerId: entry.reviewerId ?? null,
      reasoningNote: entry.reasoningNote ?? null,
    }).onConflictDoNothing();
  }

  public async findBySellerId(
    sellerId: string,
    filters: GoldenDatasetFilters = {}
  ): Promise<GoldenDatasetEntry[]> {
    const { limit = 100, offset = 0, intent, decision } = filters;

    const rows = await this.db
      .select()
      .from(goldenDataset)
      .where(eq(goldenDataset.sellerId, sellerId))
      .orderBy(desc(goldenDataset.createdAt))
      .limit(limit)
      .offset(offset);

    return rows
      .filter((r) => (!intent || r.humanIntent === intent) && (!decision || r.decision === decision))
      .map(this.map);
  }

  public async getMetricsBySellerId(sellerId: string): Promise<GoldenDatasetMetrics> {
    const rows = await this.db
      .select()
      .from(goldenDataset)
      .where(eq(goldenDataset.sellerId, sellerId));

    const byDecision: Record<GoldenDecision, number> = {
      approved: 0,
      edited: 0,
      edited_from_scratch: 0,
    };
    const byIntent: Record<string, number> = {};
    let mismatchCount = 0;
    let ratingSum = 0;
    let ratingCount = 0;

    for (const r of rows) {
      const dec = r.decision as GoldenDecision;
      byDecision[dec] = (byDecision[dec] ?? 0) + 1;
      byIntent[r.humanIntent] = (byIntent[r.humanIntent] ?? 0) + 1;
      if (r.llmIntent !== r.humanIntent) mismatchCount++;
      if (r.qualityRating != null) {
        ratingSum += r.qualityRating;
        ratingCount++;
      }
    }

    return {
      total: rows.length,
      byDecision,
      byIntent,
      intentMismatchRate: rows.length > 0 ? mismatchCount / rows.length : 0,
      avgQualityRating: ratingCount > 0 ? ratingSum / ratingCount : null,
    };
  }

  private map(row: typeof goldenDataset.$inferSelect): GoldenDatasetEntry {
    return new GoldenDatasetEntry({
      id: row.id,
      sellerId: row.sellerId,
      sourceQuestionId: row.sourceQuestionId,
      questionText: row.questionText,
      itemSnapshot: JSON.parse(row.itemSnapshot) as Record<string, unknown>,
      llmIntent: row.llmIntent as IntentType,
      humanIntent: row.humanIntent as IntentType,
      llmAnswer: row.llmAnswer,
      finalAnswer: row.finalAnswer,
      decision: row.decision as GoldenDecision,
      qualityRating: row.qualityRating ?? null,
      reviewerId: row.reviewerId ?? null,
      reasoningNote: row.reasoningNote ?? null,
      createdAt: row.createdAt ?? new Date(),
    });
  }
}
