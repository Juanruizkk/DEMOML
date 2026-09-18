import { IQuestionRepository } from "../interfaces/IQuestionRepository.js";
import { IMeliClient } from "../interfaces/IMeliClient.js";
import { IEventRepository } from "../interfaces/IEventRepository.js";
import { IRealtimeNotifier } from "../interfaces/IRealtimeNotifier.js";
import { ModerationService } from "../../domain/services/ModerationService.js";
import { EventLog } from "../../domain/entities/EventLog.js";
import { Question } from "../../domain/entities/Question.js";

export class ApproveAnswerUseCase {
  constructor(
    private readonly questionRepo: IQuestionRepository,
    private readonly meliClient: IMeliClient,
    private readonly eventRepo: IEventRepository,
    private readonly realtimeNotifier: IRealtimeNotifier
  ) {}

  public async execute(params: {
    questionId: string;
    customAnswerText?: string;
    isViaWhatsapp?: boolean;
  }): Promise<Question> {
    const { questionId, customAnswerText, isViaWhatsapp } = params;
    const question = await this.questionRepo.findById(questionId);

    if (!question) {
      throw new Error(`Pregunta no encontrada (ID: ${questionId})`);
    }

    const answerToPublish = (customAnswerText || question.suggestedAnswer || "").trim();
    if (!answerToPublish) {
      throw new Error("No hay texto de respuesta para publicar.");
    }

    // 1. Validar moderación determinística sobre la respuesta humana/editada
    const moderation = ModerationService.moderate(answerToPublish);
    if (moderation.blocked) {
      throw new Error(`Bloqueado por moderación de Mercado Libre: ${moderation.reason}`);
    }

    const startedAt = Date.now();
    const isSimulated = question.itemId === "SIMULATED" || question.buyerId === "simulador" || Number(questionId) >= 900000000;

    // 2. Publicar en Mercado Libre API si es real
    if (!isSimulated) {
      await this.meliClient.postAnswer(question.sellerId, questionId, answerToPublish);
    }

    const latencyMs = Date.now() - question.receivedAt.getTime();
    question.markAsApproved(answerToPublish, latencyMs);
    await this.questionRepo.save(question);

    const publishMsg = isSimulated
      ? `🚀 Respuesta aprobada por operador (simulada)`
      : isViaWhatsapp
      ? `📲 Aprobado vía WhatsApp y publicado en Mercado Libre`
      : `🚀 Respuesta aprobada por operador y publicada en Mercado Libre`;

    await this.eventRepo.log(
      new EventLog({
        sellerId: question.sellerId,
        questionId,
        type: "answer_published",
        message: publishMsg,
        durationMs: Date.now() - startedAt,
      })
    );

    this.realtimeNotifier.broadcastToSeller(question.sellerId, "question_updated", question);

    if (isViaWhatsapp) {
      this.realtimeNotifier.broadcastToSeller(question.sellerId, "whatsapp_reply_confirmed", {
        question_id: questionId,
        final_answer: answerToPublish,
        timestamp: new Date().toISOString(),
      });
    }

    return question;
  }
}
