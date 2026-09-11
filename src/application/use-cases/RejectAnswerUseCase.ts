import { IQuestionRepository } from "../interfaces/IQuestionRepository.js";
import { IEventRepository } from "../interfaces/IEventRepository.js";
import { IRealtimeNotifier } from "../interfaces/IRealtimeNotifier.js";
import { EventLog } from "../../domain/entities/EventLog.js";
import { Question } from "../../domain/entities/Question.js";

export class RejectAnswerUseCase {
  constructor(
    private readonly questionRepo: IQuestionRepository,
    private readonly eventRepo: IEventRepository,
    private readonly realtimeNotifier: IRealtimeNotifier
  ) {}

  public async execute(questionId: string): Promise<Question> {
    const question = await this.questionRepo.findById(questionId);
    if (!question) {
      throw new Error(`Pregunta no encontrada (ID: ${questionId})`);
    }

    question.markAsRejected();
    await this.questionRepo.save(question);

    await this.eventRepo.log(
      new EventLog({
        sellerId: question.sellerId,
        questionId,
        type: "rejected",
        message: `🗑️ Respuesta descartada por operador`,
      })
    );

    this.realtimeNotifier.broadcastToSeller(question.sellerId, "question_updated", question);
    return question;
  }
}
