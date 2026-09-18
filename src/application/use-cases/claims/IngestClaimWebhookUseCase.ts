import { IEventRepository } from "../../interfaces/IEventRepository.js";
import { ITenantRepository } from "../../interfaces/ITenantRepository.js";
import { EventLog } from "../../../domain/entities/EventLog.js";
import { ProcessClaimUseCase } from "./ProcessClaimUseCase.js";
import { WebhookPayload } from "../questions/IngestWebhookUseCase.js";

export class IngestClaimWebhookUseCase {
  constructor(
    private readonly processClaimUseCase: ProcessClaimUseCase,
    private readonly eventRepo: IEventRepository,
    private readonly tenantRepo: ITenantRepository,
  ) {}

  public async execute(payload: WebhookPayload): Promise<{ queued: boolean; claimId?: string }> {
    const { topic, resource, user_id, actions } = payload;

    const isClaim =
      (topic === "post_purchase" && Array.isArray(actions) && actions.includes("claims")) ||
      topic === "claims";

    if (!isClaim || !resource) {
      return { queued: false };
    }

    // resource format: "post-purchase/v1/claims/5108684499"
    const match = /claims\/(\d+)/.exec(resource);
    if (!match) {
      return { queued: false };
    }

    const claimId = match[1];
    const sellerId = String(user_id || process.env.ML_SELLER_ID || "");

    // Plan gate: only Pro+ plans include claims management
    const tenant = await this.tenantRepo.findBySellerId(sellerId);
    if (tenant && !tenant.canAccessClaims()) {
      await this.eventRepo.log(
        new EventLog({
          sellerId,
          type: "claims_plan_blocked",
          message: `⛔ Reclamo recibido pero el plan "${tenant.settings.planId}" no incluye gestión de reclamos.`,
        })
      );
      return { queued: false };
    }

    await this.eventRepo.log(
      new EventLog({
        sellerId,
        type: "webhook_received",
        message: `📥 Webhook reclamo recibido (claim_id: ${claimId}, seller_id: ${sellerId})`,
      })
    );

    // Fire-and-forget after responding 200 to ML
    this.processClaimUseCase.execute({ claimId, sellerId }).catch((err) => {
      console.error("[IngestClaimWebhookUseCase] Error procesando reclamo:", err);
    });

    return { queued: true, claimId };
  }
}
