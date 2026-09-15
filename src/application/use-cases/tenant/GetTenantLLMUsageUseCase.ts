import { ILLMUsageRepository, MonthlyStats, LLMUsageLogEntry } from "../../interfaces/ILLMUsageRepository.js";

export interface TenantLLMUsageResult {
  monthly: MonthlyStats | null;
  recentLogs: (LLMUsageLogEntry & { createdAt: string })[];
  hasOwnKey: boolean;
}

export class GetTenantLLMUsageUseCase {
  constructor(private readonly usageRepo: ILLMUsageRepository) {}

  public async execute(sellerId: string, yearMonth: string, hasOwnKey: boolean): Promise<TenantLLMUsageResult> {
    const [monthly, recentLogs] = await Promise.all([
      this.usageRepo.getMonthlyStats(sellerId, yearMonth),
      this.usageRepo.getRecentLogs(sellerId, 20),
    ]);
    return { monthly, recentLogs, hasOwnKey };
  }
}
