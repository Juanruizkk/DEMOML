import { IQuestionRepository } from "../../interfaces/IQuestionRepository.js";
import { IItemCacheRepository } from "../../interfaces/IItemCacheRepository.js";
import { ITenantRepository } from "../../interfaces/ITenantRepository.js";
import { IEventRepository } from "../../interfaces/IEventRepository.js";
import { IMeliClient } from "../../interfaces/IMeliClient.js";
import { ILLMService } from "../../interfaces/ILLMService.js";
import { IRealtimeNotifier } from "../../interfaces/IRealtimeNotifier.js";
import { IItemKnowledgeRepository } from "../../interfaces/IItemKnowledgeRepository.js";
import { TenantNotificationService } from "../../services/TenantNotificationService.js";
import { ModerationService } from "../../../domain/services/ModerationService.js";
import { Question } from "../../../domain/entities/Question.js";
import { EventLog } from "../../../domain/entities/EventLog.js";

export class ProcessQuestionUseCase {
  constructor(
    private readonly questionRepo: IQuestionRepository,
    private readonly itemCacheRepo: IItemCacheRepository,
    private readonly tenantRepo: ITenantRepository,
    private readonly eventRepo: IEventRepository,
    private readonly meliClient: IMeliClient,
    private readonly llmService: ILLMService,
    private readonly realtimeNotifier: IRealtimeNotifier,
    private readonly notificationService: TenantNotificationService,
    private readonly itemKnowledgeRepo?: IItemKnowledgeRepository
  ) {}

