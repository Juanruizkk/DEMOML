import { IClaimRepository } from "../interfaces/IClaimRepository.js";
import { ITenantRepository } from "../interfaces/ITenantRepository.js";
import { IEventRepository } from "../interfaces/IEventRepository.js";
import { IMeliClient } from "../interfaces/IMeliClient.js";
import { IWhatsAppClient } from "../interfaces/IWhatsAppClient.js";
import { ITelegramClient } from "../interfaces/ITelegramClient.js";
import { IEmailClient } from "../interfaces/IEmailClient.js";
import { IRealtimeNotifier } from "../interfaces/IRealtimeNotifier.js";
import { Claim, ClaimAction, ClaimType } from "../../domain/entities/Claim.js";
import { EventLog } from "../../domain/entities/EventLog.js";

export class ProcessClaimUseCase {
  constructor(
    private readonly claimRepo: IClaimRepository,
    private readonly tenantRepo: ITenantRepository,
    private readonly eventRepo: IEventRepository,
    private readonly meliClient: IMeliClient,
    private readonly whatsAppClient: IWhatsAppClient,
    private readonly sseNotifier: IRealtimeNotifier,
    private readonly telegramClient?: ITelegramClient,
    private readonly emailClient?: IEmailClient
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
        buyerId: buyerPlayer ? String(buyerPlayer.user_id) : undefined,
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
          message: `⚖️ Reclamo ${claimId} procesado — tipo: ${type}, urgencia: ${claim.getUrgency()}, horas restantes: ${claim.getRemainingHours()}`,
        })
      );

      // 4. Send Alerts (WhatsApp & Telegram)
      const tenant = await this.tenantRepo.findBySellerId(sellerId);
      const phone = tenant?.settings?.whatsappAlertPhone;
      const channelPref = tenant?.settings?.preferredAlertChannel || "whatsapp";
      const urgencyEmoji = claim.getUrgency() === "critical" ? "🔴" : claim.getUrgency() === "high" ? "🟠" : "🟡";
      const typeLabel = type === "med_pnr" ? "Paquete no recibido (PNR)" : type === "med_pdd" ? "Producto defectuoso (PDD)" : "Reclamo";

      if (phone && tenant && (channelPref === "whatsapp" || channelPref === "both")) {
        if (tenant.canSendWhatsAppAlert()) {
          const creds = tenant.getWhatsAppCredentials();

          const bodyText =
            `${urgencyEmoji} *NUEVO RECLAMO en Mercado Libre*\n\n` +
            `📦 Orden: #${claim.orderId}\n` +
            `🔖 Tipo: ${typeLabel}\n` +
            `⏳ Tiempo restante: ${claim.getRemainingHours()} horas\n` +
            `🆔 Reclamo: ${claimId}\n\n` +
            `Respondé a tiempo para evitar penalización automática.`;

          await this.whatsAppClient.sendInteractiveButtons({
            to: phone,
            bodyText,
            buttons: [{ id: `claim_ack_${claimId}`, title: "✅ Enterado" }],
            credentials: creds ?? undefined,
          });

          if (tenant.settings.whatsappMode === "platform_shared") {
            tenant.incrementAlertsSent();
            await this.tenantRepo.save(tenant);
          }

          claim.markNotified();
          await this.claimRepo.save(claim);

          await this.eventRepo.log(
            new EventLog({
              sellerId,
              type: "claim_notified",
              message: `📲 Alerta WhatsApp enviada para reclamo ${claimId}`,
            })
          );
        } else {
          await this.eventRepo.log(
            new EventLog({
              sellerId,
              type: "WHATSAPP_QUOTA_EXCEEDED",
              message: `Límite mensual de alertas alcanzado (${tenant.settings.alertsSentThisMonth}/${tenant.settings.monthlyAlertsLimit}). Alerta omitida.`,
            })
          );
        }
      }

      // Send Telegram alert
      if (this.telegramClient && tenant?.canSendTelegramAlert() && (channelPref === "telegram" || channelPref === "both")) {
        const creds = tenant.getTelegramCredentials();
        if (creds?.chatId) {
          await this.telegramClient.sendMessage({
            chatId: creds.chatId,
            text:
              `${urgencyEmoji} *NUEVO RECLAMO en Mercado Libre*\n\n` +
              `📦 *Orden:* #${claim.orderId}\n` +
              `🔖 *Tipo:* ${typeLabel}\n` +
              `⏳ *Tiempo restante:* ${claim.getRemainingHours()} horas\n` +
              `🆔 *Reclamo:* #${claimId}\n\n` +
              `⚠️ Respondé dentro del plazo para evitar penalizaciones automáticas en tu reputación.`,
            buttons: [
              [
                { text: "✅ Enterado", callbackData: `claim_ack_${claimId}` },
              ],
            ],
            botToken: creds.botToken,
          }).catch((err) => console.error("[ProcessClaimUseCase] Error Telegram:", err));

          claim.markNotified();
          await this.claimRepo.save(claim);

          await this.eventRepo.log(
            new EventLog({
              sellerId,
              type: "claim_notified",
              message: `✈️ Alerta Telegram enviada para reclamo ${claimId} (Chat ID: ${creds.chatId})`,
            })
          );
        }
      }

      // Send Email alert if tenant has Email enabled & configured
      if (this.emailClient && tenant?.canSendEmailAlert("claim")) {
        const emailTo = tenant.getEmailAlertAddress();
        if (emailTo) {
          await this.emailClient
            .sendClaimSlaAlert({
              to: emailTo,
              sellerId,
              claimId: String(claim.id),
              orderId: claim.orderId,
              reason: typeLabel + " (" + claim.reason + ")",
              remainingHours: claim.getRemainingHours(),
              urgency: claim.getUrgency(),
            })
            .then(async (res) => {
              if (res.success) {
                await this.eventRepo.log(
                  new EventLog({
                    sellerId,
                    type: "email_alert_sent",
                    message: `📧 Alerta de reclamo urgente enviada por correo a ${emailTo}`,
                  })
                );
              }
            })
            .catch((err) => console.error("[ProcessClaimUseCase] Error Email:", err));
        }
      }

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
