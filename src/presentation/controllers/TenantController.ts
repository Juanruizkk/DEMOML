import { FastifyRequest, FastifyReply } from "fastify";
import { ITenantRepository } from "../../application/interfaces/ITenantRepository.js";
import { IEventRepository } from "../../application/interfaces/IEventRepository.js";
import { ILLMService } from "../../application/interfaces/ILLMService.js";

export class TenantController {
  constructor(
    private readonly tenantRepo: ITenantRepository,
    private readonly eventRepo: IEventRepository,
    private readonly llmService: ILLMService
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

  public updateSettings = async (request: FastifyRequest, reply: FastifyReply) => {
    const sellerId = (request.query as any)?.seller_id || (request as any).user?.sellerId || process.env.ML_SELLER_ID || "";
    const tenant = await this.tenantRepo.findBySellerId(sellerId);

    if (!tenant) {
      return reply.status(404).send({ error: `Vendedor ${sellerId} no encontrado.` });
    }

    tenant.updateSettings(request.body as any);
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
}
