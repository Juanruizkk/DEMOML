import { ITelegramClient } from "../../../interfaces/ITelegramClient.js";
import { ITenantRepository } from "../../../interfaces/ITenantRepository.js";
import { IEventRepository } from "../../../interfaces/IEventRepository.js";
import { ITelegramAssistantService } from "../../../interfaces/ITelegramAssistantService.js";
import { EventLog } from "../../../../domain/entities/EventLog.js";
import { TelegramMessage } from "./TelegramUpdate.js";

/**
 * Maneja mensajes de texto entrantes del bot: vinculación vía /start tenant_<sellerId>
 * y consultas en lenguaje natural delegadas al asistente inteligente.
 */
export class TelegramMessageHandler {
  constructor(
    private readonly telegramClient: ITelegramClient,
    private readonly tenantRepo: ITenantRepository,
    private readonly eventRepo: IEventRepository,
    private readonly telegramAssistant?: ITelegramAssistantService
  ) {}

  public async handle(message: TelegramMessage): Promise<void> {
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
}
