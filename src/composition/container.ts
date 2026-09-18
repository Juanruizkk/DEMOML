import { db } from "../infrastructure/persistence/drizzle/db.js";
import { PostgresTenantRepository } from "../infrastructure/persistence/postgres/PostgresTenantRepository.js";
import { PostgresQuestionRepository } from "../infrastructure/persistence/postgres/PostgresQuestionRepository.js";
import { PostgresItemCacheRepository } from "../infrastructure/persistence/postgres/PostgresItemCacheRepository.js";
import { PostgresEventRepository } from "../infrastructure/persistence/postgres/PostgresEventRepository.js";
import { PostgresUserRepository } from "../infrastructure/persistence/postgres/PostgresUserRepository.js";
import { PostgresClaimRepository } from "../infrastructure/persistence/postgres/PostgresClaimRepository.js";
import { PostgresItemKnowledgeRepository } from "../infrastructure/persistence/postgres/PostgresItemKnowledgeRepository.js";
import { PostgresOrderMessageRepository } from "../infrastructure/persistence/postgres/PostgresOrderMessageRepository.js";
import { PostgresLLMUsageRepository } from "../infrastructure/persistence/postgres/PostgresLLMUsageRepository.js";
import { PostgresGoldenDatasetRepository } from "../infrastructure/persistence/postgres/PostgresGoldenDatasetRepository.js";

import { CryptoPasswordHasher } from "../infrastructure/security/CryptoPasswordHasher.js";
import { JwtTokenService } from "../infrastructure/security/JwtTokenService.js";

import { MeliApiClient } from "../infrastructure/meli/MeliApiClient.js";
import { QuestionsPoller } from "../infrastructure/meli/QuestionsPoller.js";
import { LangChainLLMService } from "../infrastructure/llm/LangChainLLMService.js";
import { InMemoryQueueBroker } from "../infrastructure/queue/InMemoryQueueBroker.js";
import { FastifySseNotifier } from "../infrastructure/realtime/FastifySseNotifier.js";
import { MetaWhatsAppClient } from "../infrastructure/whatsapp/MetaWhatsAppClient.js";
import { TelegramBotClient } from "../infrastructure/telegram/TelegramBotClient.js";
import { TelegramAssistantService } from "../infrastructure/telegram/TelegramAssistantService.js";
import { ResendEmailClient } from "../infrastructure/email/ResendEmailClient.js";

import { IngestWebhookUseCase } from "../application/use-cases/questions/IngestWebhookUseCase.js";
import { ProcessQuestionUseCase } from "../application/use-cases/questions/ProcessQuestionUseCase.js";
import { ApproveAnswerUseCase } from "../application/use-cases/questions/ApproveAnswerUseCase.js";
import { RejectAnswerUseCase } from "../application/use-cases/questions/RejectAnswerUseCase.js";
import { SaveHumanDecisionUseCase } from "../application/use-cases/questions/SaveHumanDecisionUseCase.js";
import { SimulateQuestionUseCase } from "../application/use-cases/questions/SimulateQuestionUseCase.js";
import { IngestClaimWebhookUseCase } from "../application/use-cases/claims/IngestClaimWebhookUseCase.js";
import { ProcessClaimUseCase } from "../application/use-cases/claims/ProcessClaimUseCase.js";
import { ListClaimsUseCase } from "../application/use-cases/claims/ListClaimsUseCase.js";
import { SimulateClaimUseCase } from "../application/use-cases/claims/SimulateClaimUseCase.js";
import { SetClaimStatusUseCase } from "../application/use-cases/claims/SetClaimStatusUseCase.js";
import { ListQuestionsUseCase } from "../application/use-cases/questions/ListQuestionsUseCase.js";
import { SeedDemoDataUseCase } from "../application/use-cases/demo/SeedDemoDataUseCase.js";
import { GetTenantSettingsUseCase } from "../application/use-cases/tenant/GetTenantSettingsUseCase.js";
import { UpdateTenantSettingsUseCase } from "../application/use-cases/tenant/UpdateTenantSettingsUseCase.js";
import { SendTestEmailUseCase } from "../application/use-cases/tenant/SendTestEmailUseCase.js";
import { IngestOrderMessageWebhookUseCase } from "../application/use-cases/order-messages/IngestOrderMessageWebhookUseCase.js";
import { ProcessOrderMessageUseCase } from "../application/use-cases/order-messages/ProcessOrderMessageUseCase.js";
import { ReplyOrderMessageUseCase } from "../application/use-cases/order-messages/ReplyOrderMessageUseCase.js";
import { ListOrderMessagesUseCase } from "../application/use-cases/order-messages/ListOrderMessagesUseCase.js";
import { HandleWhatsAppReplyUseCase } from "../application/use-cases/channels/HandleWhatsAppReplyUseCase.js";
import { HandleTelegramWebhookUseCase } from "../application/use-cases/channels/HandleTelegramWebhookUseCase.js";
import { TenantNotificationService } from "../application/services/TenantNotificationService.js";
import { GetSellerProductsUseCase } from "../application/use-cases/products/GetSellerProductsUseCase.js";
import { SaveItemKnowledgeUseCase } from "../application/use-cases/products/SaveItemKnowledgeUseCase.js";

