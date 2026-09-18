import { describe, it, expect, vi, beforeEach } from "vitest";
import { TelegramAssistantService } from "../infrastructure/telegram/TelegramAssistantService.js";
import { IQuestionRepository } from "../application/interfaces/IQuestionRepository.js";
import { IClaimRepository } from "../application/interfaces/IClaimRepository.js";
import { IEventRepository } from "../application/interfaces/IEventRepository.js";
import { Question } from "../domain/entities/Question.js";
import { Claim } from "../domain/entities/Claim.js";
import { EventLog } from "../domain/entities/EventLog.js";
import { Tenant } from "../domain/entities/Tenant.js";

describe("TelegramAssistantService", () => {
  let questionRepo: IQuestionRepository;
  let claimRepo: IClaimRepository;
  let eventRepo: IEventRepository;
  let service: TelegramAssistantService;

  const mockTenant = Tenant.createDefault({
    id: "tenant-1",
    sellerId: "seller_123",
    accessToken: "tok",
    refreshToken: "ref",
    expiresInSec: 3600,
    nickname: "ElectroShop",
  });

  const mockQuestions = [
    new Question({
      id: "Q100",
      sellerId: "seller_123",
      itemId: "MLA999",
      text: "¿Tienen stock en color negro?",
      status: "pending_review",
      intent: "stock",
      confidence: 0.6,
      requiresHuman: true,
      reason: "Baja certeza de stock",
      suggestedAnswer: "¡Hola! Sí, disponemos de stock en negro.",
      createdAt: new Date(),
    }),
  ];

  const mockClaims = [
    new Claim({
      id: "C500",
      sellerId: "seller_123",
      orderId: "ORD-999",
      type: "unfulfilled_order",
      stage: "claim",
      status: "opened",
      reason: "El paquete llegó dañado",
      buyerId: "BUYER_1",
      actions: ["send_message_to_buyer", "refund"],
      dueDate: new Date(Date.now() + 6 * 3600 * 1000), // 6 horas restantes
      createdAt: new Date(),
    }),
  ];

  const mockEvents = [
    new EventLog({
      id: 1,
      sellerId: "seller_123",
      questionId: "Q100",
      type: "pending_review",
      message: "👤 Enviado a revisión humana: Baja certeza de stock",
      createdAt: new Date(),
    }),
  ];

  beforeEach(() => {
    questionRepo = {
      findById: vi.fn().mockResolvedValue(mockQuestions[0]),
      save: vi.fn().mockResolvedValue(undefined),
      findBySellerId: vi.fn().mockResolvedValue(mockQuestions),
      findByStatus: vi.fn().mockResolvedValue(mockQuestions),
      getCountsByStatus: vi.fn().mockResolvedValue({
        total: 10,
        auto_answered: 8,
        approved: 1,
        pending_review: 1,
        rejected: 0,
        error: 0,
      }),
      getAverageLatency: vi.fn().mockResolvedValue(1.2),
      getIntentDistribution: vi.fn().mockResolvedValue({ stock: 5 }),
      getStatsBySellerId: vi.fn().mockResolvedValue({ total: 10, autoAnswered: 8 }),
    };

    claimRepo = {
      save: vi.fn().mockResolvedValue(undefined),
      findById: vi.fn().mockImplementation(async (id) => (id === "C500" ? mockClaims[0] : null)),
      listBySellerId: vi.fn().mockResolvedValue(mockClaims),
    };

    eventRepo = {
      log: vi.fn().mockResolvedValue(undefined),
      getRecent: vi.fn().mockResolvedValue(mockEvents),
      getRecentBySellerId: vi.fn().mockResolvedValue(mockEvents),
    };

    service = new TelegramAssistantService(questionRepo, claimRepo, eventRepo);
  });

  describe("Herramientas / Helpers de datos", () => {
    it("getPendingQuestionsData retorna las preguntas en pending_review", async () => {
      const data = await service.getPendingQuestionsData("seller_123", 5);
      expect(data.totalPending).toBe(1);
      expect(data.questions[0].id).toBe("Q100");
      expect(data.questions[0].question).toBe("¿Tienen stock en color negro?");
      expect(data.questions[0].suggestedAnswer).toBe("¡Hola! Sí, disponemos de stock en negro.");
    });

    it("getClaimsData retorna los reclamos abiertos y calcula SLA", async () => {
      const data = await service.getClaimsData("seller_123", "opened");
      expect(data.total).toBe(1);
      expect(data.claims[0].id).toBe("C500");
      expect(data.claims[0].remainingHours).toBeLessThanOrEqual(6);
      expect(data.claims[0].urgency).toBe("critical");
    });

    it("getClaimDetailData retorna detalle completo de un reclamo existente", async () => {
      const data = await service.getClaimDetailData("seller_123", "C500");
      expect(data.claim).not.toBeNull();
      expect(data.claim?.id).toBe("C500");
      expect(data.claim?.reason).toBe("El paquete llegó dañado");
      expect(data.claim?.actions).toContain("refund");
    });

    it("getStoreMetricsData calcula métricas de auto-respuesta y reclamos", async () => {
      const data = await service.getStoreMetricsData("seller_123");
      expect(data.totalQuestions).toBe(10);
      expect(data.autoAnswered).toBe(8);
      expect(data.autoAnswerRate).toBe("80.0%");
      expect(data.pendingReviewCount).toBe(1);
      expect(data.openClaimsCount).toBe(1);
    });
  });

  describe("Fallback Determinístico", () => {
    it("responde ante consulta de preguntas pendientes con botones inline de aprobación", async () => {
      const res = await service.executeFallback("seller_123", "¿Qué preguntas tengo pendientes?");
      expect(res.text).toContain("Tenés 1 pregunta(s) pendiente(s)");
      expect(res.text).toContain("¿Tienen stock en color negro?");
      expect(res.buttons).toBeDefined();
      expect(res.buttons?.[0][0].callbackData).toBe("approve_Q100");
      expect(res.buttons?.[0][1].callbackData).toBe("reject_Q100");
    });

    it("responde ante consulta de reclamos en gestión", async () => {
      const res = await service.executeFallback("seller_123", "¿Tengo reclamos en gestión?");
      expect(res.text).toContain("Reclamos en Gestión");
      expect(res.text).toContain("C500");
      expect(res.buttons?.[0][0].callbackData).toBe("claim_detail_C500");
    });

    it("responde con detalle pormenorizado cuando se solicita un ID de reclamo", async () => {
      const res = await service.executeFallback("seller_123", "Detallame el reclamo C500");
      expect(res.text).toContain("Detalle del Reclamo #C500");
      expect(res.text).toContain("El paquete llegó dañado");
      expect(res.text).toContain("ORD-999");
      expect(res.buttons?.[0][0].callbackData).toBe("claim_ack_C500");
    });

    it("responde ante consulta de métricas de la tienda", async () => {
      const res = await service.executeFallback("seller_123", "Mostrame las metricas y resumen");
      expect(res.text).toContain("Resumen Operativo de tu Tienda");
      expect(res.text).toContain("80.0%");
    });
  });

  describe("processMessage", () => {
    it("ejecuta correctamente y retorna texto y botones", async () => {
      const res = await service.processMessage({
        tenant: mockTenant,
        userMessage: "¿Qué preguntas tengo pendientes de atención?",
        chatId: "12345",
      });

      expect(res.text).toBeDefined();
      expect(typeof res.text).toBe("string");
    });
  });
});
