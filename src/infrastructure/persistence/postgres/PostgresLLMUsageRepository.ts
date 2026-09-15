import { and, eq, desc, sql } from 'drizzle-orm';
import { DrizzleDB } from '../drizzle/db.js';
import { llmUsageLogs, llmUsageMonthly } from '../drizzle/schema.js';
import {
  ILLMUsageRepository, LLMUsageLogEntry, MonthlyStats, TenantMonthlyStats,
} from '../../../application/interfaces/ILLMUsageRepository.js';

export class PostgresLLMUsageRepository implements ILLMUsageRepository {
  constructor(private readonly db: DrizzleDB) {}

  public async log(entry: LLMUsageLogEntry): Promise<boolean> {
    const yearMonth = new Date().toISOString().slice(0, 7);
    const today = new Date().toISOString().slice(0, 10);

    let shouldAlert = false;

    await this.db.transaction(async (tx) => {
      await tx.insert(llmUsageLogs).values({
        sellerId: entry.sellerId,
        channel: entry.channel,
        provider: entry.provider,
        model: entry.model,
        tokensIn: entry.tokensIn,
        tokensOut: entry.tokensOut,
        tokensEstimated: entry.tokensEstimated,
        costUsd: entry.costUsd,
        latencyMs: entry.latencyMs,
      });

      await tx.insert(llmUsageMonthly).values({
        sellerId: entry.sellerId,
        yearMonth,
        totalCalls: 1,
        totalTokens: entry.tokensIn + entry.tokensOut,
        totalCostUsd: entry.costUsd,
      }).onConflictDoUpdate({
        target: [llmUsageMonthly.sellerId, llmUsageMonthly.yearMonth],
        set: {
          totalCalls: sql`${llmUsageMonthly.totalCalls} + 1`,
          totalTokens: sql`${llmUsageMonthly.totalTokens} + ${entry.tokensIn + entry.tokensOut}`,
          totalCostUsd: sql`${llmUsageMonthly.totalCostUsd} + ${entry.costUsd}`,
        },
      });

      // Atomic conditional update: set alert_sent_at only if limit exceeded and not yet alerted today
      const result = await tx.update(llmUsageMonthly)
        .set({ alertSentAt: new Date() })
        .where(and(
          eq(llmUsageMonthly.sellerId, entry.sellerId),
          eq(llmUsageMonthly.yearMonth, yearMonth),
          sql`spending_limit_usd IS NOT NULL`,
          sql`total_cost_usd >= spending_limit_usd`,
          sql`(alert_sent_at IS NULL OR alert_sent_at::date < ${today}::date)`,
        ))
        .returning({ id: llmUsageMonthly.sellerId });

      shouldAlert = result.length > 0;
    });

    return shouldAlert;
  }

  public async getMonthlyStats(sellerId: string, yearMonth: string): Promise<MonthlyStats | null> {
    const [row] = await this.db.select().from(llmUsageMonthly)
      .where(and(eq(llmUsageMonthly.sellerId, sellerId), eq(llmUsageMonthly.yearMonth, yearMonth)));
    if (!row) return null;
    return {
      yearMonth: row.yearMonth,
      totalCalls: row.totalCalls,
      totalTokens: row.totalTokens,
      totalCostUsd: row.totalCostUsd,
      spendingLimitUsd: row.spendingLimitUsd ?? null,
    };
  }

  public async getAllTenantsMonthlyStats(yearMonth: string): Promise<TenantMonthlyStats[]> {
    const rows = await this.db.select().from(llmUsageMonthly)
      .where(eq(llmUsageMonthly.yearMonth, yearMonth))
      .orderBy(desc(llmUsageMonthly.totalCostUsd));
    return rows.map(r => ({
      sellerId: r.sellerId,
      yearMonth: r.yearMonth,
      totalCalls: r.totalCalls,
      totalTokens: r.totalTokens,
      totalCostUsd: r.totalCostUsd,
      spendingLimitUsd: r.spendingLimitUsd ?? null,
    }));
  }

  public async getRecentLogs(sellerId: string, limit: number): Promise<(LLMUsageLogEntry & { createdAt: string })[]> {
    const safeLimit = Math.min(Math.max(1, limit), 200);
    const rows = await this.db.select().from(llmUsageLogs)
      .where(eq(llmUsageLogs.sellerId, sellerId))
      .orderBy(desc(llmUsageLogs.createdAt))
      .limit(safeLimit);
    return rows.map(r => ({
      sellerId: r.sellerId,
      channel: r.channel,
      provider: r.provider,
      model: r.model,
      tokensIn: r.tokensIn,
      tokensOut: r.tokensOut,
      tokensEstimated: r.tokensEstimated,
      costUsd: r.costUsd,
      latencyMs: r.latencyMs,
      createdAt: r.createdAt?.toISOString() ?? new Date().toISOString(),
    }));
  }

  public async setSpendingLimit(sellerId: string, limitUsd: number | null): Promise<void> {
    const yearMonth = new Date().toISOString().slice(0, 7);
    await this.db.insert(llmUsageMonthly).values({
      sellerId,
      yearMonth,
      spendingLimitUsd: limitUsd,
    }).onConflictDoUpdate({
      target: [llmUsageMonthly.sellerId, llmUsageMonthly.yearMonth],
      set: { spendingLimitUsd: limitUsd },
    });
  }

  public async markAlertSent(sellerId: string, yearMonth: string): Promise<void> {
    await this.db.update(llmUsageMonthly)
      .set({ alertSentAt: new Date() })
      .where(and(eq(llmUsageMonthly.sellerId, sellerId), eq(llmUsageMonthly.yearMonth, yearMonth)));
  }

  public async getGlobalProviderStats(yearMonth: string): Promise<Record<string, { calls: number; costUsd: number }>> {
    const rows = await this.db.select({
      provider: llmUsageLogs.provider,
      calls: sql<number>`count(*)::int`,
      costUsd: sql<number>`coalesce(sum(${llmUsageLogs.costUsd}), 0)`,
    }).from(llmUsageLogs)
      .where(sql`to_char(${llmUsageLogs.createdAt}, 'YYYY-MM') = ${yearMonth}`)
      .groupBy(llmUsageLogs.provider);

    const result: Record<string, { calls: number; costUsd: number }> = {};
    for (const r of rows) result[r.provider] = { calls: r.calls, costUsd: r.costUsd };
    return result;
  }
}
