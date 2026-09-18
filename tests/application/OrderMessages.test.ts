import { describe, it, expect, vi, beforeEach } from "vitest";
import { OrderMessage } from "../../src/domain/entities/OrderMessage.js";
import { ProcessOrderMessageUseCase } from "../../src/application/use-cases/order-messages/ProcessOrderMessageUseCase.js";
import { ReplyOrderMessageUseCase } from "../../src/application/use-cases/order-messages/ReplyOrderMessageUseCase.js";
import { ListOrderMessagesUseCase } from "../../src/application/use-cases/order-messages/ListOrderMessagesUseCase.js";
import { Tenant } from "../../src/domain/entities/Tenant.js";
import { TenantNotificationService } from "../../src/application/services/TenantNotificationService.js";

describe("Order Messages / Mensajería Post-Venta", () => {
  let mockOrderMessageRepo: any;
  let mockTenantRepo: any;
  let mockEventRepo: any;
  let mockMeliClient: any;
  let mockLLMService: any;
  let mockSseNotifier: any;
  let mockTelegramClient: any;

  beforeEach(() => {
    mockOrderMessageRepo = {
      findById: vi.fn(),
      findByPackId: vi.fn(),
      save: vi.fn(),
      list: vi.fn(),
      listBySeller: vi.fn().mockResolvedValue([]),
      countPending: vi.fn().mockResolvedValue(0),
    };

    mockTenantRepo = {
      findBySellerId: vi.fn().mockResolvedValue(
        new Tenant({
          id: "tenant-1",
          sellerId: "3680586616",
          nickname: "TEST_SELLER",
          accessToken: "token-123",
          refreshToken: "refresh-123",
          expiresAt: Date.now() + 3600000,
          settings: {
            automationMode: "smart_hybrid",
            autoAnswerEnabled: true,
            confidenceThreshold: 0.75,
            tone: "casual_rioplatense",
            whatsappMode: "platform_shared",
            planId: "pro",
            monthlyAlertsLimit: 100,
            alertsSentThisMonth: 0,
            cycleResetDate: new Date().toISOString(),
            billingStatus: "active",
            permissions: {
              whatsappEnabled: true,
              telegramEnabled: true,
              emailEnabled: false,
              preSaleEnabled: true,
              postSaleEnabled: true,
            },
          },
          createdAt: new Date(),
          updatedAt: new Date(),
        })
      ),
      save: vi.fn().mockResolvedValue(undefined),
    };

    mockEventRepo = {
      log: vi.fn().mockResolvedValue(undefined),
    };

    mockMeliClient = {
      getOrderMessages: vi.fn(),
      postOrderMessage: vi.fn().mockResolvedValue({ id: "meli-msg-123" }),
      getOrder: vi.fn().mockResolvedValue({
        id: "2000004567",
        buyer: { id: "3677130936", nickname: "JUAN_BUYER" },
        order_items: [{ item: { title: "Mouse Gamer Logitech G203" } }],
      }),
    };

    mockLLMService = {
      classifyOrderMessage: vi.fn().mockResolvedValue({
        intent: "facturacion",
        confidence: 0.95,
        requires_human: false,
        reason: null,
        answer: "¡Hola! Sí, emitimos Factura A. Por favor dejanos tu CUIT y Razón Social.",
      }),
    };

    mockSseNotifier = {
      broadcastToSeller: vi.fn(),
    };

    mockTelegramClient = {
      sendMessage: vi.fn().mockResolvedValue(true),
    };
  });

  describe("Domain Entity - OrderMessage", () => {
    it("should instantiate correctly with domain rules and methods", () => {
      const msg = new OrderMessage({
        id: "msg-001",
        sellerId: "3680586616",
        packId: "pack-999",
        orderId: "ord-999",
        buyerId: "buyer-123",
        buyerNickname: "JUAN_TEST",
        messageText: "Hola, ¿cuándo llega mi pedido?",
        senderRole: "buyer",
        status: "unread",
        intent: "envio_seguimiento",
        confidence: 0.9,
      });

      expect(msg.id).toBe("msg-001");
      expect(msg.status).toBe("unread");
      expect(msg.intent).toBe("envio_seguimiento");
      expect(msg.aiConfidence).toBe(0.9);
      expect(msg.isFinalized()).toBe(false);

      msg.markAsAutoAnswered("Tu pedido está en camino", 250);
      expect(msg.status).toBe("auto_answered");
      expect(msg.sellerAnswer).toBe("Tu pedido está en camino");
      expect(msg.isFinalized()).toBe(true);
    });

    it("should allow operator manual reply", () => {
      const msg = new OrderMessage({
        id: "msg-002",
        sellerId: "3680586616",
        packId: "pack-999",
        buyerId: "buyer-123",
        messageText: "Tengo un problema con el producto",
        senderRole: "buyer",
        status: "pending_review",
        intent: "reclamo_potencial",
        confidence: 0.6,
      });

      msg.reply("Estimado cliente, ya nos comunicamos para resolverlo de inmediato.");
      expect(msg.status).toBe("replied");
      expect(msg.sellerAnswer).toContain("resolverlo de inmediato");
      expect(msg.answeredAt).toBeDefined();
    });
  });

  describe("Use Case - ProcessOrderMessageUseCase", () => {
    it("should auto-answer high confidence standard question when smart_hybrid is on", async () => {
      const useCase = new ProcessOrderMessageUseCase(
        mockOrderMessageRepo,
        mockTenantRepo,
        mockEventRepo,
        mockMeliClient,
        mockLLMService,
        mockSseNotifier,
        new TenantNotificationService(mockTenantRepo, mockEventRepo, undefined, mockTelegramClient)
      );

      const result = await useCase.execute({
        sellerId: "3680586616",
        packId: "2000004567",
        orderId: "2000004567",
        buyerId: "3677130936",
        buyerNickname: "JUAN_BUYER",
        messageText: "Hola, hacen Factura A?",
        itemTitle: "Mouse Gamer Logitech G203",
      });

      expect(result).not.toBeNull();
      expect(result?.status).toBe("auto_answered");
      expect(result?.intent).toBe("facturacion");
      expect(mockMeliClient.postOrderMessage).toHaveBeenCalledWith(
        "3680586616",
        "2000004567",
        "3677130936",
        expect.stringContaining("Factura A")
      );
      expect(mockSseNotifier.broadcastToSeller).toHaveBeenCalledWith(
        "3680586616",
        "order_message_auto_answered",
        expect.anything()
      );
    });

    it("should route to pending_review when requires_human is true (e.g. potential claim)", async () => {
      mockLLMService.classifyOrderMessage.mockResolvedValueOnce({
        intent: "reclamo_potencial",
        confidence: 0.88,
        requires_human: true,
        reason: "Cliente indica que el producto llegó roto",
        answer: "Hola, lamentamos el inconveniente. Por favor indicanos los detalles para enviarte un cambio inmediato.",
      });

      const useCase = new ProcessOrderMessageUseCase(
        mockOrderMessageRepo,
        mockTenantRepo,
        mockEventRepo,
        mockMeliClient,
        mockLLMService,
        mockSseNotifier,
        new TenantNotificationService(mockTenantRepo, mockEventRepo, undefined, mockTelegramClient)
      );

      const result = await useCase.execute({
        sellerId: "3680586616",
        packId: "2000004567",
        messageText: "El mouse no enciende y vino con la caja rota",
      });

      expect(result?.status).toBe("pending_review");
      expect(result?.intent).toBe("reclamo_potencial");
      expect(mockMeliClient.postOrderMessage).not.toHaveBeenCalled();
      expect(mockSseNotifier.broadcastToSeller).toHaveBeenCalledWith(
        "3680586616",
        "order_message_received",
        expect.anything()
      );
    });
  });

  describe("Use Case - ReplyOrderMessageUseCase", () => {
    it("should reply to buyer in MELI and update message status", async () => {
      const msg = new OrderMessage({
        id: "msg-100",
        sellerId: "3680586616",
        packId: "pack-100",
        buyerId: "buyer-100",
        messageText: "Consulta de prueba",
        senderRole: "buyer",
        status: "pending_review",
      });

      mockOrderMessageRepo.findById.mockResolvedValue(msg);

      const useCase = new ReplyOrderMessageUseCase(
        mockOrderMessageRepo,
        mockMeliClient,
        mockEventRepo,
        mockSseNotifier
      );

      const updated = await useCase.execute({
        messageId: "msg-100",
        sellerId: "3680586616",
        replyText: "Hola, te confirmamos que despachamos hoy.",
        source: "web_panel",
      });

      expect(updated.status).toBe("replied");
      expect(updated.sellerAnswer).toBe("Hola, te confirmamos que despachamos hoy.");
      expect(mockMeliClient.postOrderMessage).toHaveBeenCalledWith(
        "3680586616",
        "pack-100",
        "buyer-100",
        "Hola, te confirmamos que despachamos hoy."
      );
      expect(mockOrderMessageRepo.save).toHaveBeenCalledWith(updated);
    });
  });

  describe("Use Case - ListOrderMessagesUseCase", () => {
    it("should return message list and pending count", async () => {
      mockOrderMessageRepo.listBySeller.mockResolvedValue([
        new OrderMessage({
          id: "m-1",
          sellerId: "3680586616",
          packId: "p-1",
          buyerId: "b-1",
          messageText: "Hola",
          senderRole: "buyer",
          status: "pending_review",
        }),
      ]);
      mockOrderMessageRepo.countPending.mockResolvedValue(1);

      const useCase = new ListOrderMessagesUseCase(mockOrderMessageRepo);
      const res = await useCase.execute("3680586616", { status: "pending_review" });

      expect(res.messages).toHaveLength(1);
      expect(res.pendingCount).toBe(1);
    });
  });
});
