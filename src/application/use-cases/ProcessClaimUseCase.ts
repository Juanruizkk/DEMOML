import { IClaimRepository } from "../interfaces/IClaimRepository.js";
import { ITenantRepository } from "../interfaces/ITenantRepository.js";
import { IEventRepository } from "../interfaces/IEventRepository.js";
import { IMeliClient } from "../interfaces/IMeliClient.js";
import { IWhatsAppClient } from "../interfaces/IWhatsAppClient.js";
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
    private readonly sseNotifier: IRealtimeNotifier
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
      });

      // 3. Persist
      await this.claimRepo.save(claim);

      await this.eventRepo.log(
        new EventLog({
          sellerId,
          type: "claim_received",
          message: `⚖️ Reclamo ${claimId} procesado — tipo: ${type}, urgencia: ${claim.getUrgency()}, horas restantes: ${claim.getRemainingHours()}`,
        })
      );

      // 4. Send WhatsApp alert
      const tenant = await this.tenantRepo.findBySellerId(sellerId);
      const phone = tenant?.settings?.whatsappAlertPhone;

      if (phone) {
        const urgencyEmoji = claim.getUrgency() === "critical" ? "🔴" : claim.getUrgency() === "high" ? "🟠" : "🟡";
        const typeLabel = type === "med_pnr" ? "Paquete no recibido (PNR)" : type === "med_pdd" ? "Producto defectuoso (PDD)" : "Reclamo";

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
        });

        claim.markNotified();
        await this.claimRepo.save(claim);

        await this.eventRepo.log(
          new EventLog({
            sellerId,
            type: "claim_notified",
            message: `📲 Alerta WhatsApp enviada para reclamo ${claimId}`,
          })
        );
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
    } catch (err: any) {
      await this.eventRepo.log(
        new EventLog({
          sellerId,
          type: "error",
          message: `❌ Error procesando reclamo ${claimId}: ${err.message}`,
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
