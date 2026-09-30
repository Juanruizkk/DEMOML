import { ITelegramClient } from "../../../interfaces/ITelegramClient.js";
import { ITenantRepository } from "../../../interfaces/ITenantRepository.js";
import { IEventRepository } from "../../../interfaces/IEventRepository.js";
import { IClaimRepository } from "../../../interfaces/IClaimRepository.js";
import { IOrderMessageRepository } from "../../../interfaces/IOrderMessageRepository.js";
import { ITelegramAssistantService } from "../../../interfaces/ITelegramAssistantService.js";
import { ApproveAnswerUseCase } from "../../questions/ApproveAnswerUseCase.js";
import { RejectAnswerUseCase } from "../../questions/RejectAnswerUseCase.js";
import { ReplyOrderMessageUseCase } from "../../order-messages/ReplyOrderMessageUseCase.js";
import { EventLog } from "../../../../domain/entities/EventLog.js";
import { TelegramCallbackQuery } from "./TelegramUpdate.js";

/**
 * Maneja los callbacks de botones inline de las alertas: aprobar/rechazar preguntas,
 * aprobar respuestas post-venta, acusar recibo de reclamos y ver detalle.
 */
export class TelegramCallbackQueryHandler {
  constructor(
    private readonly telegramClient: ITelegramClient,
    private readonly tenantRepo: ITenantRepository,
    private readonly eventRepo: IEventRepository,
    private readonly approveUseCase: ApproveAnswerUseCase,
    private readonly rejectUseCase: RejectAnswerUseCase,
    private readonly telegramAssistant?: ITelegramAssistantService,
    private readonly replyOrderMessageUseCase?: ReplyOrderMessageUseCase,
    private readonly orderMessageRepo?: IOrderMessageRepository,
    private readonly claimRepo?: IClaimRepository
  ) {}

  public async handle(cb: TelegramCallbackQuery): Promise<void> {
    const data = cb.data || "";
    const callbackQueryId = cb.id;
    const chatId = cb.message ? String(cb.message.chat.id) : "";
    const messageId = cb.message?.message_id;
    const originalText = cb.message?.text || "";

    if (data.startsWith("claim_detail_")) {
      const claimId = data.replace("claim_detail_", "");
      let tenant = await this.tenantRepo.findByTelegramChatId(chatId);
      if (!tenant) {
        const all = await this.tenantRepo.getAll();
        tenant = all[0] || null;
      }

      if (this.telegramAssistant && tenant) {
        await this.telegramClient.answerCallbackQuery({
          callbackQueryId,
          text: "🔍 Obteniendo detalle del reclamo...",
        });

        const res = await this.telegramAssistant.processMessage({
          tenant,
          userMessage: `Detallame el reclamo #${claimId}`,
          chatId,
        });

        await this.telegramClient.sendMessage({
          chatId,
          text: res.text,
          buttons: res.buttons,
        });
        return;
      }
    }

    if (data.startsWith("msg_approve_")) {
      const msgId = data.replace("msg_approve_", "");
      try {
        if (this.orderMessageRepo && this.replyOrderMessageUseCase) {
          const orderMsg = await this.orderMessageRepo.findById(msgId);
          if (orderMsg && orderMsg.suggestedAnswer) {
            await this.replyOrderMessageUseCase.execute({
              messageId: msgId,
              sellerId: orderMsg.sellerId,
              replyText: orderMsg.suggestedAnswer,
              source: "telegram",
            });

            await this.telegramClient.answerCallbackQuery({
              callbackQueryId,
              text: "✅ Respuesta post-venta enviada al comprador",
            });

            if (chatId && messageId) {
              await this.telegramClient.editMessage({
                chatId,
                messageId,
                text: `${originalText}\n\n━━━━━━━━━━━━━━━━━━━━\n✅ *Respuesta aprobada y enviada al comprador*`,
                buttons: [],
              });
            }
            return;
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        await this.telegramClient.answerCallbackQuery({
          callbackQueryId,
          text: `❌ Error: ${msg}`,
          showAlert: true,
        });
        return;
      }
    }

    if (data.startsWith("msg_view_")) {
      await this.telegramClient.answerCallbackQuery({
        callbackQueryId,
        text: "Abrí la pestaña Mensajes Post-Venta en tu panel web.",
        showAlert: false,
      });
      return;
    }

    if (data.startsWith("approve_")) {
      const questionId = data.replace("approve_", "");
      try {
        await this.approveUseCase.execute({ questionId, isViaWhatsapp: false });
        await this.telegramClient.answerCallbackQuery({
          callbackQueryId,
          text: "✅ Respuesta aprobada y publicada en Mercado Libre",
        });

        if (chatId && messageId) {
          await this.telegramClient.editMessage({
            chatId,
            messageId,
            text: `${originalText}\n\n━━━━━━━━━━━━━━━━━━━━\n✅ *Aprobada por el vendedor*`,
            buttons: [], // Remove buttons to prevent multiple clicks
          });
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        await this.telegramClient.answerCallbackQuery({
          callbackQueryId,
          text: `❌ Error: ${msg}`,
          showAlert: true,
        });
      }
      return;
    }

    if (data.startsWith("reject_")) {
      const questionId = data.replace("reject_", "");
      try {
        await this.rejectUseCase.execute(questionId);
        await this.telegramClient.answerCallbackQuery({
          callbackQueryId,
          text: "🗑️ Respuesta descartada",
        });

        if (chatId && messageId) {
          await this.telegramClient.editMessage({
            chatId,
            messageId,
            text: `${originalText}\n\n━━━━━━━━━━━━━━━━━━━━\n🗑️ *Rechazada y descartada*`,
            buttons: [],
          });
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        await this.telegramClient.answerCallbackQuery({
          callbackQueryId,
          text: `❌ Error: ${msg}`,
          showAlert: true,
        });
      }
      return;
    }

    if (data.startsWith("claim_ack_")) {
      const claimId = data.replace("claim_ack_", "");

      if (this.claimRepo) {
        try {
          const claim = await this.claimRepo.findById(claimId);
          if (claim) {
            claim.markNotified();
            await this.claimRepo.save(claim);
          }
        } catch (e) {
          console.error("[TelegramCallbackQueryHandler] Error guardando ack de reclamo:", e);
        }
      }

      await this.eventRepo.log(
        new EventLog({
          sellerId: chatId,
          type: "claim_ack",
          message: `✈️ Vendedor acusó recibo del reclamo ${claimId} vía Telegram`,
        })
      );

      await this.telegramClient.answerCallbackQuery({
        callbackQueryId,
        text: "✅ Recibido. El reclamo pasó a 'En Gestión'.",
        showAlert: false,
      });

      if (chatId && messageId) {
        await this.telegramClient.editMessage({
          chatId,
          messageId,
          text: `${originalText}\n\n━━━━━━━━━━━━━━━━━━━━\n✅ *Acuse de recibo registrado (En Gestión)*`,
          buttons: [],
        });
      }
      return;
    }

    // Default callback ack
    await this.telegramClient.answerCallbackQuery({
      callbackQueryId,
      text: "Acción procesada",
    });
  }
}
