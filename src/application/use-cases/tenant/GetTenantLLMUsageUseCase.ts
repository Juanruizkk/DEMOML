import { ILLMUsageRepository, MonthlyStats, LLMUsageLogEntry } from "../../interfaces/ILLMUsageRepository.js";

export interface TenantLLMUsageResult {
  monthly: MonthlyStats | null;
  recentLogs: (LLMUsageLogEntry & { createdAt: string })[];
  hasOwnKey: boolean;
}

export class GetTenantLLMUsageUseCase {
  constructor(private readonly usageRepo: ILLMUsageRepository) {}

  public execute(sellerId: string, yearMonth: string, hasOwnKey: boolean): TenantLLMUsageResult {
    return {
      monthly: this.usageRepo.getMonthlyStats(sellerId, yearMonth),
      recentLogs: this.usageRepo.getRecentLogs(sellerId, 20),
      hasOwnKey,
    };
  }
}
