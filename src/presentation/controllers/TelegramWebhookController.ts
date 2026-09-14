import { FastifyRequest, FastifyReply } from "fastify";
import { HandleTelegramWebhookUseCase, TelegramUpdate } from "../../application/use-cases/HandleTelegramWebhookUseCase.js";
import { ITelegramClient } from "../../application/interfaces/ITelegramClient.js";
import { ITenantRepository } from "../../application/interfaces/ITenantRepository.js";

export class TelegramWebhookController {
  constructor(
    private readonly handleTelegramUseCase: HandleTelegramWebhookUseCase,
    private readonly telegramClient: ITelegramClient,
    private readonly tenantRepo: ITenantRepository
  ) {}

  // POST /webhook/telegram — incoming updates from Telegram Bot API
  public receive = async (request: FastifyRequest<{ Body: TelegramUpdate }>, reply: FastifyReply) => {
    reply.status(200).send({ ok: true });

    try {
      const update = request.body;
      if (update && (update.message || update.callback_query)) {
        await this.handleTelegramUseCase.execute(update);
      }
    } catch (err) {
      console.error("[TelegramWebhookController] Error procesando webhook:", err);
    }
  };

  // GET /api/tenant/telegram/info — bot configuration & deep link details
  public getInfo = async (request: FastifyRequest, reply: FastifyReply) => {
    const botUsername = process.env.TELEGRAM_BOT_USERNAME || "MeliBotAlertsBot";
    const user = (request as any).user;
    const sellerId = user?.sellerId || (request.query as any)?.seller_id || process.env.ML_SELLER_ID || "";

    const tenant = sellerId ? await this.tenantRepo.findBySellerId(sellerId) : null;

    return reply.send({
      botUsername,
      deepLink: sellerId ? `https://t.me/${botUsername}?start=tenant_${sellerId}` : `https://t.me/${botUsername}`,
      isConfigured: tenant ? tenant.isTelegramConfigured() : false,
      chatId: tenant?.settings.telegramAlertChatId || null,
      enabled: tenant?.settings.telegramEnabled ?? true,
      preferredChannel: tenant?.settings.preferredAlertChannel || "whatsapp",
    });
  };

  // POST /api/tenant/telegram/test — send test alert message to tenant's Telegram
  public sendTest = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user;
    const sellerId = user?.sellerId || (request.body as any)?.seller_id || process.env.ML_SELLER_ID || "";

    if (!sellerId) {
      return reply.status(400).send({ error: "No hay una tienda vinculada a este usuario." });
    }

    const tenant = await this.tenantRepo.findBySellerId(sellerId);
    if (!tenant) {
      return reply.status(404).send({ error: `Vendedor ${sellerId} no encontrado.` });
    }

    const creds = tenant.getTelegramCredentials();
    if (!creds?.chatId) {
      return reply.status(400).send({
        error: "Telegram no está vinculado. Hacé click en 'Conectar Telegram' primero para iniciar el bot.",
      });
    }

    const testRes = await this.telegramClient.sendMessage({
      chatId: creds.chatId,
      text:
        `🧪 *¡Prueba de Alerta Exitosa!*\n\n` +
        `Este es un mensaje de prueba de *MELI AI Assistant* para la tienda *${tenant.nickname || tenant.sellerId}*.\n\n` +
        `📦 *Ítem:* Auriculares Bluetooth Inalámbricos TWS\n` +
        `💬 *Pregunta:* "¿Tienen stock en color negro para envío hoy?"\n` +
        `💡 *Sugerencia IA:* "¡Hola! Sí, tenemos stock disponible en color negro con entrega en el día."\n\n` +
        `✅ El canal de Telegram está listo para recibir alertas en tiempo real.`,
      buttons: [
        [
          { text: "✅ Funciona Correctamente", callbackData: "test_ok" },
        ],
      ],
      botToken: creds.botToken,
    });

    if (!testRes.ok) {
      return reply.status(500).send({
        error: "No se pudo enviar el mensaje a Telegram. Verificá que hayas iniciado el bot enviando /start.",
      });
    }

    return reply.send({
      ok: true,
      message: "Mensaje de prueba enviado a Telegram con éxito.",
      chatId: creds.chatId,
    });
  };
}
