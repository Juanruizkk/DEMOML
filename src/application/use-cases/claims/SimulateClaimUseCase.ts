import { IClaimRepository } from "../../interfaces/IClaimRepository.js";
import { ITenantRepository } from "../../interfaces/ITenantRepository.js";
import { IEventRepository } from "../../interfaces/IEventRepository.js";
import { IWhatsAppClient } from "../../interfaces/IWhatsAppClient.js";
import { ITelegramClient } from "../../interfaces/ITelegramClient.js";
import { IRealtimeNotifier } from "../../interfaces/IRealtimeNotifier.js";
import { Claim, ClaimAction, ClaimType } from "../../../domain/entities/Claim.js";
import { EventLog } from "../../../domain/entities/EventLog.js";

export interface SimulateClaimParams {
  sellerId: string;
  type?: ClaimType;
  reason?: string;
  reasonDetail?: string;
  complainantMessage?: string;
  orderId?: string;
  itemTitle?: string;
  itemId?: string;
  buyerNickname?: string;
  itemPrice?: number;
  itemQuantity?: number;
  hoursUntilDue?: number;
}

/**
 * Genera un reclamo sintético para demos/testing, con las mismas alertas que un reclamo real.
 * Nota: no usa TenantNotificationService a propósito — el simulador ignora preferredAlertChannel
 * y usa un teléfono de fallback, gates distintos a los del flujo real.
 */
export class SimulateClaimUseCase {
  constructor(
    private readonly claimRepo: IClaimRepository,
    private readonly tenantRepo: ITenantRepository,
    private readonly eventRepo: IEventRepository,
    private readonly whatsAppClient: IWhatsAppClient,
    private readonly sseNotifier: IRealtimeNotifier,
    private readonly telegramClient?: ITelegramClient
  ) {}

  public async execute(params: SimulateClaimParams): Promise<Claim> {
    const { sellerId } = params;
    const type: ClaimType = params.type || "med_pdd";
    const reason = params.reason || (type === "med_pdd" ? "PDD9949" : type === "med_pnr" ? "PNR9910" : "RET9949");
    const reasonDetail = params.reasonDetail || (
      type === "med_pdd"
        ? "El producto no enciende al conectarlo a la corriente — Falla eléctrica de fábrica"
        : type === "med_pnr"
        ? "El paquete figura demorado en la sucursal de distribución"
        : "El comprador solicita devolución por arrepentimiento dentro de compra protegida"
    );
    const complainantMessage = params.complainantMessage || (
      type === "med_pdd"
        ? "Hola, el paquete llegó a tiempo pero cuando abrí la caja y conecté el mouse al puerto USB no prende las luces ni reconoce el sensor. Probé en dos computadoras distintas y sigue sin funcionar. Por favor necesito una solución o el cambio de producto."
        : type === "med_pnr"
        ? "Hola, compré el producto hace más de 10 días y el correo todavía no lo entrega. En el seguimiento no se mueve."
        : "Hola, me equivoqué de modelo al comprar y quisiera devolverlo sin abrir."
    );
    const orderId = params.orderId || String(2000000000 + Math.floor(Math.random() * 900000000));
    const claimId = String(5100000000 + Math.floor(Math.random() * 90000000));
    const hoursUntilDue = params.hoursUntilDue !== undefined ? params.hoursUntilDue : (type === "med_pdd" ? 82 : 24);

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
      reasonDetail,
      complainantMessage,
      buyerId: "3677130936",
      buyerNickname: params.buyerNickname || "JUAN_PEREZ_99",
      itemId: params.itemId || "MLA14289456",
      itemTitle: params.itemTitle || "Mouse Gamer Logitech G203 White Lightsync 8000 DPI",
      itemPrice: params.itemPrice || 28999,
      itemQuantity: params.itemQuantity || 1,
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
        message: `⚖️ [Simulador] Reclamo #${claimId} ingresado — Producto: ${claim.itemTitle}, Motivo: ${reason}, SLA: ${hoursUntilDue}hs restantes`,
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

    return claim;
  }
}
