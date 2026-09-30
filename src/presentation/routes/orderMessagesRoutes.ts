import { FastifyInstance } from "fastify";
import { Container } from "../../composition/container.js";
import { AuthGuards } from "../middleware/auth.js";

// Mensajería Post-Venta (Packs / Orders)
export function registerOrderMessagesRoutes(app: FastifyInstance, c: Container, guards: AuthGuards) {
  const { orderMessagesCtrl } = c;
  const { authenticate } = guards;

  app.get("/api/order-messages", { preHandler: authenticate }, orderMessagesCtrl.getMessages);
  app.post("/api/order-messages/:id/reply", { preHandler: authenticate }, orderMessagesCtrl.replyMessage);
  app.post("/api/order-messages/simulate", { preHandler: authenticate }, orderMessagesCtrl.simulate);
}
