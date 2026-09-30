import { FastifyRequest, FastifyReply } from "fastify";
import { IngestWebhookUseCase, WebhookPayload } from "../../application/use-cases/questions/IngestWebhookUseCase.js";
import { IngestClaimWebhookUseCase } from "../../application/use-cases/claims/IngestClaimWebhookUseCase.js";
import { IngestOrderMessageWebhookUseCase } from "../../application/use-cases/order-messages/IngestOrderMessageWebhookUseCase.js";

export class WebhookController {
  constructor(
    private readonly ingestQuestionUseCase: IngestWebhookUseCase,
    private readonly ingestClaimUseCase: IngestClaimWebhookUseCase,
    private readonly ingestOrderMessageUseCase?: IngestOrderMessageWebhookUseCase
  ) {}

  public handle = async (request: FastifyRequest<{ Body: WebhookPayload }>, reply: FastifyReply) => {
    reply.status(200).send({ received: true });

    const body = request.body || {};
    const topic = (body as any).topic as string | undefined;

    try {
      if (topic === "messages" && this.ingestOrderMessageUseCase) {
        await this.ingestOrderMessageUseCase.execute(body);
      } else if (topic === "post_purchase" || topic === "claims") {
        await this.ingestClaimUseCase.execute(body);
      } else {
        await this.ingestQuestionUseCase.execute(body);
      }
    } catch (err) {
      request.log.error({ err }, "Error procesando webhook");
    }
  };
}

