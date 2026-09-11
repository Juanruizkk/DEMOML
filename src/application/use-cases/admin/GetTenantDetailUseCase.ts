import { ITenantRepository } from "../../interfaces/ITenantRepository.js";
import { IQuestionRepository } from "../../interfaces/IQuestionRepository.js";
import { IEventRepository } from "../../interfaces/IEventRepository.js";
import { TenantDetailDTO, TokenHealthStatus } from "../../dtos/AdminDTOs.js";

export class GetTenantDetailUseCase {
  constructor(
    private readonly tenantRepo: ITenantRepository,
    private readonly questionRepo: IQuestionRepository,
    private readonly eventRepo: IEventRepository
  ) {}

  public async execute(sellerId: string): Promise<TenantDetailDTO> {
    const tenant = await this.tenantRepo.findBySellerId(sellerId);
    if (!tenant) {
      throw new Error(`Inquilino no encontrado para el vendedor ${sellerId}`);
    }

    const [stats, recentQuestions, recentEvents] = await Promise.all([
      this.questionRepo.getStatsBySellerId(sellerId),
      this.questionRepo.findBySellerId(sellerId, 10),
      this.eventRepo.getRecentBySellerId(sellerId, 0, 20),
    ]);

    const remainingMs = tenant.expiresAt - Date.now();
    let tokenHealth: TokenHealthStatus = "healthy";
    if (remainingMs <= 0) {
      tokenHealth = "expired";
    } else if (remainingMs < 15 * 60 * 1000) {
      tokenHealth = "expiring_soon";
    }

    return {
      tenant: {
        sellerId: tenant.sellerId,
        nickname: tenant.nickname,
        email: tenant.email,
        tokenHealth,
        expiresInMinutes: Math.round(remainingMs / (60 * 1000)),
        autoAnswerEnabled: tenant.settings.autoAnswerEnabled,
        confidenceThreshold: tenant.settings.confidenceThreshold,
        tone: tenant.settings.tone,
        totalQuestions: stats.total,
        autoAnsweredQuestions: stats.autoAnswered,
        createdAt: tenant.createdAt.toISOString(),
        updatedAt: tenant.updatedAt.toISOString(),
      },
      settings: tenant.settings,
      recentQuestions: recentQuestions.map((q) => ({
        id: q.id,
        text: q.text,
        intent: q.intent,
        confidence: q.confidence,
        appStatus: q.appStatus,
        receivedAt: q.receivedAt.toISOString(),
      })),
      recentEvents: recentEvents.map((e) => ({
        id: e.id,
        type: e.type,
        message: e.message,
        createdAt: e.createdAt.toISOString(),
      })),
    };
  }
}
