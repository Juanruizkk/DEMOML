import { FastifyRequest, FastifyReply } from "fastify";
import { IClaimRepository } from "../../application/interfaces/IClaimRepository.js";
import { ITenantRepository } from "../../application/interfaces/ITenantRepository.js";
import { IEventRepository } from "../../application/interfaces/IEventRepository.js";
import { IRealtimeNotifier } from "../../application/interfaces/IRealtimeNotifier.js";
import { IWhatsAppClient } from "../../application/interfaces/IWhatsAppClient.js";
import { ITelegramClient } from "../../application/interfaces/ITelegramClient.js";
import { IMeliClient } from "../../application/interfaces/IMeliClient.js";
import { ProcessClaimUseCase } from "../../application/use-cases/ProcessClaimUseCase.js";
import { Claim, ClaimType, ClaimAction } from "../../domain/entities/Claim.js";
import { EventLog } from "../../domain/entities/EventLog.js";
import { paginateArray } from "../../domain/value-objects/Pagination.js";

export class ClaimsController {
  constructor(
    private readonly claimRepo: IClaimRepository,
    private readonly tenantRepo: ITenantRepository,
    private readonly eventRepo: IEventRepository,
    private readonly sseNotifier: IRealtimeNotifier,
    private readonly whatsAppClient: IWhatsAppClient,
    private readonly meliClient: IMeliClient,
    private readonly processClaimUseCase: ProcessClaimUseCase,
    private readonly telegramClient?: ITelegramClient
  ) {}

  public getClaims = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = (request as any).user;
      const query = request.query as {
        seller_id?: string;
        status?: "opened" | "closed";
        sync?: string;
        page?: string | number;
        limit?: string | number;
      };
      
      const sellerId = user?.sellerId || query.seller_id || process.env.ML_SELLER_ID || "3680586616";
      const page = Number(query.page) || 1;
      const limit = Number(query.limit) || 20;

      // Sincronización manual con MELI sólo si se solicita explícitamente con ?sync=true
      if (query.sync === "true") {
        try {
          const meliClaims = await this.meliClient.searchClaims(sellerId, "opened");
          for (const raw of meliClaims) {
            await this.processClaimUseCase.execute({ claimId: String(raw.id), sellerId });
          }
        } catch (syncErr) {
          // Si no tiene token o falla, continuar con los reclamos de la base de datos
        }
      }

      const claims = await this.claimRepo.listBySellerId(sellerId, query.status);

      const now = new Date();
      const enriched = claims.map((c) => ({
        id: c.id,
        sellerId: c.sellerId,
        orderId: c.orderId,
        type: c.type,
        stage: c.stage,
        status: c.status,
        reason: c.reason,
        buyerId: c.buyerId,
        actions: c.actions,
        dueDate: c.dueDate.toISOString(),
        remainingHours: c.getRemainingHours(now),
        urgency: c.getUrgency(now),
        notifiedAt: c.notifiedAt ? c.notifiedAt.toISOString() : null,
        createdAt: c.createdAt.toISOString(),
        updatedAt: c.updatedAt.toISOString(),
      }));

      // Sort by urgency/due date ascending
      enriched.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

      const { data: paginatedClaims, pagination } = paginateArray(enriched, page, limit);

      return reply.send({
        success: true,
        pagination,
        claims: paginatedClaims,
        metrics: {
          total: enriched.length,
          critical: enriched.filter((c) => c.urgency === "critical" && c.status === "opened").length,
          high: enriched.filter((c) => c.urgency === "high" && c.status === "opened").length,
          normal: enriched.filter((c) => c.urgency === "normal" && c.status === "opened").length,
          closed: enriched.filter((c) => c.status === "closed").length,
        },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return reply.status(500).send({ error: `Error al obtener reclamos: ${msg}` });
    }
  };

