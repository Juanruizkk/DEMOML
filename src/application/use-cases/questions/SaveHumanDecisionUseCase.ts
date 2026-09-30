import { randomUUID } from "node:crypto";
import { IQuestionRepository } from "../../interfaces/IQuestionRepository.js";
import { IGoldenDatasetRepository } from "../../interfaces/IGoldenDatasetRepository.js";
import { IItemCacheRepository } from "../../interfaces/IItemCacheRepository.js";
import { ApproveAnswerUseCase } from "./ApproveAnswerUseCase.js";
import { RejectAnswerUseCase } from "./RejectAnswerUseCase.js";
import { GoldenDatasetEntry, GoldenDecision } from "../../../domain/entities/GoldenDatasetEntry.js";
import { IntentType } from "../../../domain/value-objects/Intent.js";
import { Question } from "../../../domain/entities/Question.js";

export type HumanDecision = GoldenDecision | "rejected";

export interface SaveHumanDecisionParams {
  questionId: string;
  decision: HumanDecision;
  customAnswer?: string;
  humanIntent?: IntentType;
  qualityRating?: number;
  reviewerId: string;
  reasoningNote?: string | null;
}

export class SaveHumanDecisionUseCase {
  constructor(
    private readonly questionRepo: IQuestionRepository,
    private readonly goldenRepo: IGoldenDatasetRepository,
    private readonly approveUseCase: ApproveAnswerUseCase,
    private readonly rejectUseCase: RejectAnswerUseCase,
    private readonly itemCacheRepo: IItemCacheRepository,
  ) {}

  public async execute(params: SaveHumanDecisionParams): Promise<Question> {
    const { questionId, decision, customAnswer, humanIntent, qualityRating, reviewerId, reasoningNote } = params;

    const question = await this.questionRepo.findById(questionId);
    if (!question) {
      throw new Error(`Pregunta no encontrada (ID: ${questionId})`);
    }

    if (decision === "rejected") {
      return this.rejectUseCase.execute(questionId);
    }

    // approved | edited | edited_from_scratch → always calls approve
    const updatedQuestion = await this.approveUseCase.execute({
      questionId,
      customAnswerText: customAnswer,
    });

    // Freeze item snapshot
    let itemSnapshot: Record<string, unknown> = { id: question.itemId };
    try {
      const item = await this.itemCacheRepo.getItem(question.itemId);
      if (item) {
        itemSnapshot = { id: item.id, title: item.title, price: item.price } as Record<string, unknown>;
      }
    } catch {
      // If cache fails, store minimal snapshot
    }

    const finalAnswer = customAnswer ?? question.suggestedAnswer ?? "";
    const resolvedHumanIntent = humanIntent ?? question.intent ?? "otro";

    const entry = new GoldenDatasetEntry({
      id: randomUUID(),
      sellerId: question.sellerId,
      sourceQuestionId: questionId,
      questionText: question.text,
      itemSnapshot,
      llmIntent: question.intent ?? "otro",
      humanIntent: resolvedHumanIntent,
      llmAnswer: question.suggestedAnswer ?? "",
      finalAnswer,
      decision: decision as GoldenDecision,
      qualityRating: qualityRating ?? null,
      reviewerId,
      reasoningNote: reasoningNote ?? null,
    });

    await this.goldenRepo.save(entry);

    return updatedQuestion;
  }
}
