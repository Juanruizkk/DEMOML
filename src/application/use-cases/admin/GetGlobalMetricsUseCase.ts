import { IQuestionRepository } from "../../interfaces/IQuestionRepository.js";
import { ITenantRepository } from "../../interfaces/ITenantRepository.js";
import { GlobalMetricsDTO } from "../../dtos/AdminDTOs.js";
import { IntentType } from "../../../domain/value-objects/Intent.js";

export class GetGlobalMetricsUseCase {
  constructor(
    private readonly questionRepo: IQuestionRepository,
    private readonly tenantRepo: ITenantRepository
  ) {}

  public async execute(): Promise<GlobalMetricsDTO> {
    const [counts, avgLatency, intentDist, tenants] = await Promise.all([
      this.questionRepo.getCountsByStatus(),
      this.questionRepo.getAverageLatency(),
      this.questionRepo.getIntentDistribution(),
      this.tenantRepo.getAll(),
    ]);

    const totalAnswered = counts.auto_answered + counts.approved;
    const autoAnswerRatePercent =
      counts.total > 0 ? Number(((totalAnswered / counts.total) * 100).toFixed(1)) : 0;

    return {
      totalQuestions: counts.total,
      autoAnsweredCount: counts.auto_answered,
      approvedCount: counts.approved,
      pendingReviewCount: counts.pending_review,
      rejectedCount: counts.rejected,
      errorCount: counts.error,
      autoAnswerRatePercent,
      averageLatencyMs: avgLatency,
      totalActiveTenants: tenants.length,
      intentDistribution: intentDist as Record<IntentType | "otro", number>,
    };
  }
}
