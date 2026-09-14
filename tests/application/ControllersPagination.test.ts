import { describe, it, expect, vi } from "vitest";
import { QuestionsController } from "../../src/presentation/controllers/QuestionsController.js";
import { ClaimsController } from "../../src/presentation/controllers/ClaimsController.js";
import { ProductsController } from "../../src/presentation/controllers/ProductsController.js";
import { Question } from "../../src/domain/entities/Question.js";
import { Claim } from "../../src/domain/entities/Claim.js";

describe("Backend Pagination across Controllers", () => {
  describe("QuestionsController", () => {
    it("devuelve preguntas paginadas con metadata de paginación", async () => {
      const mockQuestions = Array.from({ length: 25 }, (_, i) => ({
        id: `q_${i + 1}`,
        sellerId: "seller_123",
        itemId: "MLA123456",
        text: `Pregunta ${i + 1}`,
        appStatus: i % 2 === 0 ? "pending_review" : "auto_answered",
        createdAt: new Date(),
        receivedAt: new Date(),
      }));

      const mockRepo = {
        findBySellerId: vi.fn().mockResolvedValue(mockQuestions),
        findByStatus: vi.fn().mockResolvedValue([]),
        findById: vi.fn(),
        save: vi.fn(),
      };

      const controller = new QuestionsController(
        mockRepo as any,
        {} as any,
        {} as any
      );

      const request = {
        user: { role: "tenant", sellerId: "seller_123" },
        query: { page: "2", limit: "10" },
      };

      let responseData: any = null;
      const reply = {
        send: vi.fn().mockImplementation((data) => {
          responseData = data;
          return reply;
        }),
        status: vi.fn().mockReturnThis(),
      };

      await controller.getQuestions(request as any, reply as any);

      expect(responseData).toBeDefined();
      expect(responseData.ok).toBe(true);
      expect(responseData.questions.length).toBe(10);
      expect(responseData.questions[0].id).toBe("q_11");
      expect(responseData.pagination).toEqual({
        page: 2,
        limit: 10,
        total: 25,
        totalPages: 3,
        hasNext: true,
        hasPrev: true,
      });
    });
  });

  describe("ClaimsController", () => {
    it("devuelve reclamos paginados con metadata y métricas", async () => {
      const now = new Date();
      const mockClaims = Array.from({ length: 15 }, (_, i) =>
        new Claim({
          id: `claim_${i + 1}`,
          sellerId: "seller_123",
          orderId: `order_${i + 1}`,
          type: "med_pdd",
          stage: "claim",
          status: "opened",
          reason: `Motivo ${i + 1}`,
          buyerId: "buyer_123",
          actions: [],
          dueDate: new Date(now.getTime() + (i + 1) * 3600000),
          createdAt: now,
          updatedAt: now,
        })
      );

      const mockClaimRepo = {
        listBySellerId: vi.fn().mockResolvedValue(mockClaims),
        findById: vi.fn(),
        save: vi.fn(),
      };

      const controller = new ClaimsController(
        mockClaimRepo as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any
      );

      const request = {
        user: { sellerId: "seller_123" },
        query: { page: "1", limit: "5" },
      };

      let responseData: any = null;
      const reply = {
        send: vi.fn().mockImplementation((data) => {
          responseData = data;
          return reply;
        }),
        status: vi.fn().mockReturnThis(),
      };

      await controller.getClaims(request as any, reply as any);

      expect(responseData).toBeDefined();
      expect(responseData.success).toBe(true);
      expect(responseData.claims.length).toBe(5);
      expect(responseData.pagination).toEqual({
        page: 1,
        limit: 5,
        total: 15,
        totalPages: 3,
        hasNext: true,
        hasPrev: false,
      });
      expect(responseData.metrics.total).toBe(15);
    });
  });

  describe("ProductsController", () => {
    it("devuelve catálogo de productos paginado con soporte de búsqueda", async () => {
      const mockProducts = Array.from({ length: 30 }, (_, i) => ({
        id: `MLA_${i + 1}`,
        title: `Producto Auricular Gamer ${i + 1}`,
        price: 15000 + i * 100,
        currencyId: "ARS",
        availableQuantity: 10,
        condition: "new",
        hasCustomKnowledge: false,
      }));

      const mockGetProductsUseCase = {
        execute: vi.fn().mockResolvedValue(mockProducts),
      };

      const controller = new ProductsController(
        mockGetProductsUseCase as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any
      );

      const request = {
        user: { sellerId: "seller_123" },
        query: { page: "2", limit: "10" },
      };

      let responseData: any = null;
      const reply = {
        send: vi.fn().mockImplementation((data) => {
          responseData = data;
          return reply;
        }),
        status: vi.fn().mockReturnThis(),
      };

      await controller.list(request as any, reply as any);

      expect(responseData).toBeDefined();
      expect(responseData.ok).toBe(true);
      expect(responseData.products.length).toBe(10);
      expect(responseData.products[0].id).toBe("MLA_11");
      expect(responseData.count).toBe(30);
      expect(responseData.pagination).toEqual({
        page: 2,
        limit: 10,
        total: 30,
        totalPages: 3,
        hasNext: true,
        hasPrev: true,
      });
    });
  });
});