import { RegisterUserUseCase } from "../application/use-cases/auth/RegisterUserUseCase.js";
import { LoginUserUseCase } from "../application/use-cases/auth/LoginUserUseCase.js";
import { GetCurrentUserUseCase } from "../application/use-cases/auth/GetCurrentUserUseCase.js";
import { SeedSuperAdminUseCase } from "../application/use-cases/auth/SeedSuperAdminUseCase.js";
import { SeedDemoUserUseCase } from "../application/use-cases/auth/SeedDemoUserUseCase.js";
import { ConnectMeliAccountUseCase } from "../application/use-cases/auth/ConnectMeliAccountUseCase.js";
import { GetOnboardingStatusUseCase } from "../application/use-cases/auth/GetOnboardingStatusUseCase.js";
import { RequestPasswordResetUseCase } from "../application/use-cases/auth/RequestPasswordResetUseCase.js";
import { ResetPasswordUseCase } from "../application/use-cases/auth/ResetPasswordUseCase.js";
import { ActivateTenantUseCase } from "../application/use-cases/auth/ActivateTenantUseCase.js";

import { GetGlobalMetricsUseCase } from "../application/use-cases/admin/GetGlobalMetricsUseCase.js";
import { ListTenantsOverviewUseCase } from "../application/use-cases/admin/ListTenantsOverviewUseCase.js";
import { GetTenantDetailUseCase } from "../application/use-cases/admin/GetTenantDetailUseCase.js";
import { ToggleTenantAutoAnswerUseCase } from "../application/use-cases/admin/ToggleTenantAutoAnswerUseCase.js";
import { ForceTokenRefreshUseCase } from "../application/use-cases/admin/ForceTokenRefreshUseCase.js";
import { UpdateTenantPermissionsUseCase } from "../application/use-cases/admin/UpdateTenantPermissionsUseCase.js";
import { UpdateTenantIntegrationsUseCase } from "../application/use-cases/admin/UpdateTenantIntegrationsUseCase.js";
import { UpdateTenantPlanUseCase } from "../application/use-cases/admin/UpdateTenantPlanUseCase.js";
import { CreateTenantUseCase } from "../application/use-cases/admin/CreateTenantUseCase.js";
import { GetLLMUsageStatsUseCase } from "../application/use-cases/admin/GetLLMUsageStatsUseCase.js";
import { ListTeamMembersUseCase } from "../application/use-cases/tenant/ListTeamMembersUseCase.js";
import { InviteTeamMemberUseCase } from "../application/use-cases/tenant/InviteTeamMemberUseCase.js";
import { RemoveTeamMemberUseCase } from "../application/use-cases/tenant/RemoveTeamMemberUseCase.js";
import { GetTenantLLMUsageUseCase } from "../application/use-cases/tenant/GetTenantLLMUsageUseCase.js";
import { SetLLMSpendingLimitUseCase } from "../application/use-cases/tenant/SetLLMSpendingLimitUseCase.js";

import { WebhookController } from "../presentation/controllers/WebhookController.js";
import { QuestionsController } from "../presentation/controllers/QuestionsController.js";
import { OrderMessagesController } from "../presentation/controllers/OrderMessagesController.js";
import { AuthController } from "../presentation/controllers/AuthController.js";
import { SimulatorController } from "../presentation/controllers/SimulatorController.js";
import { TenantController } from "../presentation/controllers/TenantController.js";
import { AdminController } from "../presentation/controllers/AdminController.js";
import { WhatsAppWebhookController } from "../presentation/controllers/WhatsAppWebhookController.js";
import { TelegramWebhookController } from "../presentation/controllers/TelegramWebhookController.js";
import { ClaimsController } from "../presentation/controllers/ClaimsController.js";
import { DemoController } from "../presentation/controllers/DemoController.js";
import { ProductsController } from "../presentation/controllers/ProductsController.js";
import { LLMUsageController } from "../presentation/controllers/LLMUsageController.js";

