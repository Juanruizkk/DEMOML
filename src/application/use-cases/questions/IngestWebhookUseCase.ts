import { IQueueBroker } from "../interfaces/IQueueBroker.js";
import { IEventRepository } from "../interfaces/IEventRepository.js";
import { EventLog } from "../../domain/entities/EventLog.js";

export interface WebhookPayload {
  resource?: string;
  user_id?: number | string;
  topic?: string;
  application_id?: number | string;
  attempts?: number;
  sent?: string;
  received?: string;
  actions?: string[];
}

export class IngestWebhookUseCase {
  constructor(
    private readonly queueBroker: IQueueBroker,
    private readonly eventRepo: IEventRepository
  ) {}

  public async execute(payload: WebhookPayload): Promise<{ queued: boolean; questionId?: string }> {
    const { topic, resource, user_id } = payload || {};

    if (topic !== "questions" || !resource) {
      return { queued: false };
    }

    const match = /\/questions\/(\d+)/.exec(resource);
    if (!match) {
      return { queued: false };
    }

    const questionId = match[1];
    const sellerId = String(user_id || process.env.ML_SELLER_ID || "");

    await this.eventRepo.log(
      new EventLog({
        sellerId,
        questionId,
        type: "webhook_received",
        message: `📥 Webhook recibido (question_id: ${questionId}, seller_id: ${sellerId})`,
      })
    );

    await this.queueBroker.enqueue({ questionId, sellerId });
    return { queued: true, questionId };
  }
}
