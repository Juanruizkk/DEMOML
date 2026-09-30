import { FastifyInstance } from "fastify";
import { Container } from "../../composition/container.js";

// Públicas — llamadas por servicios externos (Mercado Libre, Meta, Telegram)
export function registerWebhookRoutes(app: FastifyInstance, c: Container) {
  const { webhookCtrl, waWebhookCtrl, telegramCtrl } = c;

  app.post("/webhook/ml", webhookCtrl.handle);
  app.get("/webhook/whatsapp", waWebhookCtrl.verify);
  app.post("/webhook/whatsapp", waWebhookCtrl.receive);
  app.post("/webhook/telegram", telegramCtrl.receive);
}
