import { describe, it, expect, vi, beforeEach } from "vitest";
import { ProcessQuestionUseCase } from "../../src/application/use-cases/ProcessQuestionUseCase.js";
import { Question } from "../../src/domain/entities/Question.js";
import { Item } from "../../src/domain/entities/Item.js";
import { Tenant } from "../../src/domain/entities/Tenant.js";

describe("ProcessQuestionUseCase", () => {
  let mockQuestionRepo: any;
  let mockItemCacheRepo: any;
  let mockTenantRepo: any;
  let mockEventRepo: any;
  let mockMeliClient: any;
  let mockLlmService: any;
  let mockNotifier: any;
  let useCase: ProcessQuestionUseCase;

  beforeEach(() => {
    mockQuestionRepo = {
      findById: vi.fn().mockResolvedValue(null),
      save: vi.fn().mockResolvedValue(undefined),
    };
    mockItemCacheRepo = {
      getItem: vi.fn().mockResolvedValue(null),
      saveItem: vi.fn().mockResolvedValue(undefined),
    };
    mockTenantRepo = {
      findBySellerId: vi.fn().mockResolvedValue(
        Tenant.createDefault({
          id: "seller_123",
          sellerId: "seller_123",
          accessToken: "token_abc",
          refreshToken: "refresh_abc",
          expiresInSec: 21600,
        })
      ),
    };
    mockEventRepo = {
      log: vi.fn().mockResolvedValue(undefined),
    };
    mockMeliClient = {
      getQuestion: vi.fn().mockResolvedValue({
        id: 12345,
        seller_id: 123,
        item_id: "MLA999",
        from: { id: 888 },
        text: "¿Tenés stock?",
        status: "UNANSWERED",
        date_created: new Date().toISOString(),
      }),
      getItem: vi.fn().mockResolvedValue(
        new Item({
          id: "MLA999",
          title: "Auriculares Bluetooth",
          price: 25000,
          currencyId: "ARS",
          availableQuantity: 10,
          condition: "new",
          attributes: [],
          descriptionText: "Alta fidelidad",
        })
      ),
      postAnswer: vi.fn().mockResolvedValue(undefined),
    };
    mockLlmService = {
      classifyAndAnswer: vi.fn().mockResolvedValue({
        intent: "stock",
        confidence: 0.95,
        requires_human: false,
        reason: null,
        answer: "¡Hola! Sí, tenemos stock disponible.",
      }),
    };
    mockNotifier = {
      broadcastToSeller: vi.fn(),
      broadcast: vi.fn(),
    };

    useCase = new ProcessQuestionUseCase(
      mockQuestionRepo,
      mockItemCacheRepo,
      mockTenantRepo,
      mockEventRepo,
      mockMeliClient,
      mockLlmService,
      mockNotifier
    );
  });

  it("debe auto-responder cuando la confianza es alta y la moderación aprueba", async () => {
    const result = await useCase.execute({ questionId: "12345", sellerId: "seller_123" });

    expect(result).not.toBeNull();
    expect(result?.appStatus).toBe("auto_answered");
    expect(result?.finalAnswer).toBe("¡Hola! Sí, tenemos stock disponible.");
    expect(mockMeliClient.postAnswer).toHaveBeenCalledWith("seller_123", "12345", "¡Hola! Sí, tenemos stock disponible.");
  });

  it("debe enviar a revisión humana cuando el LLM marca requires_human (ej. negociación)", async () => {
    mockLlmService.classifyAndAnswer.mockResolvedValueOnce({
      intent: "precio_negociacion",
      confidence: 0.90,
      requires_human: true,
      reason: "Pide 15% de descuento por 5 unidades",
      answer: "Hola, te podemos ofrecer un 5% de descuento.",
    });

    const result = await useCase.execute({ questionId: "12345", sellerId: "seller_123" });

    expect(result?.appStatus).toBe("pending_review");
    expect(result?.requiresHuman).toBe(true);
    expect(mockMeliClient.postAnswer).not.toHaveBeenCalled();
    expect(mockNotifier.broadcastToSeller).toHaveBeenCalledWith("seller_123", "whatsapp_notification", expect.anything());
  });

  it("debe enviar a revisión humana si la moderación determinística bloquea la respuesta del LLM", async () => {
    mockLlmService.classifyAndAnswer.mockResolvedValueOnce({
      intent: "stock",
      confidence: 0.95,
      requires_human: false,
      reason: null,
      answer: "Sí, tenemos stock. Escribinos al 1144556677 para retirar.",
    });

    const result = await useCase.execute({ questionId: "12345", sellerId: "seller_123" });

    expect(result?.appStatus).toBe("pending_review");
    expect(mockMeliClient.postAnswer).not.toHaveBeenCalled();
    expect(result?.reason).toContain("teléfono");
  });
});
