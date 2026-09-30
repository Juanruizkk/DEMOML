import { describe, it, expect } from "vitest";
import { runEval, EvalInput } from "../../src/infrastructure/eval/EvalRunner.js";
import { GoldenDatasetEntry } from "../../src/domain/entities/GoldenDatasetEntry.js";

function makeGoldenEntry(overrides: Partial<ConstructorParameters<typeof GoldenDatasetEntry>[0]> = {}): GoldenDatasetEntry {
  return new GoldenDatasetEntry({
    id: "gd-1",
    sellerId: "seller-1",
    sourceQuestionId: "q-1",
    questionText: "¿Tienen stock?",
    itemSnapshot: { id: "MLB1", title: "Auriculares" },
    llmIntent: "stock",
    humanIntent: "stock",
    llmAnswer: "Sí, tenemos stock.",
    finalAnswer: "Sí, tenemos stock.",
    decision: "approved",
    qualityRating: 5,
    reviewerId: "user-1",
    reasoningNote: null,
    ...overrides,
  });
}

describe("EvalRunner", () => {
  it("pasa cuando el intent y la moderación son correctos", () => {
    const inputs: EvalInput[] = [
      {
        entry: makeGoldenEntry(),
        llmOutput: { intent: "stock", answer: "Sí, tenemos stock disponible.", confidence: 0.9 },
      },
    ];
    const result = runEval(inputs);
    expect(result.passed).toBe(1);
    expect(result.failed).toBe(0);
    expect(result.failures).toHaveLength(0);
  });

  it("falla cuando el intent del LLM no coincide con el humanIntent del golden", () => {
    const inputs: EvalInput[] = [
      {
        entry: makeGoldenEntry({ humanIntent: "stock" }),
        llmOutput: { intent: "envio", answer: "Sí, tenemos stock.", confidence: 0.8 },
      },
    ];
    const result = runEval(inputs);
    expect(result.failed).toBe(1);
    expect(result.failures[0].reason).toContain("intent");
    expect(result.failures[0].expected).toBe("stock");
    expect(result.failures[0].got).toBe("envio");
  });

  it("falla cuando la respuesta del LLM no pasa moderación (número de teléfono)", () => {
    const inputs: EvalInput[] = [
      {
        entry: makeGoldenEntry(),
        llmOutput: { intent: "stock", answer: "Llamanos al 011-4567-8901.", confidence: 0.9 },
      },
    ];
    const result = runEval(inputs);
    expect(result.failed).toBe(1);
    expect(result.failures[0].reason).toContain("moderación");
  });

  it("falla cuando la respuesta del LLM menciona WhatsApp", () => {
    const inputs: EvalInput[] = [
      {
        entry: makeGoldenEntry(),
        llmOutput: { intent: "stock", answer: "Escribinos al WhatsApp.", confidence: 0.8 },
      },
    ];
    const result = runEval(inputs);
    expect(result.failed).toBe(1);
    expect(result.failures[0].reason).toContain("moderación");
  });

  it("procesa múltiples entradas y acumula resultados correctamente", () => {
    const inputs: EvalInput[] = [
      {
        entry: makeGoldenEntry({ id: "gd-1", humanIntent: "stock" }),
        llmOutput: { intent: "stock", answer: "Sí hay stock.", confidence: 0.9 },
      },
      {
        entry: makeGoldenEntry({ id: "gd-2", humanIntent: "envio" }),
        llmOutput: { intent: "stock", answer: "Enviamos en 24hs.", confidence: 0.7 },
      },
      {
        entry: makeGoldenEntry({ id: "gd-3", humanIntent: "garantia" }),
        llmOutput: { intent: "garantia", answer: "Tiene 1 año de garantía oficial.", confidence: 0.95 },
      },
    ];
    const result = runEval(inputs);
    expect(result.totalEntries).toBe(3);
    expect(result.passed).toBe(2);
    expect(result.failed).toBe(1);
  });

  it("retorna failureRate correcto", () => {
    const inputs: EvalInput[] = [
      {
        entry: makeGoldenEntry({ id: "gd-1", humanIntent: "stock" }),
        llmOutput: { intent: "envio", answer: "ok", confidence: 0.9 },
      },
      {
        entry: makeGoldenEntry({ id: "gd-2" }),
        llmOutput: { intent: "stock", answer: "ok", confidence: 0.9 },
      },
    ];
    const result = runEval(inputs);
    expect(result.failureRate).toBe(0.5);
  });
});
