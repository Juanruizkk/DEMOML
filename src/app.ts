import fastify, { FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import fastifyStatic from "@fastify/static";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { buildContainer, Container } from "./composition/container.js";
import { createAuthGuards } from "./presentation/middleware/auth.js";
import { registerAuthRoutes } from "./presentation/routes/authRoutes.js";
import { registerAdminRoutes } from "./presentation/routes/adminRoutes.js";
import { registerWebhookRoutes } from "./presentation/routes/webhookRoutes.js";
import { registerQuestionsRoutes } from "./presentation/routes/questionsRoutes.js";
import { registerOrderMessagesRoutes } from "./presentation/routes/orderMessagesRoutes.js";
import { registerClaimsRoutes } from "./presentation/routes/claimsRoutes.js";
import { registerDemoRoutes } from "./presentation/routes/demoRoutes.js";
import { registerProductsRoutes } from "./presentation/routes/productsRoutes.js";
import { registerTenantRoutes } from "./presentation/routes/tenantRoutes.js";
import { registerLeadRoutes } from "./presentation/routes/leadRoutes.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function buildApp(container: Container = buildContainer()): FastifyInstance {
  const app = fastify({ logger: true });

  // Global error handler — evita que errores de infraestructura (DB, etc.) lleguen al cliente
  app.setErrorHandler((error: { statusCode?: number; message?: string }, request, reply) => {
    request.log.error({ err: error }, "Error no capturado");
    if (reply.sent) return;
    const statusCode = error.statusCode ?? 500;
    if (statusCode >= 500) {
      return reply.status(500).send({ error: "Ha ocurrido un error inesperado. Intente nuevamente." });
    }
    return reply.status(statusCode).send({ error: error.message ?? "Error desconocido." });
  });

  // Plugins
  app.register(cors, { origin: "*" });
  app.register(rateLimit, {
    global: false, // aplicamos rate limit por ruta, no globalmente
    keyGenerator: (request) =>
      (request.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ??
      request.ip,
  });
  app.register(fastifyStatic, {
    root: path.join(__dirname, "../public"),
    prefix: "/",
  });

  // Wiring de dependencias y rutas
  const guards = createAuthGuards(container.tokenService);

  registerAuthRoutes(app, container, guards);
  registerAdminRoutes(app, container, guards);
  registerWebhookRoutes(app, container);
  registerQuestionsRoutes(app, container, guards);
  registerOrderMessagesRoutes(app, container, guards);
  registerClaimsRoutes(app, container, guards);
  registerDemoRoutes(app, container, guards);
  registerProductsRoutes(app, container, guards);
  registerTenantRoutes(app, container, guards);
  registerLeadRoutes(app, container, guards);

  // SPA fallback — any route not matched by /api/* serves the React app
  app.setNotFoundHandler((_request, reply) => {
    reply.sendFile('app/index.html')
  });

  return app;
}
