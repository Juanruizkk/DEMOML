import { FastifyInstance } from "fastify";
import { Container } from "../../composition/container.js";
import { AuthGuards } from "../middleware/auth.js";

export function registerAdminRoutes(app: FastifyInstance, c: Container, guards: AuthGuards) {
  const { adminCtrl, llmUsageCtrl, questionsCtrl, requestPasswordResetUseCase } = c;
  const { requireSuperAdmin } = guards;

  app.get("/api/admin/metrics", { preHandler: requireSuperAdmin }, adminCtrl.getMetrics);
  app.get("/api/admin/tenants", { preHandler: requireSuperAdmin }, adminCtrl.getTenants);
  app.get("/api/admin/tenants/:sellerId", { preHandler: requireSuperAdmin }, adminCtrl.getTenantDetail);
  app.post("/api/admin/tenants/:sellerId/toggle", { preHandler: requireSuperAdmin }, adminCtrl.toggleAutoAnswer);
  app.post("/api/admin/tenants/:sellerId/refresh-token", { preHandler: requireSuperAdmin }, adminCtrl.refreshToken);
  app.put("/api/admin/tenants/:sellerId/permissions", { preHandler: requireSuperAdmin }, adminCtrl.updatePermissions);
  app.patch("/api/admin/tenants/:sellerId/integrations", { preHandler: requireSuperAdmin }, adminCtrl.updateTenantIntegrations);
  app.get("/api/admin/llm-usage", { preHandler: requireSuperAdmin }, llmUsageCtrl.getAdminStats);
  app.post("/api/admin/tenants", { preHandler: requireSuperAdmin }, adminCtrl.createTenant);
  app.get("/api/admin/invitations", { preHandler: requireSuperAdmin }, adminCtrl.getPendingInvitations);
  app.get("/api/admin/unconnected", { preHandler: requireSuperAdmin }, adminCtrl.getUnconnectedTenants);
  app.post("/api/admin/users/:userId/resend-invitation", { preHandler: requireSuperAdmin }, adminCtrl.resendInvitation);
  app.post("/api/admin/users/:userId/reset-password", { preHandler: requireSuperAdmin }, adminCtrl.resetUserPassword);
  app.post("/api/admin/reset-password", { preHandler: requireSuperAdmin }, async (request, reply) => {
    const { email } = (request.body as { email?: string }) || {};
    if (!email) return reply.status(400).send({ error: "El campo email es requerido." });
    const baseUrl = process.env.APP_BASE_URL || "http://localhost:5173";
    await requestPasswordResetUseCase.execute({ email, baseUrl }).catch(() => {});
    return reply.send({ ok: true });
  });

  // Golden dataset por tenant
  app.get("/api/admin/tenants/:sellerId/golden-dataset", { preHandler: requireSuperAdmin }, questionsCtrl.getGoldenDataset);
  app.get("/api/admin/tenants/:sellerId/golden-dataset/metrics", { preHandler: requireSuperAdmin }, questionsCtrl.getGoldenDatasetMetrics);

  app.put("/api/admin/tenants/:sellerId/plan", { preHandler: requireSuperAdmin }, adminCtrl.updateTenantPlan);
}
