import { Database as DatabaseType } from "better-sqlite3";
import {
  ILLMUsageRepository,
  LLMUsageLogEntry,
  MonthlyStats,
  TenantMonthlyStats,
} from "../../../application/interfaces/ILLMUsageRepository.js";

export class SqliteLLMUsageRepository implements ILLMUsageRepository {
  constructor(private readonly db: DatabaseType) {}

  public log(entry: LLMUsageLogEntry): boolean {
    const yearMonth = new Date().toISOString().slice(0, 7);

    this.db.prepare(`
      INSERT INTO llm_usage_logs
        (seller_id, channel, provider, model, tokens_in, tokens_out, tokens_estimated, cost_usd, latency_ms)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      entry.sellerId, entry.channel, entry.provider, entry.model,
      entry.tokensIn, entry.tokensOut, entry.tokensEstimated ? 1 : 0,
      entry.costUsd, entry.latencyMs
    );

    this.db.prepare(`
      INSERT INTO llm_usage_monthly (seller_id, year_month, total_calls, total_tokens, total_cost_usd)
      VALUES (?, ?, 1, ?, ?)
      ON CONFLICT(seller_id, year_month) DO UPDATE SET
        total_calls    = total_calls + 1,
        total_tokens   = total_tokens + excluded.total_tokens,
        total_cost_usd = total_cost_usd + excluded.total_cost_usd
    `).run(entry.sellerId, yearMonth, entry.tokensIn + entry.tokensOut, entry.costUsd);

    const monthly = this.getMonthlyStats(entry.sellerId, yearMonth);
    if (!monthly || monthly.spendingLimitUsd === null) return false;

    if (monthly.totalCostUsd >= monthly.spendingLimitUsd) {
      const row = this.db.prepare(
        `SELECT alert_sent_at FROM llm_usage_monthly WHERE seller_id = ? AND year_month = ?`
      ).get(entry.sellerId, yearMonth) as { alert_sent_at: string | null } | undefined;

      const today = new Date().toISOString().slice(0, 10);
      const lastAlert = row?.alert_sent_at?.slice(0, 10);
      if (lastAlert !== today) {
        this.markAlertSent(entry.sellerId, yearMonth);
        return true;
      }
    }
    return false;
  }

  public getMonthlyStats(sellerId: string, yearMonth: string): MonthlyStats | null {
    const row = this.db.prepare(
      `SELECT year_month, total_calls, total_tokens, total_cost_usd, spending_limit_usd
       FROM llm_usage_monthly WHERE seller_id = ? AND year_month = ?`
    ).get(sellerId, yearMonth) as any;
    if (!row) return null;
    return {
      yearMonth: row.year_month,
      totalCalls: row.total_calls,
      totalTokens: row.total_tokens,
      totalCostUsd: row.total_cost_usd,
      spendingLimitUsd: row.spending_limit_usd ?? null,
    };
  }

  public getAllTenantsMonthlyStats(yearMonth: string): TenantMonthlyStats[] {
    const rows = this.db.prepare(
      `SELECT seller_id, year_month, total_calls, total_tokens, total_cost_usd, spending_limit_usd
       FROM llm_usage_monthly WHERE year_month = ? ORDER BY total_cost_usd DESC`
    ).all(yearMonth) as any[];
    return rows.map((r) => ({
      sellerId: r.seller_id,
      yearMonth: r.year_month,
      totalCalls: r.total_calls,
      totalTokens: r.total_tokens,
      totalCostUsd: r.total_cost_usd,
      spendingLimitUsd: r.spending_limit_usd ?? null,
    }));
  }

  public getRecentLogs(sellerId: string, limit: number): (LLMUsageLogEntry & { createdAt: string })[] {
    const rows = this.db.prepare(
      `SELECT seller_id, channel, provider, model, tokens_in, tokens_out, tokens_estimated, cost_usd, latency_ms, created_at
       FROM llm_usage_logs WHERE seller_id = ? ORDER BY created_at DESC LIMIT ?`
    ).all(sellerId, limit) as any[];
    return rows.map((r) => ({
      sellerId: r.seller_id,
      channel: r.channel,
      provider: r.provider,
      model: r.model,
      tokensIn: r.tokens_in,
      tokensOut: r.tokens_out,
      tokensEstimated: r.tokens_estimated === 1,
      costUsd: r.cost_usd,
      latencyMs: r.latency_ms,
      createdAt: r.created_at,
    }));
  }

  public setSpendingLimit(sellerId: string, limitUsd: number | null): void {
    const yearMonth = new Date().toISOString().slice(0, 7);
    this.db.prepare(`
      INSERT INTO llm_usage_monthly (seller_id, year_month, spending_limit_usd)
      VALUES (?, ?, ?)
      ON CONFLICT(seller_id, year_month) DO UPDATE SET spending_limit_usd = excluded.spending_limit_usd
    `).run(sellerId, yearMonth, limitUsd);
  }

  public markAlertSent(sellerId: string, yearMonth: string): void {
    this.db.prepare(
      `UPDATE llm_usage_monthly SET alert_sent_at = CURRENT_TIMESTAMP WHERE seller_id = ? AND year_month = ?`
    ).run(sellerId, yearMonth);
  }

  public getGlobalProviderStats(yearMonth: string): Record<string, { calls: number; costUsd: number }> {
    const rows = this.db.prepare(`
      SELECT provider, COUNT(*) as calls, SUM(cost_usd) as cost_usd
      FROM llm_usage_logs
      WHERE strftime('%Y-%m', created_at) = ?
      GROUP BY provider
    `).all(yearMonth) as any[];
    const result: Record<string, { calls: number; costUsd: number }> = {};
    for (const r of rows) {
      result[r.provider] = { calls: r.calls, costUsd: r.cost_usd ?? 0 };
    }
    return result;
  }
}
