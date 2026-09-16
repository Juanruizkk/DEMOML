import { describe, it, expect } from "vitest";
import { GoldenDatasetEntry } from "../../domain/entities/GoldenDatasetEntry.js";

describe("GoldenDatasetEntry", () => {
  it("construye correctamente y expone sus campos", () => {
    const entry = new GoldenDatasetEntry({
      id: "gd-1",
      sellerId: "seller-1",
      sourceQuestionId: "q-123",
      questionText: "¿Tienen stock?",
      itemSnapshot: { id: "MLB123", title: "Auriculares" },
      llmIntent: "stock",
      humanIntent: "stock",
      llmAnswer: "Sí, tenemos stock disponible.",
      finalAnswer: "Sí, tenemos stock disponible.",
      decision: "approved",
      qualityRating: 5,
      reviewerId: "user-1",
      reasoningNote: null,
    });

    expect(entry.sellerId).toBe("seller-1");
    expect(entry.decision).toBe("approved");
    expect(entry.humanIntent).toBe("stock");
    expect(entry.qualityRating).toBe(5);
    expect(entry.itemSnapshot).toEqual({ id: "MLB123", title: "Auriculares" });
  });

  it("acepta decision 'edited_from_scratch' con humanIntent distinto al llmIntent", () => {
    const entry = new GoldenDatasetEntry({
      id: "gd-2",
      sellerId: "seller-1",
      sourceQuestionId: "q-124",
      questionText: "¿Me hacés precio?",
      itemSnapshot: { id: "MLB124", title: "Teclado" },
      llmIntent: "otro",
      humanIntent: "precio_negociacion",
      llmAnswer: "Los precios son fijos.",
      finalAnswer: "Los precios son fijos según Mercado Libre, pero podés aprovechar las promociones.",
      decision: "edited_from_scratch",
      qualityRating: 4,
      reviewerId: "user-1",
      reasoningNote: "El LLM no detectó la intención de negociación",
    });

    expect(entry.decision).toBe("edited_from_scratch");
    expect(entry.humanIntent).toBe("precio_negociacion");
    expect(entry.llmIntent).toBe("otro");
  });
});
