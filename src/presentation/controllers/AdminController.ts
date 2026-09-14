import { FastifyRequest, FastifyReply } from "fastify";
import { GetGlobalMetricsUseCase } from "../../application/use-cases/admin/GetGlobalMetricsUseCase.js";
import { ListTenantsOverviewUseCase } from "../../application/use-cases/admin/ListTenantsOverviewUseCase.js";
import { GetTenantDetailUseCase } from "../../application/use-cases/admin/GetTenantDetailUseCase.js";
import { ToggleTenantAutoAnswerUseCase } from "../../application/use-cases/admin/ToggleTenantAutoAnswerUseCase.js";
import { ForceTokenRefreshUseCase } from "../../application/use-cases/admin/ForceTokenRefreshUseCase.js";
import { UpdateTenantPermissionsUseCase } from "../../application/use-cases/admin/UpdateTenantPermissionsUseCase.js";
import { CreateTenantUseCase } from "../../application/use-cases/admin/CreateTenantUseCase.js";
import { IUserRepository } from "../../application/interfaces/IUserRepository.js";
import { TenantPermissions } from "../../domain/entities/Tenant.js";
import { RequestPasswordResetUseCase } from "../../application/use-cases/auth/RequestPasswordResetUseCase.js";
import { IEmailClient } from "../../application/interfaces/IEmailClient.js";
import { UpdateTenantIntegrationsUseCase } from "../../application/use-cases/admin/UpdateTenantIntegrationsUseCase.js";

export class AdminController {
  constructor(
    private readonly getGlobalMetricsUseCase: GetGlobalMetricsUseCase,
    private readonly listTenantsOverviewUseCase: ListTenantsOverviewUseCase,
    private readonly getTenantDetailUseCase: GetTenantDetailUseCase,
    private readonly toggleTenantAutoAnswerUseCase: ToggleTenantAutoAnswerUseCase,
    private readonly forceTokenRefreshUseCase: ForceTokenRefreshUseCase,
    private readonly updateTenantPermissionsUseCase: UpdateTenantPermissionsUseCase,
    private readonly createTenantUseCase: CreateTenantUseCase,
    private readonly userRepo: IUserRepository,
    private readonly requestPasswordResetUseCase: RequestPasswordResetUseCase,
    private readonly emailClient?: IEmailClient,
    private readonly updateTenantIntegrationsUseCase?: UpdateTenantIntegrationsUseCase,
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

  public getPendingInvitations = async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const pending = await this.userRepo.findPendingTenants();
      return reply.send(
        pending.map((u) => ({ id: u.id, name: u.name, email: u.email, createdAt: u.createdAt }))
      );
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

  public updatePermissions = async (request: FastifyRequest, reply: FastifyReply) => {
    const { sellerId } = request.params as { sellerId: string };
    const { permissions } = request.body as { permissions: Partial<TenantPermissions> };
    try {
      const result = await this.updateTenantPermissionsUseCase.execute({ sellerId, permissions });
      return reply.send(result);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  };

  public createTenant = async (request: FastifyRequest, reply: FastifyReply) => {
    const { name, email } = request.body as { name: string; email: string };
    try {
      const result = await this.createTenantUseCase.execute({ name, email });
      const origin = `${request.protocol}://${request.hostname}`;
      const activationUrl = `${origin}/activate/${result.activationToken}`;

      if (this.emailClient) {
        this.emailClient.sendTenantInvitation({ to: email, name, activationUrl }).catch((err) => {
          console.error("❌ [AdminController] Error enviando email de invitación:", err);
        });
      }

      return reply.status(201).send({ userId: result.userId, activationUrl });
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  };

  public resetUserPassword = async (request: FastifyRequest, reply: FastifyReply) => {
    const { userId } = request.params as { userId: string };
    const origin = request.headers.origin || process.env.APP_BASE_URL || "http://localhost:5173";
    try {
      const user = await this.userRepo.findById(userId);
      if (!user) {
        return reply.status(404).send({ error: "Usuario no encontrado." });
      }
      await this.requestPasswordResetUseCase.execute({ email: user.email, baseUrl: origin as string });
      return reply.send({ ok: true, email: user.email });
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  };

  public updateTenantIntegrations = async (request: FastifyRequest, reply: FastifyReply) => {
    const { sellerId } = request.params as { sellerId: string };
    const { integrations } = request.body as {
      integrations: {
        whatsappMode?: "platform_shared" | "custom_byo";
        customPhoneNumberId?: string;
        customAccessToken?: string;
        customWabaId?: string;
        llmProvider?: "groq" | "openai" | "anthropic";
        llmApiKey?: string;
      };
    };
    try {
      if (!this.updateTenantIntegrationsUseCase) {
        return reply.status(501).send({ error: "Integrations use case not configured" });
      }
      const result = await this.updateTenantIntegrationsUseCase.execute({ sellerId, integrations });
      return reply.send(result);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  };
}
