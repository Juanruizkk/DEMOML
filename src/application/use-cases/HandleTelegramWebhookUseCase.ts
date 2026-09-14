import { ITelegramClient } from "../interfaces/ITelegramClient.js";
import { ITenantRepository } from "../interfaces/ITenantRepository.js";
import { IEventRepository } from "../interfaces/IEventRepository.js";
import { ITelegramAssistantService } from "../interfaces/ITelegramAssistantService.js";
import { ApproveAnswerUseCase } from "./ApproveAnswerUseCase.js";
import { RejectAnswerUseCase } from "./RejectAnswerUseCase.js";
import { EventLog } from "../../domain/entities/EventLog.js";

export interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    from?: { id: number; first_name?: string; username?: string };
    chat: { id: number; type: string; title?: string };
    text?: string;
    date: number;
  };
  callback_query?: {
    id: string;
    from: { id: number; first_name?: string; username?: string };
    message?: {
      message_id: number;
      chat: { id: number; type: string };
      text?: string;
    };
    data?: string;
  };
}

export class HandleTelegramWebhookUseCase {
  constructor(
    private readonly telegramClient: ITelegramClient,
    private readonly tenantRepo: ITenantRepository,
    private readonly eventRepo: IEventRepository,
    private readonly approveUseCase: ApproveAnswerUseCase,
    private readonly rejectUseCase: RejectAnswerUseCase,
    private readonly telegramAssistant?: ITelegramAssistantService
  ) {}

  public async execute(update: TelegramUpdate): Promise<void> {
    try {
      // 1. Mensaje de texto o comando
      if (update.message && update.message.text) {
        await this.handleMessage(update.message);
        return;
      }

      // 2. Callback de botón inline
      if (update.callback_query && update.callback_query.data) {
        await this.handleCallbackQuery(update.callback_query);
        return;
      }
    } catch (err) {
      console.error("[HandleTelegramWebhookUseCase] Error procesando update de Telegram:", err);
    }
  }

  private async handleMessage(message: NonNullable<TelegramUpdate["message"]>): Promise<void> {
    const text = (message.text || "").trim();
    const chatId = String(message.chat.id);

    // Manejo de /start tenant_<sellerId>
    if (text.startsWith("/start")) {
      const parts = text.split(" ");
      if (parts.length > 1 && parts[1].startsWith("tenant_")) {
        const sellerId = parts[1].replace("tenant_", "").trim();
        const tenant = await this.tenantRepo.findBySellerId(sellerId);

        if (tenant) {
          tenant.updateSettings({
            telegramAlertChatId: chatId,
            telegramEnabled: true,
            preferredAlertChannel: tenant.settings.preferredAlertChannel === "whatsapp" ? "both" : (tenant.settings.preferredAlertChannel || "telegram"),
          });
          await this.tenantRepo.save(tenant);

          await this.eventRepo.log(
            new EventLog({
              sellerId,
              type: "telegram_connected",
              message: `✈️ Telegram vinculado exitosamente con Chat ID: ${chatId} (${message.from?.username || message.from?.first_name || "Usuario"})`,
            })
          );

          await this.telegramClient.sendMessage({
            chatId,
            text:
              `🎉 *¡Conexión Exitosa con MELI AI Assistant!*\n\n` +
              `Tu cuenta de Mercado Libre (*${tenant.nickname || tenant.sellerId}*) quedó vinculada a este chat.\n\n` +
              `🔔 A partir de ahora recibirás acá:\n` +
              `• ❓ Preguntas pre-venta que requieran tu revisión humana\n` +
              `• ⚖️ Reclamos urgentes con cuenta regresiva de SLA\n` +
              `• ⚡ Botones de acción directa en 1-click`,
          });
          return;
        } else {
          await this.telegramClient.sendMessage({
            chatId,
            text: `⚠️ No se encontró ninguna tienda vinculada con ID \`${sellerId}\`. Por favor generá el enlace desde tu Panel de Vendedor.`,
          });
          return;
        }
      }

      // /start genérico
      await this.telegramClient.sendMessage({
        chatId,
        text:
          `👋 *¡Hola! Soy el Bot de Alertas de MELI AI Assistant.*\n\n` +
          `Para vincular tu tienda:\n` +
          `1. Ingresá a tu panel de vendedor\n` +
          `2. Andá a la pestaña *Alertas & Notificaciones*\n` +
          `3. Hacé click en *Conectar Telegram*\n\n` +
          `Tu Chat ID actual es: \`${chatId}\``,
      });
      return;
    }

    // Buscar tenant vinculado al chatId
    let tenant = await this.tenantRepo.findByTelegramChatId(chatId);
    if (!tenant) {
      const allTenants = await this.tenantRepo.getAll();
      if (allTenants.length === 1) {
        tenant = allTenants[0];
      }
    }

    if (!tenant) {
      await this.telegramClient.sendMessage({
        chatId,
        text:
          `⚠️ *Chat no vinculado*\n\n` +
          `Para consultar preguntas, reclamos y métricas con el bot, primero vinculá tu cuenta de Mercado Libre:\n` +
          `1. Ingresá a tu panel de vendedor\n` +
          `2. En *Alertas & Notificaciones*, seleccioná *Conectar Telegram*\n` +
          `O enviá: \`/start tenant_<tu_seller_id>\``,
      });
      return;
    }

    // Procesar consulta con el Asistente Inteligente (Tools / Function Calling)
    if (this.telegramAssistant) {
      const response = await this.telegramAssistant.processMessage({
        tenant,
        userMessage: text,
        chatId,
      });

      await this.telegramClient.sendMessage({
        chatId,
        text: response.text,
        buttons: response.buttons,
      });
      return;
    }

    // Mensaje de texto no reconocido (fallback si no hay asistente inyectado)
    await this.telegramClient.sendMessage({
      chatId,
      text: `🤖 Usá los botones interactivos de las alertas para responder preguntas y reclamos.`,
    });
  }

  private async handleCallbackQuery(cb: NonNullable<TelegramUpdate["callback_query"]>): Promise<void> {
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
      await this.eventRepo.log(
        new EventLog({
          sellerId: chatId,
          type: "claim_ack",
          message: `✈️ Vendedor acusó recibo del reclamo ${claimId} vía Telegram`,
        })
      );

      await this.telegramClient.answerCallbackQuery({
        callbackQueryId,
        text: "✅ Recibido. Recordá responder en Mercado Libre para evitar penalizaciones.",
        showAlert: false,
      });

      if (chatId && messageId) {
        await this.telegramClient.editMessage({
          chatId,
          messageId,
          text: `${originalText}\n\n━━━━━━━━━━━━━━━━━━━━\n✅ *Acuse de recibo registrado*`,
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