  public async execute(params: { questionId: string; sellerId: string }): Promise<Question | null> {
    const { questionId, sellerId } = params;
    const startedAt = Date.now();

    // 1. Deduplicación
    const existing = await this.questionRepo.findById(questionId);
    if (existing && existing.isAlreadyFinalized()) {
      return existing;
    }

    const question = existing || new Question({
      id: questionId,
      sellerId,
      itemId: "",
      text: "",
      appStatus: "processing",
    });

    question.appStatus = "processing";
    await this.questionRepo.save(question);

    try {
      // 2. Fetch estado real en Mercado Libre
      let t0 = Date.now();
      const meliQuestion = await this.meliClient.getQuestion(sellerId, questionId);
      const questionFetchMs = Date.now() - t0;

      await this.eventRepo.log(
        new EventLog({
          sellerId,
          questionId,
          type: "question_fetched",
          message: `📨 Pregunta obtenida de MELI (status: ${meliQuestion.status})`,
          durationMs: questionFetchMs,
        })
      );

      question.itemId = String(meliQuestion.item_id);
      question.buyerId = String(meliQuestion.from?.id ?? "");
      question.text = meliQuestion.text;
      question.mlStatus = meliQuestion.status;

      if (meliQuestion.status !== "UNANSWERED") {
        question.appStatus = "skipped_already_answered";
        await this.questionRepo.save(question);
        await this.eventRepo.log(
          new EventLog({
            sellerId,
            questionId,
            type: "skipped",
            message: `⏭️ Pregunta ya respondida fuera del sistema (status: ${meliQuestion.status})`,
          })
        );
        this.realtimeNotifier.broadcastToSeller(sellerId, "question_updated", question);
        return question;
      }

      // 3. Cache / Fetch de Ítem
      t0 = Date.now();
      let item = await this.itemCacheRepo.getItem(question.itemId);
      const fromCache = item !== null && item.isCacheValid();

      if (!fromCache || !item) {
        item = await this.meliClient.getItem(sellerId, question.itemId);
        await this.itemCacheRepo.saveItem(item);
      }
      const itemFetchMs = Date.now() - t0;

      await this.eventRepo.log(
        new EventLog({
          sellerId,
          questionId,
          type: "item_fetched",
          message: `📦 Ítem obtenido${fromCache ? " (cache)" : " de MELI"}: "${item.title}"`,
          durationMs: itemFetchMs,
        })
      );

      // 4. Obtener settings del Tenant e ItemKnowledge
      const [tenant, itemKnowledge] = await Promise.all([
        this.tenantRepo.findBySellerId(sellerId),
        this.itemKnowledgeRepo
          ? this.itemKnowledgeRepo.findByItemId(sellerId, question.itemId).catch(() => null)
          : Promise.resolve(null),
      ]);

      const settings = tenant?.settings || {
        autoAnswerEnabled: true,
        confidenceThreshold: 0.75,
        tone: "casual_rioplatense",
      };

      // 5a. Check LLM quota before calling
      if (tenant && !tenant.canAutoAnswer()) {
        question.markAsPendingReview("Cuota mensual de respuestas agotada");
        await this.questionRepo.save(question);
        await this.eventRepo.log(
          new EventLog({
            sellerId,
            questionId,
            type: "quota_exceeded",
            message: `⛔ Cuota LLM agotada. Pregunta requiere revisión humana.`,
          })
        );
        this.realtimeNotifier.broadcastToSeller(sellerId, "question_updated", question);
        return question;
      }

      // 5. Clasificación y generación LLM
      t0 = Date.now();
      const classification = await this.llmService.classifyAndAnswer({
        questionText: question.text,
        item,
        settings,
        itemKnowledge,
        llmCredentials: tenant?.getLLMCredentials() ?? null,
        usageContext: { sellerId, channel: "questions" },
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

      // Increment LLM usage counter
      if (tenant) {
        const wasAtWarning = tenant.isLLMQuotaAtWarning();
        tenant.incrementLLMResponses();
        await this.tenantRepo.save(tenant);

        if (!wasAtWarning && tenant.isLLMQuotaAtWarning()) {
          await this.eventRepo.log(
            new EventLog({
              sellerId,
              questionId,
              type: "quota_warning",
              message: `⚠️ Usaste el 80% de tus respuestas mensuales (${tenant.settings.llmResponsesThisMonth}/${tenant.settings.monthlyLLMLimit}).`,
            })
          );
        }

        if (tenant.settings.llmQuotaExhaustedAt) {
          await this.eventRepo.log(
            new EventLog({
              sellerId,
              questionId,
              type: "quota_exhausted",
              message: `🚨 Límite mensual alcanzado (${tenant.settings.monthlyLLMLimit} respuestas). El bot pausará automáticamente en 12 horas.`,
            })
          );
        }
      }

      question.intent = classification.intent;
      question.confidence = classification.confidence;
      question.requiresHuman = classification.requires_human;
      question.reason = classification.reason;
      question.suggestedAnswer = classification.answer;

      // 6. Moderación determinística (SIEMPRE corre después del LLM)
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

      // 7. Decisión de publicación automática vs revisión humana
      const autoDecision = tenant
        ? tenant.shouldAutoAnswer(classification.confidence)
        : { autoAnswer: false, reason: "Tenant no configurado" };

      if (!requiresHuman && autoDecision.autoAnswer) {
        t0 = Date.now();
        await this.meliClient.postAnswer(sellerId, questionId, classification.answer);
        const totalMs = Date.now() - startedAt;

        question.markAsAutoAnswered(classification.answer, totalMs);
        await this.questionRepo.save(question);

        await this.eventRepo.log(
          new EventLog({
            sellerId,
            questionId,
            type: "answer_published",
            message: `🚀 Publicado en Mercado Libre API (200 OK) — ${autoDecision.reason}`,
            durationMs: Date.now() - t0,
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
          : requiresHuman
          ? reason || "Requiere intervención humana"
          : autoDecision.reason;

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
          item_title: item.title,
          item_price: item.price,
          question_text: question.text,
          reason: reviewReason,
          suggested_answer: classification.answer,
          intent: classification.intent,
          timestamp: new Date().toISOString(),
        });

        // Alertas al vendedor por los canales configurados (WhatsApp / Telegram / Email)
        await this.notificationService.notify({
          sellerId,
          logContext: { questionId },
          whatsapp: {
            bodyText:
              `🤔 *Pregunta requiere revisión*\n\n` +
              `📦 Ítem: ${item.title}\n` +
              `💬 "${question.text}"\n\n` +
              `💡 Sugerencia: "${(classification.answer || "").slice(0, 100)}${(classification.answer || "").length > 100 ? "…" : ""}"\n\n` +
              `Motivo: ${reviewReason}`,
            buttons: [
              { id: `approve_${questionId}`, title: "✅ Aprobar" },
              { id: `reject_${questionId}`, title: "❌ Rechazar" },
            ],
          },
          telegram: {
            text:
              `🤔 *Pregunta requiere revisión humana*\n\n` +
              `📦 *Ítem:* ${item.title}\n` +
              `💬 *Pregunta:* "${question.text}"\n\n` +
              `💡 *Sugerencia IA:* "${(classification.answer || "").slice(0, 150)}${(classification.answer || "").length > 150 ? "…" : ""}"\n\n` +
              `🔍 *Motivo:* ${reviewReason}`,
            buttons: [
              [
                { text: "✅ Aprobar", callbackData: `approve_${questionId}` },
                { text: "❌ Rechazar", callbackData: `reject_${questionId}` },
              ],
            ],
            successLog: {
              type: "telegram_alert_sent",
              buildMessage: (chatId) => `✈️ Alerta interactiva enviada a Telegram (Chat ID: ${chatId})`,
            },
          },
          email: {
            kind: "question",
            send: (client, to) =>
              client.sendQuestionReviewAlert({
                to,
                sellerId,
                questionId,
                itemTitle: item.title,
                itemPrice: item.price,
                questionText: question.text,
                suggestedAnswer: classification.answer,
                reason: reviewReason,
              }),
            successLog: {
              type: "email_alert_sent",
              buildMessage: (to) => `📧 Alerta de revisión enviada por correo a ${to}`,
            },
          },
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
          message: `❌ Error procesando pregunta: ${err.message}`,
        })
      );

      this.realtimeNotifier.broadcastToSeller(sellerId, "question_updated", question);
      return question;
    }
  }
}
