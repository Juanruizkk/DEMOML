import { FastifyRequest, FastifyReply } from "fastify";
import { GetLLMUsageStatsUseCase } from "../../application/use-cases/admin/GetLLMUsageStatsUseCase.js";
import { GetTenantLLMUsageUseCase } from "../../application/use-cases/tenant/GetTenantLLMUsageUseCase.js";
import { SetLLMSpendingLimitUseCase } from "../../application/use-cases/tenant/SetLLMSpendingLimitUseCase.js";
import { ITenantRepository } from "../../application/interfaces/ITenantRepository.js";

export class LLMUsageController {
  constructor(
    private readonly getStatsUseCase: GetLLMUsageStatsUseCase,
    private readonly getTenantUsageUseCase: GetTenantLLMUsageUseCase,
    private readonly setSpendingLimitUseCase: SetLLMSpendingLimitUseCase,
    private readonly tenantRepo: ITenantRepository,
  ) {}

  public getAdminStats = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { month } = request.query as { month?: string };
      const yearMonth = month ?? new Date().toISOString().slice(0, 7);
      const stats = await this.getStatsUseCase.execute(yearMonth);
      return reply.send(stats);
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  };

  public getTenantUsage = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = (request as any).user;
      const sellerId: string = user?.sellerId ?? "";
      const { month } = request.query as { month?: string };
      const yearMonth = month ?? new Date().toISOString().slice(0, 7);
      const tenant = sellerId ? await this.tenantRepo.findBySellerId(sellerId) : null;
      const hasOwnKey = Boolean(tenant?.settings.llmProvider && tenant?.settings.llmApiKey);
      const result = await this.getTenantUsageUseCase.execute(sellerId, yearMonth, hasOwnKey);
      return reply.send(result);
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  };

  public setSpendingLimit = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = (request as any).user;
      const sellerId: string = user?.sellerId ?? "";
      const { limitUsd } = request.body as { limitUsd: number | null };
      await this.setSpendingLimitUseCase.execute(sellerId, limitUsd ?? null);
      return reply.send({ ok: true });
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  };
}
