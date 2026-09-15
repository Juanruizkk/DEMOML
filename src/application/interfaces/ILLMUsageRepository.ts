export interface LLMUsageLogEntry {
  sellerId: string;
  channel: string;
  provider: string;
  model: string;
  tokensIn: number;
  tokensOut: number;
  tokensEstimated: boolean;
  costUsd: number;
  latencyMs: number;
}

export interface MonthlyStats {
  yearMonth: string;
  totalCalls: number;
  totalTokens: number;
  totalCostUsd: number;
  spendingLimitUsd: number | null;
}

export interface TenantMonthlyStats extends MonthlyStats {
  sellerId: string;
}

export interface ILLMUsageRepository {
  /** Inserts log entry and upserts monthly summary. Returns true if spending limit exceeded. */
  log(entry: LLMUsageLogEntry): Promise<boolean>;
  getMonthlyStats(sellerId: string, yearMonth: string): Promise<MonthlyStats | null>;
  getAllTenantsMonthlyStats(yearMonth: string): Promise<TenantMonthlyStats[]>;
  getRecentLogs(sellerId: string, limit: number): Promise<(LLMUsageLogEntry & { createdAt: string })[]>;
  setSpendingLimit(sellerId: string, limitUsd: number | null): Promise<void>;
  markAlertSent(sellerId: string, yearMonth: string): Promise<void>;
  getGlobalProviderStats(yearMonth: string): Promise<Record<string, { calls: number; costUsd: number }>>;
}
