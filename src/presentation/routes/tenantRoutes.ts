import { FastifyInstance } from "fastify";
import { Container } from "../../composition/container.js";
import { AuthGuards } from "../middleware/auth.js";

export function registerTenantRoutes(app: FastifyInstance, c: Container, guards: AuthGuards) {
  const { tenantCtrl, telegramCtrl, llmUsageCtrl, sseNotifier } = c;
  const { authenticate } = guards;

  // Health, eventos & settings
  app.get("/api/health", tenantCtrl.getHealth);
  app.get("/api/events", { preHandler: authenticate }, tenantCtrl.getEvents);
  app.post("/api/config/auto-answer", { preHandler: authenticate }, tenantCtrl.updateSettings);
  app.get("/api/tenant/settings", { preHandler: authenticate }, tenantCtrl.getSettings);
  app.put("/api/tenant/settings", { preHandler: authenticate }, tenantCtrl.updateSettings);

  // SSE
  app.get("/api/events/stream", { preHandler: authenticate }, (request, reply) => {
    const user = (request as any).user;
    sseNotifier.registerClient(reply, user?.sellerId);
  });

  // Integraciones Telegram & Email
  app.get("/api/tenant/telegram/info", { preHandler: authenticate }, telegramCtrl.getInfo);
  app.post("/api/tenant/telegram/test", { preHandler: authenticate }, telegramCtrl.sendTest);
  app.post("/api/tenant/channels/email/test", { preHandler: authenticate }, tenantCtrl.sendTestEmail);

  // LLM Usage
  app.get("/api/tenant/llm-usage", { preHandler: authenticate }, llmUsageCtrl.getTenantUsage);
  app.patch("/api/tenant/llm-usage/limit", { preHandler: authenticate }, llmUsageCtrl.setSpendingLimit);

  // Equipo / Colaboradores
  app.get("/api/tenant/team", { preHandler: authenticate }, tenantCtrl.getTeamMembers);
  app.post("/api/tenant/team/invite", { preHandler: authenticate }, tenantCtrl.inviteTeamMember);
  app.delete("/api/tenant/team/:memberId", { preHandler: authenticate }, tenantCtrl.removeTeamMember);
}
