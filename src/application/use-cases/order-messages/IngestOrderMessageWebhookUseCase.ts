import { IEventRepository } from "../../interfaces/IEventRepository.js";
import { EventLog } from "../../../domain/entities/EventLog.js";
import { ProcessOrderMessageUseCase } from "./ProcessOrderMessageUseCase.js";
import { WebhookPayload } from "../questions/IngestWebhookUseCase.js";

export class IngestOrderMessageWebhookUseCase {
  constructor(
    private readonly processOrderMessageUseCase: ProcessOrderMessageUseCase,
    private readonly eventRepo: IEventRepository
  ) {}

  public async execute(payload: WebhookPayload): Promise<{ queued: boolean; packId?: string; messageId?: string }> {
    const { topic, resource, user_id } = payload;

    if (topic !== "messages" || !resource) {
      return { queued: false };
    }

    const sellerId = String(user_id || process.env.ML_SELLER_ID || "");

    // Examples of resource:
    // "/messages/packs/2000004567/sellers/3680586616"
    // "/messages/12345678"
    // "/packs/2000004567/messages"
    const packMatch = /packs\/(\d+)/.exec(resource);
    const messageMatch = /messages\/(\d+)/.exec(resource);

    const packId = packMatch ? packMatch[1] : undefined;
    const messageId = messageMatch ? messageMatch[1] : undefined;

    await this.eventRepo.log(
      new EventLog({
        sellerId,
        type: "webhook_received",
        message: `📥 Webhook mensaje post-venta recibido (pack_id: ${packId || "N/D"}, resource: ${resource})`,
      })
    );

    // Fire-and-forget processing
    this.processOrderMessageUseCase.execute({
      resource,
      sellerId,
      packId,
      messageId,
    }).catch((err) => {
      console.error("[IngestOrderMessageWebhookUseCase] Error procesando mensaje:", err);
    });

    return { queued: true, packId, messageId };
  }
}
