import { FastifyRequest, FastifyReply } from "fastify";
import { GetGlobalMetricsUseCase } from "../../application/use-cases/admin/GetGlobalMetricsUseCase.js";
import { ListTenantsOverviewUseCase } from "../../application/use-cases/admin/ListTenantsOverviewUseCase.js";
import { GetTenantDetailUseCase } from "../../application/use-cases/admin/GetTenantDetailUseCase.js";
import { ToggleTenantAutoAnswerUseCase } from "../../application/use-cases/admin/ToggleTenantAutoAnswerUseCase.js";
import { ForceTokenRefreshUseCase } from "../../application/use-cases/admin/ForceTokenRefreshUseCase.js";

export class AdminController {
  constructor(
    private readonly getGlobalMetricsUseCase: GetGlobalMetricsUseCase,
    private readonly listTenantsOverviewUseCase: ListTenantsOverviewUseCase,
    private readonly getTenantDetailUseCase: GetTenantDetailUseCase,
    private readonly toggleTenantAutoAnswerUseCase: ToggleTenantAutoAnswerUseCase,
    private readonly forceTokenRefreshUseCase: ForceTokenRefreshUseCase
  ) {}

  public getMetrics = async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const metrics = await this.getGlobalMetricsUseCase.execute();
      return reply.send(metrics);
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  };

  public getTenants = async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenants = await this.listTenantsOverviewUseCase.execute();
      return reply.send(tenants);
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  };

  public getTenantDetail = async (request: FastifyRequest, reply: FastifyReply) => {
    const { sellerId } = request.params as { sellerId: string };
    try {
      const detail = await this.getTenantDetailUseCase.execute(sellerId);
      return reply.send(detail);
    } catch (err: any) {
      return reply.status(404).send({ error: err.message });
    }
  };

  public toggleAutoAnswer = async (request: FastifyRequest, reply: FastifyReply) => {
    const { sellerId } = request.params as { sellerId: string };
    const { enabled } = (request.body as { enabled?: boolean }) || {};

    try {
      const result = await this.toggleTenantAutoAnswerUseCase.execute({ sellerId, enabled });
      return reply.send(result);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  };

  public refreshToken = async (request: FastifyRequest, reply: FastifyReply) => {
    const { sellerId } = request.params as { sellerId: string };
    try {
      const result = await this.forceTokenRefreshUseCase.execute(sellerId);
      return reply.send(result);
    } catch (err: any) {
      return reply.status(502).send({ error: err.message });
    }
  };
}
