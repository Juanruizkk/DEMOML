import { FastifyRequest, FastifyReply } from "fastify";
import { ITenantRepository } from "../../application/interfaces/ITenantRepository.js";
import { IEventRepository } from "../../application/interfaces/IEventRepository.js";
import { ILLMService } from "../../application/interfaces/ILLMService.js";
import { ListTeamMembersUseCase } from "../../application/use-cases/tenant/ListTeamMembersUseCase.js";
import { InviteTeamMemberUseCase } from "../../application/use-cases/tenant/InviteTeamMemberUseCase.js";
import { RemoveTeamMemberUseCase } from "../../application/use-cases/tenant/RemoveTeamMemberUseCase.js";
import { GetTenantSettingsUseCase } from "../../application/use-cases/tenant/GetTenantSettingsUseCase.js";
import { UpdateTenantSettingsUseCase } from "../../application/use-cases/tenant/UpdateTenantSettingsUseCase.js";
import { SendTestEmailUseCase } from "../../application/use-cases/tenant/SendTestEmailUseCase.js";

export class TenantController {
  constructor(
    private readonly tenantRepo: ITenantRepository,
    private readonly eventRepo: IEventRepository,
    private readonly llmService: ILLMService,
    private readonly getTenantSettingsUseCase: GetTenantSettingsUseCase,
    private readonly updateTenantSettingsUseCase: UpdateTenantSettingsUseCase,
    private readonly sendTestEmailUseCase: SendTestEmailUseCase,
    private readonly listTeamMembersUseCase?: ListTeamMembersUseCase,
    private readonly inviteTeamMemberUseCase?: InviteTeamMemberUseCase,
    private readonly removeTeamMemberUseCase?: RemoveTeamMemberUseCase
  ) {}

  private resolveSellerId(request: FastifyRequest, from: "query" | "body" = "query"): string {
    const user = (request as any).user;
    if (user?.role === "tenant") {
      return user.sellerId || "";
    }
    const source = from === "body" ? (request.body as any) : (request.query as any);
    return source?.seller_id || process.env.ML_SELLER_ID || "";
  }

  public getHealth = async (request: FastifyRequest, reply: FastifyReply) => {
    const sellerId = (request.query as any)?.seller_id || process.env.ML_SELLER_ID || "";
    const tenant = sellerId ? await this.tenantRepo.findBySellerId(sellerId) : null;

    return reply.send({
      ok: true,
      tokenStatus: {
        connected: Boolean(tenant),
        sellerId: tenant?.sellerId,
        expiresAt: tenant?.expiresAt,
        expiresInMs: tenant ? tenant.expiresAt - Date.now() : 0,
      },
      llmProvider: this.llmService.getProviderLabel(),
      autoAnswerEnabled: tenant?.settings.autoAnswerEnabled ?? true,
      authorizeUrl: `https://auth.mercadolibre.com.ar/authorization?response_type=code&client_id=${process.env.ML_CLIENT_ID}&redirect_uri=${encodeURIComponent(process.env.ML_REDIRECT_URI || "")}`,
    });
  };

  public getSettings = async (request: FastifyRequest, reply: FastifyReply) => {
    const sellerId = this.resolveSellerId(request);
    if (!sellerId) {
      return reply.status(400).send({ error: "No hay una tienda vinculada a este usuario." });
    }

    const view = await this.getTenantSettingsUseCase.execute(sellerId);
    if (!view) {
      return reply.status(404).send({ error: `Vendedor ${sellerId} no encontrado.` });
    }

    return reply.send(view);
  };

  public updateSettings = async (request: FastifyRequest, reply: FastifyReply) => {
    const sellerId = this.resolveSellerId(request);
    if (!sellerId) {
      return reply.status(400).send({ error: "No hay una tienda vinculada a este usuario." });
    }

    const result = await this.updateTenantSettingsUseCase.execute({
      sellerId,
      settings: (request.body as any) || {},
    });
    if (!result) {
      return reply.status(404).send({ error: `Vendedor ${sellerId} no encontrado.` });
    }

    return reply.send({
      ok: true,
      message: "Configuración actualizada correctamente.",
      settings: result.settings,
      permissions: result.permissions,
    });
  };

  public getEvents = async (request: FastifyRequest, reply: FastifyReply) => {
    const since = Number((request.query as any)?.since) || 0;
    const sellerId = this.resolveSellerId(request);
    const events = sellerId
      ? await this.eventRepo.getRecentBySellerId(sellerId, since)
      : await this.eventRepo.getRecent(since);

    return reply.send(events);
  };

  public sendTestEmail = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user;
    const body = (request.body as any) || {};
    const sellerId = this.resolveSellerId(request, "body");

    const result = await this.sendTestEmailUseCase.execute({
      sellerId,
      requestedEmail: body.email,
      fallbackEmail: user?.email,
      fallbackName: user?.name,
    });

    if (!result.ok) {
      return reply.status(result.status).send({ error: result.error });
    }

    return reply.send({
      ok: true,
      message: `Email de prueba enviado exitosamente a ${result.targetEmail}`,
      messageId: result.messageId,
    });
  };

  public getTeamMembers = async (request: FastifyRequest, reply: FastifyReply) => {
    const sellerId = this.resolveSellerId(request);
    if (!sellerId) {
      return reply.status(400).send({ error: "No hay una tienda vinculada a este usuario." });
    }

    if (!this.listTeamMembersUseCase) {
      return reply.status(500).send({ error: "Caso de uso no inicializado." });
    }

    try {
      const result = await this.listTeamMembersUseCase.execute(sellerId);
      return reply.send(result);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  };

  public inviteTeamMember = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user;
    const sellerId = this.resolveSellerId(request, "body");
    if (!sellerId) {
      return reply.status(400).send({ error: "No hay una tienda vinculada a este usuario." });
    }

    const { name, email } = (request.body as any) || {};
    if (!name || !email) {
      return reply.status(400).send({ error: "Nombre y correo electrónico son obligatorios." });
    }

    if (!this.inviteTeamMemberUseCase) {
      return reply.status(500).send({ error: "Caso de uso no inicializado." });
    }

    const originUrl = request.headers.origin || process.env.APP_BASE_URL || "http://localhost:5173";

    try {
      const result = await this.inviteTeamMemberUseCase.execute({
        sellerId,
        name,
        email,
        originUrl: originUrl as string,
        invitedByUserId: user?.userId,
      });
      return reply.status(201).send(result);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  };

  public removeTeamMember = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user;
    const sellerId = this.resolveSellerId(request);
    const { memberId } = request.params as { memberId: string };

    if (!sellerId) {
      return reply.status(400).send({ error: "No hay una tienda vinculada a este usuario." });
    }

    if (!this.removeTeamMemberUseCase) {
      return reply.status(500).send({ error: "Caso de uso no inicializado." });
    }

    try {
      const result = await this.removeTeamMemberUseCase.execute({
        sellerId,
        memberId,
        requesterUserId: user?.userId,
      });
      return reply.send(result);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  };
}
