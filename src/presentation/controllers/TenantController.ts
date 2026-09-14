import { FastifyRequest, FastifyReply } from "fastify";
import { ITenantRepository } from "../../application/interfaces/ITenantRepository.js";
import { IEventRepository } from "../../application/interfaces/IEventRepository.js";
import { ILLMService } from "../../application/interfaces/ILLMService.js";
import { IEmailClient } from "../../application/interfaces/IEmailClient.js";
import { EventLog } from "../../domain/entities/EventLog.js";

export class TenantController {
  constructor(
    private readonly tenantRepo: ITenantRepository,
    private readonly eventRepo: IEventRepository,
    private readonly llmService: ILLMService,
    private readonly emailClient?: IEmailClient
  ) {}

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
    const user = (request as any).user;
    const sellerId = user?.sellerId || (request.query as any)?.seller_id || process.env.ML_SELLER_ID || "";

    if (!sellerId) {
      return reply.status(400).send({ error: "No hay una tienda vinculada a este usuario." });
    }

    const tenant = await this.tenantRepo.findBySellerId(sellerId);
    if (!tenant) {
      return reply.status(404).send({ error: `Vendedor ${sellerId} no encontrado.` });
    }

    let tokenHealth: "healthy" | "expiring_soon" | "expired" = "healthy";
    const remainingMs = tenant.expiresAt - Date.now();
    if (remainingMs <= 0) {
      tokenHealth = "expired";
    } else if (remainingMs < 15 * 60 * 1000) {
      tokenHealth = "expiring_soon";
    }

    return reply.send({
      sellerId: tenant.sellerId,
      nickname: tenant.nickname,
      email: tenant.email,
      tokenHealth,
      expiresInMinutes: Math.max(0, Math.round(remainingMs / (60 * 1000))),
      settings: tenant.settings,
    });
  };

  public updateSettings = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user;
    const sellerId = user?.sellerId || (request.query as any)?.seller_id || process.env.ML_SELLER_ID || "";

    if (!sellerId) {
      return reply.status(400).send({ error: "No hay una tienda vinculada a este usuario." });
    }

    const tenant = await this.tenantRepo.findBySellerId(sellerId);
    if (!tenant) {
      return reply.status(404).send({ error: `Vendedor ${sellerId} no encontrado.` });
    }

    const body = (request.body as any) || {};
    tenant.updateSettings(body);
    await this.tenantRepo.save(tenant);

    return reply.send({ ok: true, settings: tenant.settings });
  };

  public getEvents = async (request: FastifyRequest, reply: FastifyReply) => {
    const since = Number((request.query as any)?.since) || 0;
    const sellerId = (request.query as any)?.seller_id || (request as any).user?.sellerId;
    const events = sellerId
      ? await this.eventRepo.getRecentBySellerId(sellerId, since)
      : await this.eventRepo.getRecent(since);

    return reply.send(events);
  };

  public sendTestEmail = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user;
    const body = (request.body as any) || {};
    const sellerId = user?.sellerId || body.seller_id || process.env.ML_SELLER_ID || "";

    const tenant = sellerId ? await this.tenantRepo.findBySellerId(sellerId) : null;
    const targetEmail = body.email || tenant?.settings.emailAlertAddress || tenant?.email || user?.email;

    if (!targetEmail) {
      return reply.status(400).send({ error: "Dirección de correo requerida para la prueba." });
    }

    if (!this.emailClient) {
      return reply.status(500).send({ error: "Cliente de correo no configurado en el servidor." });
    }

    const result = await this.emailClient.sendTestEmail({
      to: targetEmail,
      tenantName: tenant?.nickname || user?.name || "Vendedor",
    });

    if (!result.success) {
      return reply.status(400).send({ error: result.error || "Fallo al enviar correo de prueba." });
    }

    if (sellerId) {
      await this.eventRepo.log(
        new EventLog({
          sellerId,
          type: "email_test_sent",
          message: `📧 Email de prueba enviado exitosamente a ${targetEmail}`,
        })
      );
    }

    return reply.send({
      ok: true,
      message: `Email de prueba enviado exitosamente a ${targetEmail}`,
      messageId: result.messageId,
    });
  };
}
