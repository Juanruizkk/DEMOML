import { FastifyRequest, FastifyReply } from "fastify";
import { IngestWebhookUseCase, WebhookPayload } from "../../application/use-cases/IngestWebhookUseCase.js";

export class WebhookController {
  constructor(private readonly ingestUseCase: IngestWebhookUseCase) {}

  public handle = async (request: FastifyRequest<{ Body: WebhookPayload }>, reply: FastifyReply) => {
    // Responder de inmediato (< 50ms) a Mercado Libre
    reply.status(200).send({ received: true });

    // Procesar asíncronamente
    try {
      await this.ingestUseCase.execute(request.body);
    } catch (err) {
      request.log.error({ err }, "Error procesando webhook");
    }
  };
}