  public simulate = async (
    request: FastifyRequest<{
      Body: {
        sellerId?: string;
        type?: ClaimType;
        reason?: string;
        orderId?: string;
        hoursUntilDue?: number;
      };
    }>,
    reply: FastifyReply
  ) => {
    try {
      const body = request.body || {};
      const sellerId = body.sellerId || process.env.ML_SELLER_ID || "3680586616";
      const type: ClaimType = body.type || "med_pdd";
      const reason = body.reason || (type === "med_pdd" ? "PDD - Producto no funciona adecuadamente" : type === "med_pnr" ? "PNR - Paquete demorado o no entregado" : "Devolución express");
      const orderId = body.orderId || String(2000000000 + Math.floor(Math.random() * 900000000));
      const claimId = String(5100000000 + Math.floor(Math.random() * 90000000));
      const hoursUntilDue = body.hoursUntilDue !== undefined ? body.hoursUntilDue : (type === "med_pdd" ? 8 : 24);

      const now = new Date();
      const dueDate = new Date(now.getTime() + hoursUntilDue * 60 * 60 * 1000);

      const actions: ClaimAction[] = [
        {
          action: "respond_claim",
          dueDate: dueDate,
          mandatory: true,
        },
      ];

      const claim = new Claim({
        id: claimId,
        sellerId,
        orderId,
        type,
        stage: "claim",
        status: "opened",
        reason,
        buyerId: "3677130936",
        actions,
        dueDate,
        createdAt: now,
        updatedAt: now,
      });

      await this.claimRepo.save(claim);

      await this.eventRepo.log(
        new EventLog({
          sellerId,
          type: "claim_received",
          message: `⚖️ [Simulador] Reclamo #${claimId} ingresado — Tipo: ${type.toUpperCase()}, SLA: ${hoursUntilDue}hs restantes`,
        })
      );

      // WhatsApp notification
      const tenant = await this.tenantRepo.findBySellerId(sellerId);
      const phone = tenant?.settings?.whatsappAlertPhone || "+5491100000000";
      const urgency = claim.getUrgency(now);
      const urgencyEmoji = urgency === "critical" ? "🔴" : urgency === "high" ? "🟠" : "🟡";
      const typeLabel = type === "med_pnr" ? "Paquete no recibido (PNR)" : type === "med_pdd" ? "Producto defectuoso (PDD)" : "Devolución / Reclamo";

      const bodyText =
        `${urgencyEmoji} *NUEVO RECLAMO en Mercado Libre*\n\n` +
        `📦 Orden: #${claim.orderId}\n` +
        `🔖 Tipo: ${typeLabel}\n` +
        `📝 Motivo: ${reason}\n` +
        `⏳ Tiempo límite SLA: *${claim.getRemainingHours(now)} horas*\n` +
        `🆔 Reclamo: #${claimId}\n\n` +
        `Respondé a tiempo antes del vencimiento para proteger tu reputación.`;

      if (tenant?.canSendWhatsAppAlert()) {
        const creds = tenant.getWhatsAppCredentials();
        await this.whatsAppClient.sendInteractiveButtons({
          to: phone,
          bodyText,
          buttons: [{ id: `claim_ack_${claimId}`, title: "✅ Enterado" }],
          credentials: creds ?? undefined,
        }).catch((e) => console.warn("WhatsApp send ignored in simulation:", e.message));

        if (tenant.settings.whatsappMode === "platform_shared") {
          tenant.incrementAlertsSent();
          await this.tenantRepo.save(tenant);
        }
      }

      if (this.telegramClient && tenant?.canSendTelegramAlert()) {
        const creds = tenant.getTelegramCredentials();
        if (creds?.chatId) {
          await this.telegramClient.sendMessage({
            chatId: creds.chatId,
            text:
              `${urgencyEmoji} *NUEVO RECLAMO en Mercado Libre*\n\n` +
              `📦 *Orden:* #${claim.orderId}\n` +
              `🔖 *Tipo:* ${typeLabel}\n` +
              `📝 *Motivo:* ${reason}\n` +
              `⏳ *Tiempo restante:* *${claim.getRemainingHours(now)} horas*\n` +
              `🆔 *Reclamo:* #${claimId}\n\n` +
              `⚠️ Respondé dentro del plazo para evitar penalizaciones automáticas.`,
            buttons: [
              [
                { text: "✅ Enterado", callbackData: `claim_ack_${claimId}` },
              ],
            ],
            botToken: creds.botToken,
          }).catch((e) => console.warn("Telegram send ignored in simulation:", e.message));
        }
      }

      claim.markNotified();
      await this.claimRepo.save(claim);

      // Real-time SSE Broadcast
      this.sseNotifier.broadcastToSeller(sellerId, "claim_received", {
        claim_id: claimId,
        order_id: claim.orderId,
        type: claim.type,
        reason: claim.reason,
        urgency: claim.getUrgency(now),
        remaining_hours: claim.getRemainingHours(now),
        due_date: claim.dueDate.toISOString(),
        body_text: bodyText,
      });

      return reply.status(201).send({
        success: true,
        claim: {
          id: claim.id,
          orderId: claim.orderId,
          type: claim.type,
          reason: claim.reason,
          dueDate: claim.dueDate.toISOString(),
          remainingHours: claim.getRemainingHours(now),
          urgency: claim.getUrgency(now),
        },
        message: "Reclamo simulado exitosamente",
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return reply.status(500).send({ error: `Error al simular reclamo: ${msg}` });
    }
  };

  public acknowledge = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id: claimId } = (request.params as any) || {};
      const claim = await this.claimRepo.findById(claimId);
      if (!claim) {
        return reply.status(404).send({ error: "Reclamo no encontrado." });
      }

      claim.markNotified();
      await this.claimRepo.save(claim);

      await this.eventRepo.log(
        new EventLog({
          sellerId: claim.sellerId,
          type: "claim_acknowledged",
          message: `✅ Operador marcó como en gestión el reclamo #${claimId}`,
        })
      );

      this.sseNotifier.broadcastToSeller(claim.sellerId, "claim_updated", {
        claim_id: claimId,
        status: claim.status,
        notified_at: claim.notifiedAt?.toISOString(),
      });

      return reply.send({ success: true, claimId, status: claim.status, notifiedAt: claim.notifiedAt?.toISOString() });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return reply.status(500).send({ error: `Error al confirmar reclamo: ${msg}` });
    }
  };

  public unacknowledge = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id: claimId } = (request.params as any) || {};
      const claim = await this.claimRepo.findById(claimId);
      if (!claim) {
        return reply.status(404).send({ error: "Reclamo no encontrado." });
      }

      claim.resetNotified();
      await this.claimRepo.save(claim);

      await this.eventRepo.log(
        new EventLog({
          sellerId: claim.sellerId,
          type: "claim_unacknowledged",
          message: `↩ Operador devolvió a pendientes el reclamo #${claimId}`,
        })
      );

      this.sseNotifier.broadcastToSeller(claim.sellerId, "claim_updated", {
        claim_id: claimId,
        status: claim.status,
        notified_at: null,
      });

      return reply.send({ success: true, claimId, status: claim.status, notifiedAt: null });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return reply.status(500).send({ error: `Error al devolver reclamo a pendientes: ${msg}` });
    }
  };

  public closeClaim = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id: claimId } = (request.params as any) || {};
      const claim = await this.claimRepo.findById(claimId);
      if (!claim) {
        return reply.status(404).send({ error: "Reclamo no encontrado." });
      }

      claim.close();
      await this.claimRepo.save(claim);

      await this.eventRepo.log(
        new EventLog({
          sellerId: claim.sellerId,
          type: "claim_closed",
          message: `🟢 Operador marcó como resuelto/cerrado el reclamo #${claimId}`,
        })
      );

      this.sseNotifier.broadcastToSeller(claim.sellerId, "claim_updated", {
        claim_id: claimId,
        status: claim.status,
      });

      return reply.send({ success: true, claimId, status: claim.status });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return reply.status(500).send({ error: `Error al cerrar reclamo: ${msg}` });
    }
  };

  public reopenClaim = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id: claimId } = (request.params as any) || {};
      const claim = await this.claimRepo.findById(claimId);
      if (!claim) {
        return reply.status(404).send({ error: "Reclamo no encontrado." });
      }

      claim.reopen();
      await this.claimRepo.save(claim);

      await this.eventRepo.log(
        new EventLog({
          sellerId: claim.sellerId,
          type: "claim_reopened",
          message: `🔄 Operador reabrió el reclamo #${claimId}`,
        })
      );

      this.sseNotifier.broadcastToSeller(claim.sellerId, "claim_updated", {
        claim_id: claimId,
        status: claim.status,
      });

      return reply.send({ success: true, claimId, status: claim.status });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return reply.status(500).send({ error: `Error al reabrir reclamo: ${msg}` });
    }
  };
}
