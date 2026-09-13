import fastify, { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import cors from "@fastify/cors";
import fastifyStatic from "@fastify/static";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { SqliteDatabase } from "./infrastructure/persistence/sqlite/SqliteDatabase.js";
import { SqliteTenantRepository } from "./infrastructure/persistence/sqlite/SqliteTenantRepository.js";
import { SqliteQuestionRepository } from "./infrastructure/persistence/sqlite/SqliteQuestionRepository.js";
import { SqliteItemCacheRepository } from "./infrastructure/persistence/sqlite/SqliteItemCacheRepository.js";
import { SqliteEventRepository } from "./infrastructure/persistence/sqlite/SqliteEventRepository.js";
import { SqliteUserRepository } from "./infrastructure/persistence/sqlite/SqliteUserRepository.js";
import { SqliteClaimRepository } from "./infrastructure/persistence/sqlite/SqliteClaimRepository.js";

import { CryptoPasswordHasher } from "./infrastructure/security/CryptoPasswordHasher.js";
import { JwtTokenService } from "./infrastructure/security/JwtTokenService.js";

import { MeliApiClient } from "./infrastructure/meli/MeliApiClient.js";
import { LangChainLLMService } from "./infrastructure/llm/LangChainLLMService.js";
import { InMemoryQueueBroker } from "./infrastructure/queue/InMemoryQueueBroker.js";
import { FastifySseNotifier } from "./infrastructure/realtime/FastifySseNotifier.js";
import { MetaWhatsAppClient } from "./infrastructure/whatsapp/MetaWhatsAppClient.js";
import { TelegramBotClient } from "./infrastructure/telegram/TelegramBotClient.js";

import { IngestWebhookUseCase } from "./application/use-cases/IngestWebhookUseCase.js";
import { IngestClaimWebhookUseCase } from "./application/use-cases/IngestClaimWebhookUseCase.js";
import { ProcessQuestionUseCase } from "./application/use-cases/ProcessQuestionUseCase.js";
import { ProcessClaimUseCase } from "./application/use-cases/ProcessClaimUseCase.js";
import { ApproveAnswerUseCase } from "./application/use-cases/ApproveAnswerUseCase.js";
import { RejectAnswerUseCase } from "./application/use-cases/RejectAnswerUseCase.js";
import { SimulateQuestionUseCase } from "./application/use-cases/SimulateQuestionUseCase.js";
import { HandleWhatsAppReplyUseCase } from "./application/use-cases/HandleWhatsAppReplyUseCase.js";
import { HandleTelegramWebhookUseCase } from "./application/use-cases/HandleTelegramWebhookUseCase.js";

import { RegisterUserUseCase } from "./application/use-cases/auth/RegisterUserUseCase.js";
import { LoginUserUseCase } from "./application/use-cases/auth/LoginUserUseCase.js";
import { GetCurrentUserUseCase } from "./application/use-cases/auth/GetCurrentUserUseCase.js";
import { SeedSuperAdminUseCase } from "./application/use-cases/auth/SeedSuperAdminUseCase.js";
import { SeedDemoUserUseCase } from "./application/use-cases/auth/SeedDemoUserUseCase.js";
import { ConnectMeliAccountUseCase } from "./application/use-cases/auth/ConnectMeliAccountUseCase.js";
import { GetOnboardingStatusUseCase } from "./application/use-cases/auth/GetOnboardingStatusUseCase.js";

import { GetGlobalMetricsUseCase } from "./application/use-cases/admin/GetGlobalMetricsUseCase.js";
import { ListTenantsOverviewUseCase } from "./application/use-cases/admin/ListTenantsOverviewUseCase.js";
import { GetTenantDetailUseCase } from "./application/use-cases/admin/GetTenantDetailUseCase.js";
import { ToggleTenantAutoAnswerUseCase } from "./application/use-cases/admin/ToggleTenantAutoAnswerUseCase.js";
import { ForceTokenRefreshUseCase } from "./application/use-cases/admin/ForceTokenRefreshUseCase.js";
import { UpdateTenantPermissionsUseCase } from "./application/use-cases/admin/UpdateTenantPermissionsUseCase.js";

import { WebhookController } from "./presentation/controllers/WebhookController.js";
import { QuestionsController } from "./presentation/controllers/QuestionsController.js";
import { AuthController } from "./presentation/controllers/AuthController.js";
import { SimulatorController } from "./presentation/controllers/SimulatorController.js";
import { TenantController } from "./presentation/controllers/TenantController.js";
import { AdminController } from "./presentation/controllers/AdminController.js";
import { WhatsAppWebhookController } from "./presentation/controllers/WhatsAppWebhookController.js";
import { TelegramWebhookController } from "./presentation/controllers/TelegramWebhookController.js";
import { ClaimsController } from "./presentation/controllers/ClaimsController.js";
import { DemoController } from "./presentation/controllers/DemoController.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function buildApp(): FastifyInstance {
  const app = fastify({ logger: true });

  // 1. Plugins
  app.register(cors, { origin: "*" });
  app.register(fastifyStatic, {
    root: path.join(__dirname, "../public"),
    prefix: "/",
  });

  // 2. Persistencia y Seguridad
  const db = SqliteDatabase.getInstance();
  const tenantRepo = new SqliteTenantRepository(db);
  const questionRepo = new SqliteQuestionRepository(db);
  const itemCacheRepo = new SqliteItemCacheRepository(db);
  const eventRepo = new SqliteEventRepository(db);
  const userRepo = new SqliteUserRepository(db);
  const claimRepo = new SqliteClaimRepository(db);

  const passwordHasher = new CryptoPasswordHasher();
  const tokenService = new JwtTokenService();

  // 3. Adaptadores
  const meliClient = new MeliApiClient(tenantRepo);
  const llmService = new LangChainLLMService();
  const queueBroker = new InMemoryQueueBroker(5);
  const sseNotifier = new FastifySseNotifier();
  const whatsAppClient = new MetaWhatsAppClient();
  const telegramClient = new TelegramBotClient();

  // 4. Casos de Uso Auth
  const registerUserUseCase = new RegisterUserUseCase(userRepo, passwordHasher, tokenService);
  const loginUserUseCase = new LoginUserUseCase(userRepo, passwordHasher, tokenService);
  const getCurrentUserUseCase = new GetCurrentUserUseCase(userRepo);
  const seedSuperAdminUseCase = new SeedSuperAdminUseCase(userRepo, passwordHasher);
  const connectMeliAccountUseCase = new ConnectMeliAccountUseCase(
    meliClient, tenantRepo, userRepo, eventRepo, tokenService
  );
  const getOnboardingStatusUseCase = new GetOnboardingStatusUseCase(userRepo, tenantRepo);

  seedSuperAdminUseCase.execute().catch((err) => console.error("Error seeding super admin:", err));

  const seedDemoUserUseCase = new SeedDemoUserUseCase(userRepo, tenantRepo, passwordHasher);
  seedDemoUserUseCase.execute().catch((err) =>
    console.error("Error seeding demo user:", err)
  );

  // 5. Casos de Uso Core
  const approveAnswerUseCase = new ApproveAnswerUseCase(questionRepo, meliClient, eventRepo, sseNotifier);
  const rejectAnswerUseCase = new RejectAnswerUseCase(questionRepo, eventRepo, sseNotifier);

  const ingestWebhookUseCase = new IngestWebhookUseCase(queueBroker, eventRepo);

  const processClaimUseCase = new ProcessClaimUseCase(
    claimRepo, tenantRepo, eventRepo, meliClient, whatsAppClient, sseNotifier, telegramClient
  );
  const ingestClaimUseCase = new IngestClaimWebhookUseCase(processClaimUseCase, eventRepo);

  const processQuestionUseCase = new ProcessQuestionUseCase(
    questionRepo, itemCacheRepo, tenantRepo, eventRepo, meliClient, llmService, sseNotifier, whatsAppClient, telegramClient
  );

  const simulateQuestionUseCase = new SimulateQuestionUseCase(
    questionRepo, tenantRepo, eventRepo, llmService, sseNotifier
  );

  const handleWhatsAppReplyUseCase = new HandleWhatsAppReplyUseCase(
    approveAnswerUseCase, rejectAnswerUseCase, eventRepo, whatsAppClient
  );

  const handleTelegramWebhookUseCase = new HandleTelegramWebhookUseCase(
    telegramClient, tenantRepo, eventRepo, approveAnswerUseCase, rejectAnswerUseCase
  );

  // 6. Casos de Uso Admin
  const getGlobalMetricsUseCase = new GetGlobalMetricsUseCase(questionRepo, tenantRepo);
  const listTenantsOverviewUseCase = new ListTenantsOverviewUseCase(tenantRepo, questionRepo);
  const getTenantDetailUseCase = new GetTenantDetailUseCase(tenantRepo, questionRepo, eventRepo);
  const toggleTenantAutoAnswerUseCase = new ToggleTenantAutoAnswerUseCase(tenantRepo, eventRepo);
  const forceTokenRefreshUseCase = new ForceTokenRefreshUseCase(tenantRepo, meliClient, eventRepo);
  const updateTenantPermissionsUseCase = new UpdateTenantPermissionsUseCase(tenantRepo);

  // 7. Workers de Cola
  queueBroker.registerProcessor(async (job) => {
    await processQuestionUseCase.execute(job);
  });

  // 8. Guards de Auth
  const authenticate = async (request: FastifyRequest, reply: FastifyReply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return reply.status(401).send({ error: "Token de autorización requerido." });
    }
    const token = authHeader.substring(7);
    try {
      const payload = tokenService.verifyToken(token);
      (request as any).user = payload;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return reply.status(401).send({ error: `Token inválido: ${message}` });
    }
  };

  const requireSuperAdmin = async (request: FastifyRequest, reply: FastifyReply) => {
    await authenticate(request, reply);
    if (reply.sent) return;
    const user = (request as any).user;
    if (!user || user.role !== "super_admin") {
      return reply.status(403).send({ error: "Acceso denegado: se requieren permisos de Super Administrador." });
    }
  };

  const requireDemo = async (request: FastifyRequest, reply: FastifyReply) => {
    await authenticate(request, reply);
    if (reply.sent) return;
    const user = (request as any).user;
    if (!user || (user.role !== "demo" && user.role !== "super_admin")) {
      return reply.status(403).send({ error: "Acceso denegado. Se requiere cuenta demo." });
    }
  };

  const optionalAuthenticate = async (request: FastifyRequest) => {
    const authHeader = request.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.substring(7);
      try {
        const payload = tokenService.verifyToken(token);
        (request as any).user = payload;
      } catch (err) {
        // ignored
      }
    }
  };

  // 9. Controladores
  const webhookCtrl = new WebhookController(ingestWebhookUseCase, ingestClaimUseCase);
  const questionsCtrl = new QuestionsController(questionRepo, approveAnswerUseCase, rejectAnswerUseCase);
  const authCtrl = new AuthController(
    registerUserUseCase, loginUserUseCase, getCurrentUserUseCase,
    connectMeliAccountUseCase, getOnboardingStatusUseCase, tokenService
  );
  const simulatorCtrl = new SimulatorController(simulateQuestionUseCase);
  const tenantCtrl = new TenantController(tenantRepo, eventRepo, llmService);
  const adminCtrl = new AdminController(
    getGlobalMetricsUseCase, listTenantsOverviewUseCase, getTenantDetailUseCase,
    toggleTenantAutoAnswerUseCase, forceTokenRefreshUseCase, updateTenantPermissionsUseCase
  );
  const waWebhookCtrl = new WhatsAppWebhookController(handleWhatsAppReplyUseCase);
  const telegramCtrl = new TelegramWebhookController(handleTelegramWebhookUseCase, telegramClient, tenantRepo);
  const claimsCtrl = new ClaimsController(
    claimRepo, tenantRepo, eventRepo, sseNotifier, whatsAppClient, meliClient, processClaimUseCase, telegramClient
  );
  const demoCtrl = new DemoController({
    simulateQuestionUseCase,
    claimRepo,
    eventRepo,
    sseNotifier,
    sellerId: process.env.DEMO_SELLER_ID ?? "3680586616",
  });

  // 10. Rutas — Auth
  app.post("/api/auth/register", authCtrl.register);
  app.post("/api/auth/login", authCtrl.login);
  app.get("/api/auth/me", { preHandler: authenticate }, authCtrl.getMe);
  app.get("/api/auth/onboarding-status", { preHandler: authenticate }, authCtrl.getOnboardingStatus);
  app.get("/api/auth/meli-auth-url", { preHandler: optionalAuthenticate }, authCtrl.getMeliAuthUrl);

  // Rutas — Super Admin
  app.get("/api/admin/metrics", { preHandler: requireSuperAdmin }, adminCtrl.getMetrics);
  app.get("/api/admin/tenants", { preHandler: requireSuperAdmin }, adminCtrl.getTenants);
  app.get("/api/admin/tenants/:sellerId", { preHandler: requireSuperAdmin }, adminCtrl.getTenantDetail);
  app.post("/api/admin/tenants/:sellerId/toggle", { preHandler: requireSuperAdmin }, adminCtrl.toggleAutoAnswer);
  app.post("/api/admin/tenants/:sellerId/refresh-token", { preHandler: requireSuperAdmin }, adminCtrl.refreshToken);
  app.put("/api/admin/tenants/:sellerId/permissions", { preHandler: requireSuperAdmin }, adminCtrl.updatePermissions);

  // Rutas — Webhooks & OAuth
  app.post("/webhook/ml", webhookCtrl.handle);
  app.get("/webhook/whatsapp", waWebhookCtrl.verify);
  app.post("/webhook/whatsapp", waWebhookCtrl.receive);
  app.post("/webhook/telegram", telegramCtrl.receive);
  app.get("/oauth/login", { preHandler: optionalAuthenticate }, authCtrl.meliOAuthLogin);
  app.get("/oauth/callback", authCtrl.meliOAuthCallback);

  // Rutas — Telegram Tenant Integration
  app.get("/api/tenant/telegram/info", { preHandler: optionalAuthenticate }, telegramCtrl.getInfo);
  app.post("/api/tenant/telegram/test", { preHandler: optionalAuthenticate }, telegramCtrl.sendTest);

  // Rutas — SSE
  app.get("/api/events/stream", (request, reply) => {
    const sellerId = (request.query as any)?.seller_id;
    sseNotifier.registerClient(reply, sellerId);
  });

  // Rutas — Questions & Actions
  app.get("/api/questions", { preHandler: optionalAuthenticate }, questionsCtrl.getQuestions);
  app.post("/api/questions/:id/approve", { preHandler: optionalAuthenticate }, questionsCtrl.approve);
  app.post("/api/questions/:id/reject", { preHandler: optionalAuthenticate }, questionsCtrl.reject);
  app.post("/api/whatsapp/reply", questionsCtrl.replyViaWhatsapp);

  // Rutas — Reclamos & Post-Venta
  app.get("/api/claims", { preHandler: optionalAuthenticate }, claimsCtrl.getClaims);
  app.post("/api/claims/simulate", claimsCtrl.simulate);
  app.post("/api/claims/:id/ack", { preHandler: optionalAuthenticate }, claimsCtrl.acknowledge);

  // Rutas — Demo
  app.post("/api/demo/seed", { preHandler: requireDemo }, demoCtrl.seed);

  // Rutas — Simulator, Health, Tenant
  app.post("/api/simulate-question", simulatorCtrl.simulate);
  app.get("/api/health", tenantCtrl.getHealth);
  app.get("/api/events", { preHandler: optionalAuthenticate }, tenantCtrl.getEvents);
  app.post("/api/config/auto-answer", { preHandler: optionalAuthenticate }, tenantCtrl.updateSettings);
  app.get("/api/tenant/settings", { preHandler: optionalAuthenticate }, tenantCtrl.getSettings);
  app.put("/api/tenant/settings", { preHandler: optionalAuthenticate }, tenantCtrl.updateSettings);

  return app;
}
