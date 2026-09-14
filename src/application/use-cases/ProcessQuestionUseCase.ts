import { IQuestionRepository } from "../interfaces/IQuestionRepository.js";
import { IItemCacheRepository } from "../interfaces/IItemCacheRepository.js";
import { ITenantRepository } from "../interfaces/ITenantRepository.js";
import { IEventRepository } from "../interfaces/IEventRepository.js";
import { IMeliClient } from "../interfaces/IMeliClient.js";
import { ILLMService } from "../interfaces/ILLMService.js";
import { IRealtimeNotifier } from "../interfaces/IRealtimeNotifier.js";
import { IWhatsAppClient } from "../interfaces/IWhatsAppClient.js";
import { ITelegramClient } from "../interfaces/ITelegramClient.js";
import { IEmailClient } from "../interfaces/IEmailClient.js";
import { IItemKnowledgeRepository } from "../interfaces/IItemKnowledgeRepository.js";
import { ModerationService } from "../../domain/services/ModerationService.js";
import { Question } from "../../domain/entities/Question.js";
import { EventLog } from "../../domain/entities/EventLog.js";

export class ProcessQuestionUseCase {
  constructor(
    private readonly questionRepo: IQuestionRepository,
    private readonly itemCacheRepo: IItemCacheRepository,
    private readonly tenantRepo: ITenantRepository,
    private readonly eventRepo: IEventRepository,
    private readonly meliClient: IMeliClient,
    private readonly llmService: ILLMService,
    private readonly realtimeNotifier: IRealtimeNotifier,
    private readonly whatsAppClient: IWhatsAppClient,
    private readonly telegramClient?: ITelegramClient,
    private readonly itemKnowledgeRepo?: IItemKnowledgeRepository,
    private readonly emailClient?: IEmailClient
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

      // 5. Clasificación y generación LLM
      t0 = Date.now();
      const classification = await this.llmService.classifyAndAnswer({
        questionText: question.text,
        item,
        settings,
        itemKnowledge,
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

        // Send real WhatsApp notification if tenant has a phone configured
        const tenantAlert = await this.tenantRepo.findBySellerId(sellerId);
        const waPhone = tenantAlert?.settings?.whatsappAlertPhone;
        const channelPref = tenantAlert?.settings?.preferredAlertChannel || "whatsapp";

        if (waPhone && tenantAlert && (channelPref === "whatsapp" || channelPref === "both")) {
          if (tenantAlert.canSendWhatsAppAlert()) {
            const creds = tenantAlert.getWhatsAppCredentials();
            await this.whatsAppClient.sendInteractiveButtons({
              to: waPhone,
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
              credentials: creds ?? undefined,
            }).catch((err) => console.error("[ProcessQuestionUseCase] Error WA:", err));

            if (tenantAlert.settings.whatsappMode === "platform_shared") {
              tenantAlert.incrementAlertsSent();
              await this.tenantRepo.save(tenantAlert);
            }
          } else {
            await this.eventRepo.log(
              new EventLog({
                sellerId,
                type: "WHATSAPP_QUOTA_EXCEEDED",
                message: `Límite mensual de alertas alcanzado (${tenantAlert.settings.alertsSentThisMonth}/${tenantAlert.settings.monthlyAlertsLimit}). Alerta omitida.`,
              })
            );
          }
        }

        // Send Telegram notification if tenant has Telegram enabled & configured
        if (this.telegramClient && tenantAlert?.canSendTelegramAlert() && (channelPref === "telegram" || channelPref === "both")) {
          const creds = tenantAlert.getTelegramCredentials();
          if (creds?.chatId) {
            await this.telegramClient.sendMessage({
              chatId: creds.chatId,
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
              botToken: creds.botToken,
            }).catch((err) => console.error("[ProcessQuestionUseCase] Error Telegram:", err));

            await this.eventRepo.log(
              new EventLog({
                sellerId,
                questionId,
                type: "telegram_alert_sent",
                message: `✈️ Alerta interactiva enviada a Telegram (Chat ID: ${creds.chatId})`,
              })
            );
          }
        }

        // Send Email notification if tenant has Email enabled & configured
        if (this.emailClient && tenantAlert?.canSendEmailAlert("question")) {
          const emailTo = tenantAlert.getEmailAlertAddress();
          if (emailTo) {
            await this.emailClient
              .sendQuestionReviewAlert({
                to: emailTo,
                sellerId,
                questionId,
                itemTitle: item.title,
                itemPrice: item.price,
                questionText: question.text,
                suggestedAnswer: classification.answer,
                reason: reviewReason,
              })
              .then(async (res) => {
                if (res.success) {
                  await this.eventRepo.log(
                    new EventLog({
                      sellerId,
                      questionId,
                      type: "email_alert_sent",
                      message: `📧 Alerta de revisión enviada por correo a ${emailTo}`,
                    })
                  );
                }
              })
              .catch((err) => console.error("[ProcessQuestionUseCase] Error Email:", err));
          }
        }
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
