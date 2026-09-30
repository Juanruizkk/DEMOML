import { IClaimRepository } from "../../interfaces/IClaimRepository.js";
import { IEventRepository } from "../../interfaces/IEventRepository.js";
import { IMeliClient } from "../../interfaces/IMeliClient.js";
import { IRealtimeNotifier } from "../../interfaces/IRealtimeNotifier.js";
import { TenantNotificationService } from "../../services/TenantNotificationService.js";
import { Claim, ClaimAction, ClaimType } from "../../../domain/entities/Claim.js";
import { EventLog } from "../../../domain/entities/EventLog.js";
import { getClaimReasonInfo } from "../../../domain/utils/claimReasonMapper.js";

export class ProcessClaimUseCase {
  constructor(
    private readonly claimRepo: IClaimRepository,
    private readonly eventRepo: IEventRepository,
    private readonly meliClient: IMeliClient,
    private readonly sseNotifier: IRealtimeNotifier,
    private readonly notificationService: TenantNotificationService
  ) {}

  public async execute(params: { claimId: string; sellerId: string }): Promise<Claim | null> {
    const { claimId, sellerId } = params;

    try {
      // 1. Fetch claim from ML
      const raw = await this.meliClient.getClaim(sellerId, claimId);

      // 2. Map to domain
      const sellerPlayer = raw.players.find((p) => p.role === "respondent");
      const buyerPlayer = raw.players.find((p) => p.role === "complainant");

      const actions: ClaimAction[] = (sellerPlayer?.available_actions || []).map((a) => ({
        action: a.action,
        dueDate: a.due_date ? new Date(a.due_date) : null,
        mandatory: a.mandatory,
      }));

      const dueDates = actions
        .filter((a) => a.dueDate !== null)
        .map((a) => a.dueDate as Date);

      const dueDate =
        dueDates.length > 0
          ? new Date(Math.min(...dueDates.map((d) => d.getTime())))
          : new Date(Date.now() + 48 * 60 * 60 * 1000);

      const type = this.mapClaimType(raw.reason_id);
      const now = new Date();

      // Enrich with Order & Product metadata
      let itemTitle: string | undefined;
      let itemId: string | undefined;
      let buyerNickname: string | undefined;
      let itemPrice: number | undefined;
      let itemQuantity: number | undefined;
      let complainantMessage: string | undefined;

      try {
        const order = await this.meliClient.getOrder(sellerId, String(raw.resource_id));
        if (order) {
          buyerNickname = order.buyer?.nickname;
          const firstItem = order.order_items?.[0];
          if (firstItem) {
            itemTitle = firstItem.item?.title;
            itemId = firstItem.item?.id;
            itemPrice = firstItem.unit_price;
            itemQuantity = firstItem.quantity;
          }
        }
      } catch (e) {
        // Safe fallback if order fetch is not available in mock/sandbox
      }

      try {
        const claimMsgs = await this.meliClient.getClaimMessages(sellerId, claimId);
        const compMsg = claimMsgs.find(m => m.sender_role === 'complainant') || claimMsgs[0];
        if (compMsg?.message) {
          complainantMessage = compMsg.message;
        }
      } catch (e) {
        // Safe fallback if claim messages are not accessible
      }

      const reasonInfo = getClaimReasonInfo(raw.reason_id);
      const reasonDetail = `${reasonInfo.title} — ${reasonInfo.description}`;

      // Check if claim already exists
      const existing = await this.claimRepo.findById(claimId);
      const isAlreadyNotified = Boolean(existing?.notifiedAt);

      const claim = new Claim({
        id: String(raw.id),
        sellerId,
        orderId: String(raw.resource_id),
        type,
        stage: raw.stage,
        status: raw.status,
        reason: raw.reason_id,
        reasonDetail,
        buyerId: buyerPlayer ? String(buyerPlayer.user_id) : undefined,
        buyerNickname: buyerNickname ?? existing?.buyerNickname,
        itemId: itemId ?? existing?.itemId,
        itemTitle: itemTitle ?? existing?.itemTitle,
        itemPrice: itemPrice ?? existing?.itemPrice,
        itemQuantity: itemQuantity ?? existing?.itemQuantity,
        complainantMessage: complainantMessage ?? existing?.complainantMessage,
        actions,
        dueDate,
        createdAt: new Date(raw.date_created),
        updatedAt: now,
        notifiedAt: existing?.notifiedAt ?? undefined,
      });

      // 3. Persist
      await this.claimRepo.save(claim);

      // If already notified, do not resend alerts on sync/refresh
      if (isAlreadyNotified) {
        return claim;
      }

      await this.eventRepo.log(
        new EventLog({
          sellerId,
          type: "claim_received",
          message: `⚖️ Reclamo ${claimId} procesado — motivo: ${raw.reason_id} (${reasonInfo.categoryLabel}), urgencia: ${claim.getUrgency()}, horas restantes: ${claim.getRemainingHours()}`,
        })
      );

      // 4. Alertas al vendedor por los canales configurados (WhatsApp / Telegram / Email)
      const urgencyEmoji = claim.getUrgency() === "critical" ? "🔴" : claim.getUrgency() === "high" ? "🟠" : "🟡";
      const rawUrgency = claim.getUrgency();
      const emailUrgency: "critical" | "high" | "medium" | "low" =
        rawUrgency === "critical" ? "critical" : rawUrgency === "high" ? "high" : "medium";

      await this.notificationService.notify({
        sellerId,
        whatsapp: {
          bodyText:
            `${urgencyEmoji} *NUEVO RECLAMO en Mercado Libre*\n\n` +
            (claim.itemTitle ? `📦 *Producto:* ${claim.itemTitle}\n` : '') +
            `🧾 *Orden:* #${claim.orderId}\n` +
            (claim.buyerNickname ? `👤 *Comprador:* ${claim.buyerNickname}\n` : '') +
            `⚠️ *Motivo:* ${reasonInfo.code} · ${reasonInfo.categoryLabel}\n` +
            (claim.complainantMessage ? `💬 *Mensaje del Comprador:* "${claim.complainantMessage}"\n` : `📝 *Detalle:* ${reasonInfo.title}\n`) +
            `⏳ *Tiempo restante:* ${claim.getRemainingHours()} horas\n` +
            `🆔 *Reclamo:* #${claimId}\n\n` +
            `💡 *Recomendación:* ${reasonInfo.recommendation}`,
          buttons: [{ id: `claim_ack_${claimId}`, title: "✅ Enterado" }],
          successLog: {
            type: "claim_notified",
            message: `📲 Alerta WhatsApp enviada para reclamo ${claimId}`,
          },
        },
        telegram: {
          text:
            `${urgencyEmoji} *NUEVO RECLAMO en Mercado Libre*\n\n` +
            (claim.itemTitle ? `📦 *Producto:* ${claim.itemTitle}\n` : '') +
            `🧾 *Orden:* #${claim.orderId}\n` +
            (claim.buyerNickname ? `👤 *Comprador:* ${claim.buyerNickname}\n` : '') +
            `⚠️ *Motivo:* ${reasonInfo.code} · ${reasonInfo.categoryLabel}\n` +
            (claim.complainantMessage ? `💬 *Mensaje del Comprador:*\n"${claim.complainantMessage}"\n\n` : `📝 *Detalle:* ${reasonInfo.title}\n`) +
            `⏳ *Tiempo restante:* ${claim.getRemainingHours()} horas\n` +
            `🆔 *Reclamo:* #${claimId}\n\n` +
            `💡 _Consejo:_ ${reasonInfo.recommendation}\n` +
            `Respondé dentro del plazo para evitar penalizaciones automáticas en tu reputación.`,
          buttons: [
            [
              { text: "✅ Enterado", callbackData: `claim_ack_${claimId}` },
            ],
          ],
          successLog: {
            type: "claim_notified",
            buildMessage: (chatId) => `✈️ Alerta Telegram enviada para reclamo ${claimId} (Chat ID: ${chatId})`,
          },
        },
        email: {
          kind: "claim",
          send: (client, to) =>
            client.sendClaimSlaAlert({
              to,
              sellerId,
              claimId: String(claim.id),
              orderId: claim.orderId,
              reason: `${reasonInfo.title || "Reclamo"} (${claim.reason || raw.reason_id})`,
              remainingHours: claim.getRemainingHours(),
              urgency: emailUrgency,
            }),
          successLog: {
            type: "email_alert_sent",
            buildMessage: (to) => `📧 Alerta de reclamo urgente enviada por correo a ${to}`,
          },
        },
      });

      // 5. SSE broadcast
      this.sseNotifier.broadcastToSeller(sellerId, "claim_received", {
        claim_id: claimId,
        order_id: claim.orderId,
        type: claim.type,
        urgency: claim.getUrgency(),
        remaining_hours: claim.getRemainingHours(),
      });

      return claim;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await this.eventRepo.log(
        new EventLog({
          sellerId,
          type: "error",
          message: `❌ Error procesando reclamo ${claimId}: ${message}`,
        })
      );
      return null;
    }
  }

  private mapClaimType(reasonId: string): ClaimType {
    if (reasonId.startsWith("PNR")) return "med_pnr";
    if (reasonId.startsWith("PDD")) return "med_pdd";
    return "other";
  }
}
