import { IEventRepository } from "../interfaces/IEventRepository.js";
import { EventLog } from "../../domain/entities/EventLog.js";
import { ProcessClaimUseCase } from "./ProcessClaimUseCase.js";
import { WebhookPayload } from "./IngestWebhookUseCase.js";

export class IngestClaimWebhookUseCase {
  constructor(
    private readonly processClaimUseCase: ProcessClaimUseCase,
    private readonly eventRepo: IEventRepository
  ) {}

  public async execute(payload: WebhookPayload): Promise<{ queued: boolean; claimId?: string }> {
    const { topic, resource, user_id, actions } = payload as any;

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