export type Container = ReturnType<typeof buildContainer>;

export function buildContainer() {
  // 1. Persistencia y Seguridad
  const tenantRepo = new PostgresTenantRepository(db);
  const questionRepo = new PostgresQuestionRepository(db);
  const itemCacheRepo = new PostgresItemCacheRepository(db);
  const eventRepo = new PostgresEventRepository(db);
  const userRepo = new PostgresUserRepository(db);
  const claimRepo = new PostgresClaimRepository(db);
  const itemKnowledgeRepo = new PostgresItemKnowledgeRepository(db);
  const orderMessageRepo = new PostgresOrderMessageRepository(db);
  const llmUsageRepo = new PostgresLLMUsageRepository(db);
  const goldenDatasetRepo = new PostgresGoldenDatasetRepository(db);

  const passwordHasher = new CryptoPasswordHasher();
  const tokenService = new JwtTokenService();

  // 2. Adaptadores
  const meliClient = new MeliApiClient(tenantRepo);
  const llmService = new LangChainLLMService(
    llmUsageRepo,
    (sellerId) => {
      tenantRepo.findBySellerId(sellerId).then((tenant) => {
        if (!tenant) return;
        const msg = `⚠️ Tu consumo de IA este mes superó el límite configurado.`;
        if (tenant.canSendTelegramAlert()) {
          telegramClient.sendMessage({
            chatId: tenant.settings.telegramAlertChatId!,
            text: msg,
            botToken: tenant.settings.telegramAlertBotToken,
          }).catch(() => {});
        }
      }).catch(() => {});
    }
  );
  const queueBroker = new InMemoryQueueBroker(5);
  const sseNotifier = new FastifySseNotifier();
  const whatsAppClient = new MetaWhatsAppClient();
  const telegramClient = new TelegramBotClient();
  const emailClient = new ResendEmailClient();

  // 3. Casos de Uso Auth
  const registerUserUseCase = new RegisterUserUseCase(userRepo, passwordHasher, tokenService);
  const loginUserUseCase = new LoginUserUseCase(userRepo, passwordHasher, tokenService);
  const getCurrentUserUseCase = new GetCurrentUserUseCase(userRepo);
  const seedSuperAdminUseCase = new SeedSuperAdminUseCase(userRepo, passwordHasher);
  const connectMeliAccountUseCase = new ConnectMeliAccountUseCase(
    meliClient, tenantRepo, userRepo, eventRepo, tokenService
  );
  const getOnboardingStatusUseCase = new GetOnboardingStatusUseCase(userRepo, tenantRepo);
  const requestPasswordResetUseCase = new RequestPasswordResetUseCase(userRepo, emailClient);
  const resetPasswordUseCase = new ResetPasswordUseCase(userRepo, passwordHasher, tokenService);

  const seedDemoUserUseCase = new SeedDemoUserUseCase(userRepo, tenantRepo, passwordHasher);

  // 4. Casos de Uso Core
  const notificationService = new TenantNotificationService(
    tenantRepo, eventRepo, whatsAppClient, telegramClient, emailClient
  );

  const approveAnswerUseCase = new ApproveAnswerUseCase(questionRepo, meliClient, eventRepo, sseNotifier);
  const rejectAnswerUseCase = new RejectAnswerUseCase(questionRepo, eventRepo, sseNotifier);
  const saveHumanDecisionUseCase = new SaveHumanDecisionUseCase(
    questionRepo,
    goldenDatasetRepo,
    approveAnswerUseCase,
    rejectAnswerUseCase,
    itemCacheRepo,
  );

  const ingestWebhookUseCase = new IngestWebhookUseCase(queueBroker, eventRepo);

  const processClaimUseCase = new ProcessClaimUseCase(
    claimRepo, eventRepo, meliClient, sseNotifier, notificationService
  );
  const ingestClaimUseCase = new IngestClaimWebhookUseCase(processClaimUseCase, eventRepo, tenantRepo);
  const listClaimsUseCase = new ListClaimsUseCase(claimRepo, meliClient, processClaimUseCase);
  const simulateClaimUseCase = new SimulateClaimUseCase(
    claimRepo, tenantRepo, eventRepo, whatsAppClient, sseNotifier, telegramClient
  );
  const setClaimStatusUseCase = new SetClaimStatusUseCase(claimRepo, eventRepo, sseNotifier);

  const processOrderMessageUseCase = new ProcessOrderMessageUseCase(
    orderMessageRepo, tenantRepo, eventRepo, meliClient, llmService, sseNotifier, notificationService
  );
  const ingestOrderMessageUseCase = new IngestOrderMessageWebhookUseCase(processOrderMessageUseCase, eventRepo);
  const replyOrderMessageUseCase = new ReplyOrderMessageUseCase(orderMessageRepo, meliClient, eventRepo, sseNotifier);
  const listOrderMessagesUseCase = new ListOrderMessagesUseCase(orderMessageRepo);

  const processQuestionUseCase = new ProcessQuestionUseCase(
    questionRepo, itemCacheRepo, tenantRepo, eventRepo, meliClient, llmService, sseNotifier, notificationService, itemKnowledgeRepo
  );

  const getSellerProductsUseCase = new GetSellerProductsUseCase(meliClient, itemKnowledgeRepo);
  const saveItemKnowledgeUseCase = new SaveItemKnowledgeUseCase(itemKnowledgeRepo);

  const simulateQuestionUseCase = new SimulateQuestionUseCase(
    questionRepo, tenantRepo, eventRepo, llmService, sseNotifier
  );
  const listQuestionsUseCase = new ListQuestionsUseCase(questionRepo, itemCacheRepo);
  const seedDemoDataUseCase = new SeedDemoDataUseCase(
    simulateQuestionUseCase, claimRepo, eventRepo, sseNotifier
  );

  const handleWhatsAppReplyUseCase = new HandleWhatsAppReplyUseCase(
    approveAnswerUseCase, rejectAnswerUseCase, eventRepo, whatsAppClient
  );

  const telegramAssistantService = new TelegramAssistantService(
    questionRepo,
    claimRepo,
    eventRepo,
    orderMessageRepo
  );

  const handleTelegramWebhookUseCase = new HandleTelegramWebhookUseCase(
    telegramClient,
    tenantRepo,
    eventRepo,
    approveAnswerUseCase,
    rejectAnswerUseCase,
    telegramAssistantService,
    replyOrderMessageUseCase,
    orderMessageRepo,
    claimRepo
  );

  // 5. Casos de Uso Admin & Tenant
  const getGlobalMetricsUseCase = new GetGlobalMetricsUseCase(questionRepo, tenantRepo);
  const listTenantsOverviewUseCase = new ListTenantsOverviewUseCase(tenantRepo, questionRepo);
  const getTenantDetailUseCase = new GetTenantDetailUseCase(tenantRepo, questionRepo, eventRepo);
  const toggleTenantAutoAnswerUseCase = new ToggleTenantAutoAnswerUseCase(tenantRepo, eventRepo);
  const forceTokenRefreshUseCase = new ForceTokenRefreshUseCase(tenantRepo, meliClient, eventRepo);
  const updateTenantPermissionsUseCase = new UpdateTenantPermissionsUseCase(tenantRepo);
  const updateTenantIntegrationsUseCase = new UpdateTenantIntegrationsUseCase(tenantRepo);
  const createTenantUseCase = new CreateTenantUseCase(userRepo);
  const activateTenantUseCase = new ActivateTenantUseCase(userRepo, passwordHasher, tokenService);
  const getLLMUsageStatsUseCase = new GetLLMUsageStatsUseCase(llmUsageRepo, tenantRepo);
  const getTenantLLMUsageUseCase = new GetTenantLLMUsageUseCase(llmUsageRepo);
  const setLLMSpendingLimitUseCase = new SetLLMSpendingLimitUseCase(llmUsageRepo);

  const getTenantSettingsUseCase = new GetTenantSettingsUseCase(tenantRepo);
  const updateTenantSettingsUseCase = new UpdateTenantSettingsUseCase(tenantRepo);
  const sendTestEmailUseCase = new SendTestEmailUseCase(tenantRepo, eventRepo, emailClient);

  const listTeamMembersUseCase = new ListTeamMembersUseCase(userRepo, tenantRepo);
  const inviteTeamMemberUseCase = new InviteTeamMemberUseCase(userRepo, tenantRepo, eventRepo, emailClient);
  const removeTeamMemberUseCase = new RemoveTeamMemberUseCase(userRepo, tenantRepo, eventRepo);

  // 6. Workers de Cola & Poller de Respaldo Mercado Libre
  queueBroker.registerProcessor(async (job) => {
    await processQuestionUseCase.execute(job);
  });

  const questionsPoller = new QuestionsPoller(
    tenantRepo,
    questionRepo,
    meliClient,
    queueBroker,
    eventRepo
  );

  // Efectos de arranque — los invoca server.ts, no buildApp(), para que buildApp sea puro en tests
  const runStartupSeeds = async () => {
    await seedSuperAdminUseCase.execute().catch((err) => console.error("Error seeding super admin:", err));
    await seedDemoUserUseCase.execute().catch((err) => console.error("Error seeding demo user:", err));
  };

  const startBackgroundJobs = () => {
    questionsPoller.start();
  };

  // 7. Controladores
  const webhookCtrl = new WebhookController(ingestWebhookUseCase, ingestClaimUseCase, ingestOrderMessageUseCase);
  const questionsCtrl = new QuestionsController(
    questionRepo,
    approveAnswerUseCase,
    rejectAnswerUseCase,
    listQuestionsUseCase,
    saveHumanDecisionUseCase,
    goldenDatasetRepo,
  );
  const orderMessagesCtrl = new OrderMessagesController(
    listOrderMessagesUseCase,
    replyOrderMessageUseCase,
    processOrderMessageUseCase,
    orderMessageRepo
  );
  const authCtrl = new AuthController(
    registerUserUseCase, loginUserUseCase, getCurrentUserUseCase,
    connectMeliAccountUseCase, getOnboardingStatusUseCase, tokenService,
    activateTenantUseCase, requestPasswordResetUseCase, resetPasswordUseCase
  );
  const simulatorCtrl = new SimulatorController(simulateQuestionUseCase);
  const tenantCtrl = new TenantController(
    tenantRepo, eventRepo, llmService,
    getTenantSettingsUseCase, updateTenantSettingsUseCase, sendTestEmailUseCase,
    listTeamMembersUseCase, inviteTeamMemberUseCase, removeTeamMemberUseCase
  );
  const updateTenantPlanUseCase = new UpdateTenantPlanUseCase(tenantRepo);
  const adminCtrl = new AdminController(
    getGlobalMetricsUseCase, listTenantsOverviewUseCase, getTenantDetailUseCase,
    toggleTenantAutoAnswerUseCase, forceTokenRefreshUseCase, updateTenantPermissionsUseCase,
    createTenantUseCase, userRepo, requestPasswordResetUseCase, emailClient,
    updateTenantIntegrationsUseCase, updateTenantPlanUseCase
  );
  const waWebhookCtrl = new WhatsAppWebhookController(handleWhatsAppReplyUseCase);
  const telegramCtrl = new TelegramWebhookController(handleTelegramWebhookUseCase, telegramClient, tenantRepo);
  const claimsCtrl = new ClaimsController(
    listClaimsUseCase, simulateClaimUseCase, setClaimStatusUseCase
  );
  const demoCtrl = new DemoController(
    seedDemoDataUseCase,
    process.env.DEMO_SELLER_ID ?? "3680586616"
  );
  const productsCtrl = new ProductsController(
    getSellerProductsUseCase,
    saveItemKnowledgeUseCase,
    itemKnowledgeRepo,
    meliClient,
    llmService,
    tenantRepo
  );
  const llmUsageCtrl = new LLMUsageController(
    getLLMUsageStatsUseCase,
    getTenantLLMUsageUseCase,
    setLLMSpendingLimitUseCase,
    tenantRepo,
  );

  return {
    // Efectos de arranque (server.ts)
    runStartupSeeds,
    startBackgroundJobs,
    // Servicios que las rutas usan directamente
    tokenService,
    sseNotifier,
    requestPasswordResetUseCase,
    // Controladores
    webhookCtrl,
    questionsCtrl,
    orderMessagesCtrl,
    authCtrl,
    simulatorCtrl,
    tenantCtrl,
    adminCtrl,
    waWebhookCtrl,
    telegramCtrl,
    claimsCtrl,
    demoCtrl,
    productsCtrl,
    llmUsageCtrl,
  };
}
