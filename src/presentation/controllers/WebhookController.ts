import { FastifyRequest, FastifyReply } from "fastify";
import { IngestWebhookUseCase, WebhookPayload } from "../../application/use-cases/IngestWebhookUseCase.js";
import { IngestClaimWebhookUseCase } from "../../application/use-cases/IngestClaimWebhookUseCase.js";

export class WebhookController {
  constructor(
    private readonly ingestQuestionUseCase: IngestWebhookUseCase,
    private readonly ingestClaimUseCase: IngestClaimWebhookUseCase
  ) {}

  public handle = async (request: FastifyRequest<{ Body: WebhookPayload }>, reply: FastifyReply) => {
    reply.status(200).send({ received: true });

    const body = request.body || {};
    const topic = (body as any).topic as string | undefined;

    try {
      if (topic === "post_purchase" || topic === "claims") {
        await this.ingestClaimUseCase.execute(body);
      } else {
        await this.ingestQuestionUseCase.execute(body);
      }
    } catch (err) {
      request.log.error({ err }, "Error procesando webhook");
    }
  };
}
