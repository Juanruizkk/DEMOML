import { IQuestionRepository } from "../interfaces/IQuestionRepository.js";
import { IEventRepository } from "../interfaces/IEventRepository.js";
import { ILLMService } from "../interfaces/ILLMService.js";
import { IRealtimeNotifier } from "../interfaces/IRealtimeNotifier.js";
import { ITenantRepository } from "../interfaces/ITenantRepository.js";
import { ModerationService } from "../../domain/services/ModerationService.js";
import { Question } from "../../domain/entities/Question.js";
import { Item } from "../../domain/entities/Item.js";
import { EventLog } from "../../domain/entities/EventLog.js";

let simulatedCounter = 900000000;

export interface SimulateQuestionParams {
  sellerId?: string;
  text: string;
  itemTitle?: string;
  itemPrice?: number;
  intentHint?: string;
}

export class SimulateQuestionUseCase {
  constructor(
    private readonly questionRepo: IQuestionRepository,
    private readonly tenantRepo: ITenantRepository,
    private readonly eventRepo: IEventRepository,
    private readonly llmService: ILLMService,
    private readonly realtimeNotifier: IRealtimeNotifier
  ) {}

  public async execute(params: SimulateQuestionParams): Promise<Question> {
    const questionId = String(simulatedCounter++);
    const sellerId = params.sellerId || process.env.ML_SELLER_ID || "simulated_seller";
    const startedAt = Date.now();

    const fakeItem = new Item({
      id: "SIMULATED",
      sellerId,
      title: params.itemTitle || "Auriculares Bluetooth Inalámbricos XZ Pro",
      price: params.itemPrice || 45999,
      currencyId: "ARS",
      availableQuantity: 12,
      condition: "new",
      attributes: [
        { name: "Color", value_name: "Negro" },
        { name: "Marca", value_name: "XZ Audio" },
      ],
      descriptionText:
        "Auriculares bluetooth con cancelación de ruido, 30hs de batería, resistentes al agua IPX4. Garantía de fábrica 12 meses.",
    });

    await this.eventRepo.log(
      new EventLog({
        sellerId,
        questionId,
        type: "webhook_received",
        message: `📥 Pregunta simulada recibida${params.intentHint ? ` (hint: ${params.intentHint})` : ""}`,
      })
    );

    const question = new Question({
      id: questionId,
      sellerId,
      itemId: "SIMULATED",
      buyerId: "simulador",
      text: params.text,
      mlStatus: "UNANSWERED",
      appStatus: "processing",
    });

    await this.questionRepo.save(question);
    this.realtimeNotifier.broadcastToSeller(sellerId, "question_updated", question);

    try {
      let t0 = Date.now();
      await this.eventRepo.log(
        new EventLog({
          sellerId,
          questionId,
          type: "item_fetched",
          message: `📦 Ítem simulado: "${fakeItem.title}"`,
          durationMs: Date.now() - t0,
        })
      );

      const tenant = await this.tenantRepo.findBySellerId(sellerId);
      const settings = tenant?.settings || {
        autoAnswerEnabled: true,
        confidenceThreshold: 0.75,
        tone: "casual_rioplatense",
      };

      t0 = Date.now();
      const classification = await this.llmService.classifyAndAnswer({
        questionText: params.text,
        item: fakeItem,
        settings,
      });
      const classifyMs = Date.now() - t0;

      await this.eventRepo.log(
        new EventLog({
          sellerId,
          questionId,
          type: "llm_classified",
          message: `🧠 Clasificado -> intent: ${classification.intent}, conf: ${classification.confidence.toFixed(2)}`,
          durationMs: classifyMs,
        })
      );

      question.intent = classification.intent;
      question.confidence = classification.confidence;
      question.requiresHuman = classification.requires_human;
      question.reason = classification.reason;
      question.suggestedAnswer = classification.answer;

      t0 = Date.now();
      const moderation = ModerationService.moderate(classification.answer);
      const moderationMs = Date.now() - t0;

      await this.eventRepo.log(
        new EventLog({
          sellerId,
          questionId,
          type: "moderation_checked",
          message: moderation.blocked
            ? `🛡️ Moderación determinística: BLOQUEADA (${moderation.reason})`
            : `🛡️ Moderación determinística: APROBADA`,
          durationMs: moderationMs,
        })
      );

      let requiresHuman = classification.requires_human;
      let reason = classification.reason;
      if (moderation.blocked) {
        requiresHuman = true;
        reason = moderation.reason;
      }

      const autoAnswerOn = settings.autoAnswerEnabled;
      const minConfidence = settings.confidenceThreshold || 0.75;

      if (!requiresHuman && classification.confidence >= minConfidence && autoAnswerOn) {
        const totalMs = Date.now() - startedAt;
        question.markAsAutoAnswered(classification.answer, totalMs);
        await this.questionRepo.save(question);

        await this.eventRepo.log(
          new EventLog({
            sellerId,
            questionId,
            type: "answer_published",
            message: `🚀 Publicado (simulado, no llega a MELI real)`,
          })
        );

        await this.eventRepo.log(
          new EventLog({
            sellerId,
            questionId,
            type: "flow_completed",
            message: `✅ Flujo completado en ${(totalMs / 1000).toFixed(3)}s`,
          })
        );
      } else {
        const reviewReason = moderation.blocked
          ? moderation.reason!
          : !autoAnswerOn
          ? "Respuesta automática desactivada"
          : requiresHuman
          ? reason || "Requiere intervención humana"
          : `Confianza insuficiente (${classification.confidence.toFixed(2)})`;

        question.markAsPendingReview(reviewReason);
        await this.questionRepo.save(question);

        await this.eventRepo.log(
          new EventLog({
            sellerId,
            questionId,
            type: "pending_review",
            message: `👤 Enviado a revisión humana: ${reviewReason}`,
          })
        );

        this.realtimeNotifier.broadcastToSeller(sellerId, "whatsapp_notification", {
          question_id: questionId,
          seller_id: sellerId,
          item_title: fakeItem.title,
          item_price: fakeItem.price,
          question_text: params.text,
          reason: reviewReason,
          suggested_answer: classification.answer,
          intent: classification.intent,
          timestamp: new Date().toISOString(),
        });
      }

      this.realtimeNotifier.broadcastToSeller(sellerId, "question_updated", question);
      return question;
    } catch (err: any) {
      question.markAsError(err.message);
      await this.questionRepo.save(question);
      await this.eventRepo.log(
        new EventLog({
          sellerId,
          questionId,
          type: "error",
          message: `❌ Error en simulación: ${err.message}`,
        })
      );
      this.realtimeNotifier.broadcastToSeller(sellerId, "question_updated", question);
      return question;
    }
  }
}
