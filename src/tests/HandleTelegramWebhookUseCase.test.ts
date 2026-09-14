import { describe, it, expect, vi, beforeEach } from "vitest";
import { HandleTelegramWebhookUseCase } from "../application/use-cases/HandleTelegramWebhookUseCase.js";
import { ITelegramClient } from "../application/interfaces/ITelegramClient.js";
import { ITenantRepository } from "../application/interfaces/ITenantRepository.js";
import { IEventRepository } from "../application/interfaces/IEventRepository.js";
import { ITelegramAssistantService } from "../application/interfaces/ITelegramAssistantService.js";
import { ApproveAnswerUseCase } from "../application/use-cases/ApproveAnswerUseCase.js";
import { RejectAnswerUseCase } from "../application/use-cases/RejectAnswerUseCase.js";
import { Tenant } from "../domain/entities/Tenant.js";

describe("HandleTelegramWebhookUseCase", () => {
  let telegramClient: ITelegramClient;
  let tenantRepo: ITenantRepository;
  let eventRepo: IEventRepository;
  let approveUseCase: ApproveAnswerUseCase;
  let rejectUseCase: RejectAnswerUseCase;
  let assistantService: ITelegramAssistantService;
  let useCase: HandleTelegramWebhookUseCase;

  const mockTenant = Tenant.createDefault({
    id: "tenant-1",
    sellerId: "seller_123",
    accessToken: "token_abc",
    refreshToken: "refresh_abc",
    expiresInSec: 21600,
    nickname: "TiendaTest",
  });

  beforeEach(() => {
    telegramClient = {
      sendMessage: vi.fn().mockResolvedValue({ ok: true, messageId: 10 }),
      answerCallbackQuery: vi.fn().mockResolvedValue(undefined),
      editMessage: vi.fn().mockResolvedValue(undefined),
    };

    tenantRepo = {
      findById: vi.fn().mockResolvedValue(mockTenant),
      findBySellerId: vi.fn().mockImplementation(async (sellerId) => {
        return sellerId === "seller_123" ? mockTenant : null;
      }),
      findByTelegramChatId: vi.fn().mockImplementation(async (chatId) => {
        return chatId === "777888999" ? mockTenant : null;
      }),
      save: vi.fn().mockResolvedValue(undefined),
      getAll: vi.fn().mockResolvedValue([mockTenant]),
    };

    eventRepo = {
      log: vi.fn().mockResolvedValue(undefined),
      getRecent: vi.fn().mockResolvedValue([]),
      getRecentBySellerId: vi.fn().mockResolvedValue([]),
    };

    approveUseCase = {
      execute: vi.fn().mockResolvedValue(undefined),
    } as unknown as ApproveAnswerUseCase;

    rejectUseCase = {
      execute: vi.fn().mockResolvedValue(undefined),
    } as unknown as RejectAnswerUseCase;

    assistantService = {
      processMessage: vi.fn().mockResolvedValue({
        text: "❓ *Tenés 1 pregunta pendiente de revisión humana.*",
        buttons: [
          [{ text: "✅ Aprobar #Q100", callbackData: "approve_Q100" }],
        ],
      }),
    };

    useCase = new HandleTelegramWebhookUseCase(
      telegramClient,
      tenantRepo,
      eventRepo,
      approveUseCase,
      rejectUseCase,
      assistantService
    );
  });

  it("should auto-link tenant on /start tenant_seller_123 and send confirmation", async () => {
    await useCase.execute({
      update_id: 1,
      message: {
        message_id: 101,
        chat: { id: 777888999, type: "private" },
        text: "/start tenant_seller_123",
        date: 1690000000,
        from: { id: 777888999, username: "juan_seller" },
      },
    });

    expect(tenantRepo.save).toHaveBeenCalledOnce();
    expect(mockTenant.settings.telegramAlertChatId).toBe("777888999");
    expect(mockTenant.settings.telegramEnabled).toBe(true);
    expect(telegramClient.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        chatId: "777888999",
        text: expect.stringContaining("¡Conexión Exitosa con MELI AI Assistant!"),
      })
    );
  });

  it("should approve question when clicking approve_Q123 inline button", async () => {
    await useCase.execute({
      update_id: 2,
      callback_query: {
        id: "cb_query_999",
        from: { id: 777888999 },
        message: {
          message_id: 55,
          chat: { id: 777888999, type: "private" },
          text: "🤔 Pregunta requiere revisión",
        },
        data: "approve_Q123",
      },
    });

    expect(approveUseCase.execute).toHaveBeenCalledWith({
      questionId: "Q123",
      isViaWhatsapp: false,
    });
    expect(telegramClient.answerCallbackQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        callbackQueryId: "cb_query_999",
        text: "✅ Respuesta aprobada y publicada en Mercado Libre",
      })
    );
    expect(telegramClient.editMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        chatId: "777888999",
        messageId: 55,
        text: expect.stringContaining("Aprobada por el vendedor"),
      })
    );
  });

  it("should reject question when clicking reject_Q123 inline button", async () => {
    await useCase.execute({
      update_id: 3,
      callback_query: {
        id: "cb_query_888",
        from: { id: 777888999 },
        message: {
          message_id: 56,
          chat: { id: 777888999, type: "private" },
          text: "🤔 Pregunta requiere revisión",
        },
        data: "reject_Q123",
      },
    });

    expect(rejectUseCase.execute).toHaveBeenCalledWith("Q123");
    expect(telegramClient.answerCallbackQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        callbackQueryId: "cb_query_888",
        text: "🗑️ Respuesta descartada",
      })
    );
  });

  it("should acknowledge claim when clicking claim_ack_C456", async () => {
    await useCase.execute({
      update_id: 4,
      callback_query: {
        id: "cb_query_777",
        from: { id: 777888999 },
        message: {
          message_id: 57,
          chat: { id: 777888999, type: "private" },
          text: "🔴 NUEVO RECLAMO",
        },
        data: "claim_ack_C456",
      },
    });

    expect(eventRepo.log).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "claim_ack",
        message: expect.stringContaining("reclamo C456 vía Telegram"),
      })
    );
    expect(telegramClient.answerCallbackQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        callbackQueryId: "cb_query_777",
        text: expect.stringContaining("Recibido"),
      })
    );
  });

  it("should process natural language query via TelegramAssistantService with tools", async () => {
    await useCase.execute({
      update_id: 5,
      message: {
        message_id: 102,
        chat: { id: 777888999, type: "private" },
        text: "¿Qué preguntas tengo pendientes?",
        date: 1690000000,
        from: { id: 777888999, username: "juan_seller" },
      },
    });

    expect(assistantService.processMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        tenant: mockTenant,
        userMessage: "¿Qué preguntas tengo pendientes?",
        chatId: "777888999",
      })
    );

    expect(telegramClient.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        chatId: "777888999",
        text: expect.stringContaining("Tenés 1 pregunta pendiente"),
        buttons: expect.arrayContaining([
          expect.arrayContaining([
            expect.objectContaining({ callbackData: "approve_Q100" }),
          ]),
        ]),
      })
    );
  });

  it("should handle claim_detail_C456 callback and reply with claim details", async () => {
    await useCase.execute({
      update_id: 6,
      callback_query: {
        id: "cb_query_666",
        from: { id: 777888999 },
        message: {
          message_id: 58,
          chat: { id: 777888999, type: "private" },
          text: "⚖️ Reclamos en Gestión",
        },
        data: "claim_detail_C456",
      },
    });

    expect(telegramClient.answerCallbackQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        callbackQueryId: "cb_query_666",
        text: "🔍 Obteniendo detalle del reclamo...",
      })
    );

    expect(assistantService.processMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        tenant: mockTenant,
        userMessage: "Detallame el reclamo #C456",
        chatId: "777888999",
      })
    );
  });
});
