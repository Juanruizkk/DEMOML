import { ILLMUsageRepository, TenantMonthlyStats } from "../../interfaces/ILLMUsageRepository.js";
import { ITenantRepository } from "../../interfaces/ITenantRepository.js";

export interface GlobalLLMUsageStats {
  yearMonth: string;
  totals: {
    totalCalls: number;
    totalTokens: number;
    totalCostUsd: number;
    byProvider: Record<string, { calls: number; costUsd: number }>;
  };
  tenants: Array<TenantMonthlyStats & { nickname?: string }>;
}

export class GetLLMUsageStatsUseCase {
  constructor(
    private readonly usageRepo: ILLMUsageRepository,
    private readonly tenantRepo: ITenantRepository,
  ) {}

  public async execute(yearMonth: string): Promise<GlobalLLMUsageStats> {
    const [tenantStats, byProvider, allTenants] = await Promise.all([
      this.usageRepo.getAllTenantsMonthlyStats(yearMonth),
      this.usageRepo.getGlobalProviderStats(yearMonth),
      this.tenantRepo.getAll(),
    ]);

    const nicknameMap = new Map(allTenants.map((t) => [t.sellerId, t.nickname]));
    const tenantsWithNames = tenantStats.map((t) => ({
      ...t,
      nickname: nicknameMap.get(t.sellerId),
    }));

    const totals = tenantStats.reduce(
      (acc, t) => ({
        totalCalls: acc.totalCalls + t.totalCalls,
        totalTokens: acc.totalTokens + t.totalTokens,
        totalCostUsd: acc.totalCostUsd + t.totalCostUsd,
      }),
      { totalCalls: 0, totalTokens: 0, totalCostUsd: 0 }
    );

    return { yearMonth, totals: { ...totals, byProvider }, tenants: tenantsWithNames };
  }
}
