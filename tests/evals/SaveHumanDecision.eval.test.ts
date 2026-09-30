import { describe, it, expect, vi } from "vitest";
import { GoldenDatasetEntry } from "../../src/domain/entities/GoldenDatasetEntry.js";

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

import { SaveHumanDecisionUseCase } from "../../src/application/use-cases/questions/SaveHumanDecisionUseCase.js";
import { Question } from "../../src/domain/entities/Question.js";

function makeQuestion(overrides: Partial<ConstructorParameters<typeof Question>[0]> = {}): Question {
  return new Question({
    id: "q-123",
    sellerId: "seller-1",
    itemId: "MLB123",
    text: "¿Tienen stock?",
    appStatus: "pending_review",
    intent: "stock",
    confidence: 0.6,
    suggestedAnswer: "Sí, tenemos stock.",
    ...overrides,
  });
}

describe("SaveHumanDecisionUseCase", () => {
  const makeRepo = () => ({
    findById: vi.fn(),
    save: vi.fn(),
    findBySellerId: vi.fn(),
  });

  const makeGoldenRepo = () => ({
    save: vi.fn(),
    findBySellerId: vi.fn(),
    getMetricsBySellerId: vi.fn(),
  });

  const makeApproveUseCase = () => ({
    execute: vi.fn().mockResolvedValue(makeQuestion({ appStatus: "approved" })),
  });

  const makeRejectUseCase = () => ({
    execute: vi.fn().mockResolvedValue(makeQuestion({ appStatus: "rejected" })),
  });

  const makeItemCacheRepo = () => ({
    getItem: vi.fn().mockResolvedValue({ id: "MLB123", title: "Auriculares", price: 5000 }),
  });

  it("decision 'approved' guarda en golden dataset con humanIntent del LLM", async () => {
    const questionRepo = makeRepo();
    const question = makeQuestion();
    questionRepo.findById.mockResolvedValue(question);

    const goldenRepo = makeGoldenRepo();
    const approveUseCase = makeApproveUseCase();
    const rejectUseCase = makeRejectUseCase();
    const itemCacheRepo = makeItemCacheRepo();

    const useCase = new SaveHumanDecisionUseCase(
      questionRepo as any,
      goldenRepo as any,
      approveUseCase as any,
      rejectUseCase as any,
      itemCacheRepo as any,
    );

    await useCase.execute({
      questionId: "q-123",
      decision: "approved",
      humanIntent: undefined,
      qualityRating: 5,
      reviewerId: "user-1",
      reasoningNote: null,
    });

    expect(approveUseCase.execute).toHaveBeenCalledWith({
      questionId: "q-123",
      customAnswerText: undefined,
    });
    expect(goldenRepo.save).toHaveBeenCalledOnce();
    const savedEntry: GoldenDatasetEntry = goldenRepo.save.mock.calls[0][0];
    expect(savedEntry.decision).toBe("approved");
    expect(savedEntry.humanIntent).toBe("stock"); // tomó el del LLM
    expect(savedEntry.finalAnswer).toBe("Sí, tenemos stock.");
    expect(savedEntry.qualityRating).toBe(5);
  });

  it("decision 'edited' guarda finalAnswer con el texto custom", async () => {
    const questionRepo = makeRepo();
    questionRepo.findById.mockResolvedValue(makeQuestion());
    const goldenRepo = makeGoldenRepo();
    const approveUseCase = makeApproveUseCase();
    const rejectUseCase = makeRejectUseCase();
    const itemCacheRepo = makeItemCacheRepo();

    const useCase = new SaveHumanDecisionUseCase(
      questionRepo as any,
      goldenRepo as any,
      approveUseCase as any,
      rejectUseCase as any,
      itemCacheRepo as any,
    );

    await useCase.execute({
      questionId: "q-123",
      decision: "edited",
      customAnswer: "Sí, tenemos varias unidades disponibles.",
      humanIntent: "stock",
      qualityRating: 4,
      reviewerId: "user-1",
      reasoningNote: null,
    });

    expect(approveUseCase.execute).toHaveBeenCalledWith({
      questionId: "q-123",
      customAnswerText: "Sí, tenemos varias unidades disponibles.",
    });
    const savedEntry: GoldenDatasetEntry = goldenRepo.save.mock.calls[0][0];
    expect(savedEntry.decision).toBe("edited");
    expect(savedEntry.finalAnswer).toBe("Sí, tenemos varias unidades disponibles.");
  });

  it("decision 'rejected' NO guarda en golden dataset y llama a rejectUseCase", async () => {
    const questionRepo = makeRepo();
    questionRepo.findById.mockResolvedValue(makeQuestion());
    const goldenRepo = makeGoldenRepo();
    const approveUseCase = makeApproveUseCase();
    const rejectUseCase = makeRejectUseCase();
    const itemCacheRepo = makeItemCacheRepo();

    const useCase = new SaveHumanDecisionUseCase(
      questionRepo as any,
      goldenRepo as any,
      approveUseCase as any,
      rejectUseCase as any,
      itemCacheRepo as any,
    );

    await useCase.execute({
      questionId: "q-123",
      decision: "rejected",
      reviewerId: "user-1",
    });

    expect(rejectUseCase.execute).toHaveBeenCalledWith("q-123");
    expect(goldenRepo.save).not.toHaveBeenCalled();
  });

  it("decision 'edited_from_scratch' guarda en golden dataset y llama a approveUseCase", async () => {
    const questionRepo = makeRepo();
    questionRepo.findById.mockResolvedValue(makeQuestion());
    const goldenRepo = makeGoldenRepo();
    const approveUseCase = makeApproveUseCase();
    const rejectUseCase = makeRejectUseCase();
    const itemCacheRepo = makeItemCacheRepo();

    const useCase = new SaveHumanDecisionUseCase(
      questionRepo as any,
      goldenRepo as any,
      approveUseCase as any,
      rejectUseCase as any,
      itemCacheRepo as any,
    );

    await useCase.execute({
      questionId: "q-123",
      decision: "edited_from_scratch",
      customAnswer: "Tenemos 3 unidades disponibles para entrega inmediata.",
      humanIntent: "stock",
      qualityRating: 5,
      reviewerId: "user-1",
      reasoningNote: "El LLM generó respuesta vaga",
    });

    expect(approveUseCase.execute).toHaveBeenCalled();
    expect(rejectUseCase.execute).not.toHaveBeenCalled();
    const savedEntry: GoldenDatasetEntry = goldenRepo.save.mock.calls[0][0];
    expect(savedEntry.decision).toBe("edited_from_scratch");
    expect(savedEntry.reasoningNote).toBe("El LLM generó respuesta vaga");
  });

  it("lanza error si la pregunta no existe", async () => {
    const questionRepo = makeRepo();
    questionRepo.findById.mockResolvedValue(null);
    const goldenRepo = makeGoldenRepo();
    const approveUseCase = makeApproveUseCase();
    const rejectUseCase = makeRejectUseCase();
    const itemCacheRepo = makeItemCacheRepo();

    const useCase = new SaveHumanDecisionUseCase(
      questionRepo as any,
      goldenRepo as any,
      approveUseCase as any,
      rejectUseCase as any,
      itemCacheRepo as any,
    );

    await expect(
      useCase.execute({ questionId: "q-999", decision: "approved", reviewerId: "user-1" })
    ).rejects.toThrow("Pregunta no encontrada");
  });
});
