import { FastifyInstance } from "fastify";
import { Container } from "../../composition/container.js";
import { AuthGuards } from "../middleware/auth.js";

export function registerQuestionsRoutes(app: FastifyInstance, c: Container, guards: AuthGuards) {
  const { questionsCtrl } = c;
  const { authenticate } = guards;

  app.get("/api/questions", { preHandler: authenticate }, questionsCtrl.getQuestions);
  app.post("/api/questions/:id/approve", { preHandler: authenticate }, questionsCtrl.approve);
  app.post("/api/questions/:id/reject", { preHandler: authenticate }, questionsCtrl.reject);
  app.post("/api/whatsapp/reply", questionsCtrl.replyViaWhatsapp);
  app.post("/api/questions/:id/human-decision", { preHandler: authenticate }, questionsCtrl.humanDecision);
}
