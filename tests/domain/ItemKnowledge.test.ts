import { describe, it, expect } from "vitest";
import { ItemKnowledge } from "../../src/domain/entities/ItemKnowledge.js";

describe("ItemKnowledge Entity", () => {
  it("debe inicializarse correctamente con valores por defecto", () => {
    const knowledge = new ItemKnowledge({
      id: "uuid-1",
      sellerId: "seller-123",
      itemId: "MLA123456",
    });

    expect(knowledge.id).toBe("uuid-1");
    expect(knowledge.sellerId).toBe("seller-123");
    expect(knowledge.itemId).toBe("MLA123456");
    expect(knowledge.customInstructions).toBe("");
    expect(knowledge.faqs).toEqual([]);
    expect(knowledge.isActive).toBe(true);
    expect(knowledge.hasContent()).toBe(false);
    expect(knowledge.formatPromptContext()).toBe("");
  });

  it("debe reportar hasContent y formatear el contexto de prompt correctamente", () => {
    const knowledge = new ItemKnowledge({
      id: "uuid-2",
      sellerId: "seller-123",
      itemId: "MLA123456",
      customInstructions: "Aclarar que incluye 4 switches de repuesto.",
      faqs: [
        {
          question: "¿Es compatible con Mac?",
          answer: "Sí, es compatible conectando por USB.",
        },
      ],
      isActive: true,
    });

    expect(knowledge.hasContent()).toBe(true);
    const context = knowledge.formatPromptContext();
    expect(context).toContain("Reglas prioritarias: Aclarar que incluye 4 switches de repuesto.");
    expect(context).toContain("P: ¿Es compatible con Mac? -> R: Sí, es compatible conectando por USB.");
  });

  it("no debe tener contenido si isActive es false", () => {
    const knowledge = new ItemKnowledge({
      id: "uuid-3",
      sellerId: "seller-123",
      itemId: "MLA123456",
      customInstructions: "Texto cualquiera",
      isActive: false,
    });

    expect(knowledge.hasContent()).toBe(false);
    expect(knowledge.formatPromptContext()).toBe("");
  });

  it("debe actualizar sus campos correctamente con update()", () => {
    const knowledge = new ItemKnowledge({
      id: "uuid-4",
      sellerId: "seller-123",
      itemId: "MLA123456",
    });

    knowledge.update({
      customInstructions: "Nueva instrucción",
      faqs: [{ question: "P1", answer: "R1" }],
      isActive: true,
    });

    expect(knowledge.customInstructions).toBe("Nueva instrucción");
    expect(knowledge.faqs.length).toBe(1);
    expect(knowledge.hasContent()).toBe(true);
  });
});
