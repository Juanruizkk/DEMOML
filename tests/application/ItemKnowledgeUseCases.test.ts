import { describe, it, expect, vi } from "vitest";
import { SaveItemKnowledgeUseCase } from "../../src/application/use-cases/products/SaveItemKnowledgeUseCase.js";
import { GetSellerProductsUseCase } from "../../src/application/use-cases/products/GetSellerProductsUseCase.js";
import { ItemKnowledge } from "../../src/domain/entities/ItemKnowledge.js";
import { Item } from "../../src/domain/entities/Item.js";

describe("Item Knowledge Use Cases", () => {
  it("SaveItemKnowledgeUseCase debe crear o actualizar reglas de conocimiento", async () => {
    const memoryDb = new Map<string, ItemKnowledge>();
    const mockRepo = {
      findByItemId: vi.fn(async (sellerId: string, itemId: string) => {
        return memoryDb.get(`${sellerId}:${itemId}`) || null;
      }),
      listBySellerId: vi.fn(async (sellerId: string) => {
        return Array.from(memoryDb.values()).filter((k) => k.sellerId === sellerId);
      }),
      save: vi.fn(async (k: ItemKnowledge) => {
        memoryDb.set(`${k.sellerId}:${k.itemId}`, k);
      }),
      delete: vi.fn(async (sellerId: string, itemId: string) => {
        memoryDb.delete(`${sellerId}:${itemId}`);
      }),
    };

    const useCase = new SaveItemKnowledgeUseCase(mockRepo);

    const saved = await useCase.execute({
      sellerId: "seller-123",
      itemId: "MLA999",
      customInstructions: "Solo compatible con 220V",
      faqs: [{ question: "¿Trae cable?", answer: "Sí, de 1.5 metros" }],
    });

    expect(saved.id).toBeDefined();
    expect(saved.sellerId).toBe("seller-123");
    expect(saved.itemId).toBe("MLA999");
    expect(saved.customInstructions).toBe("Solo compatible con 220V");
    expect(saved.faqs.length).toBe(1);

    // Actualización posterior
    const updated = await useCase.execute({
      sellerId: "seller-123",
      itemId: "MLA999",
      customInstructions: "Compatible con 220V y 110V",
      faqs: [],
    });

    expect(updated.id).toBe(saved.id);
    expect(updated.customInstructions).toBe("Compatible con 220V y 110V");
    expect(updated.faqs.length).toBe(0);
  });

  it("GetSellerProductsUseCase debe enriquecer los productos con el estado de conocimiento", async () => {
    const mockMeliClient: any = {
      getSellerItemIds: vi.fn(async () => ["MLA100", "MLA200"]),
      getItem: vi.fn(async (sellerId: string, itemId: string) => {
        return new Item({
          id: itemId,
          sellerId,
          title: itemId === "MLA100" ? "Cafetera Express" : "Teclado Gamer",
          price: 50000,
          currencyId: "ARS",
          availableQuantity: 10,
          condition: "new",
          attributes: [],
          descriptionText: "Descripción base",
        });
      }),
    };

    const mockRepo = {
      findByItemId: vi.fn(),
      listBySellerId: vi.fn(async (sellerId: string) => [
        new ItemKnowledge({
          id: "k-1",
          sellerId,
          itemId: "MLA100",
          customInstructions: "Aclarar que rinde 2 tazas",
          faqs: [],
        }),
      ]),
      save: vi.fn(),
      delete: vi.fn(),
    };

    const useCase = new GetSellerProductsUseCase(mockMeliClient, mockRepo);
    const products = await useCase.execute("seller-123");

    expect(products.length).toBe(2);

    const prod100 = products.find((p) => p.id === "MLA100");
    expect(prod100?.hasCustomKnowledge).toBe(true);
    expect(prod100?.knowledge?.customInstructions).toBe("Aclarar que rinde 2 tazas");

    const prod200 = products.find((p) => p.id === "MLA200");
    expect(prod200?.hasCustomKnowledge).toBe(false);
  });
});
