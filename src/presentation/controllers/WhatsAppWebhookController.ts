// src/presentation/controllers/WhatsAppWebhookController.ts
import { FastifyRequest, FastifyReply } from "fastify";
import { HandleWhatsAppReplyUseCase } from "../../application/use-cases/HandleWhatsAppReplyUseCase.js";

export class WhatsAppWebhookController {
  constructor(private readonly handleReplyUseCase: HandleWhatsAppReplyUseCase) {}

  // GET /webhook/whatsapp — Meta challenge verification
  public verify = async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as Record<string, string>;
    const mode = query["hub.mode"];
    const token = query["hub.verify_token"];
    const challenge = query["hub.challenge"];

    if (mode === "subscribe" && token === process.env.META_WA_VERIFY_TOKEN) {
      return reply.status(200).send(challenge);
    }
    return reply.status(403).send("Forbidden");
  };

  // POST /webhook/whatsapp — incoming messages from Meta
  public receive = async (request: FastifyRequest, reply: FastifyReply) => {
    // Always respond 200 immediately to Meta
    reply.status(200).send({ ok: true });

    try {
      const body = request.body as any;
      const entry = body?.entry?.[0];
      const changes = entry?.changes?.[0];
      const value = changes?.value;
      const messages = value?.messages;

      if (!Array.isArray(messages) || messages.length === 0) return;

      for (const msg of messages) {
        const from: string = msg.from || "";

        if (msg.type === "interactive" && msg.interactive?.type === "button_reply") {
          const buttonReplyId: string = msg.interactive.button_reply.id;
          await this.handleReplyUseCase.execute({ from, buttonReplyId });
        } else if (msg.type === "text" && msg.text?.body) {
          await this.handleReplyUseCase.execute({ from, text: msg.text.body });
        }
      }
    } catch (err) {
      console.error("[WhatsAppWebhookController] Error procesando mensaje:", err);
    }
  };
}
