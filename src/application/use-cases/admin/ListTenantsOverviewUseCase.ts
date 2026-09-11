import { ITenantRepository } from "../../interfaces/ITenantRepository.js";
import { IQuestionRepository } from "../../interfaces/IQuestionRepository.js";
import { TenantOverviewDTO, TokenHealthStatus } from "../../dtos/AdminDTOs.js";

export class ListTenantsOverviewUseCase {
  constructor(
    private readonly tenantRepo: ITenantRepository,
    private readonly questionRepo: IQuestionRepository
  ) {}

  public async execute(): Promise<TenantOverviewDTO[]> {
    const tenants = await this.tenantRepo.getAll();
    const now = Date.now();

    const overviews: TenantOverviewDTO[] = [];

    for (const tenant of tenants) {
      const stats = await this.questionRepo.getStatsBySellerId(tenant.sellerId);
      const remainingMs = tenant.expiresAt - now;
      const expiresInMinutes = Math.round(remainingMs / (60 * 1000));

      let tokenHealth: TokenHealthStatus = "healthy";
      if (remainingMs <= 0) {
        tokenHealth = "expired";
      } else if (remainingMs < 15 * 60 * 1000) {
        tokenHealth = "expiring_soon";
      }

      overviews.push({
        sellerId: tenant.sellerId,
        nickname: tenant.nickname,
        email: tenant.email,
        tokenHealth,
        expiresInMinutes,
        autoAnswerEnabled: tenant.settings.autoAnswerEnabled,
        confidenceThreshold: tenant.settings.confidenceThreshold,
        tone: tenant.settings.tone,
        totalQuestions: stats.total,
        autoAnsweredQuestions: stats.autoAnswered,
        createdAt: tenant.createdAt.toISOString(),
        updatedAt: tenant.updatedAt.toISOString(),
      });
    }

    return overviews;
  }
}
