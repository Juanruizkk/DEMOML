import {
  ITelegramClient,
  SendTelegramMessageDTO,
  AnswerCallbackQueryDTO,
  EditTelegramMessageDTO,
  TelegramInlineButton,
} from "../../application/interfaces/ITelegramClient.js";

const TELEGRAM_API_BASE = "https://api.telegram.org";

export class TelegramBotClient implements ITelegramClient {
  private readonly defaultBotToken: string;

  constructor(defaultBotToken?: string) {
    this.defaultBotToken = defaultBotToken || process.env.TELEGRAM_BOT_TOKEN || "";
  }

  private resolveToken(botTokenOverride?: string): { token: string; configured: boolean } {
    const token = botTokenOverride || this.defaultBotToken;
    return {
      token,
      configured: Boolean(token),
    };
  }

  private mapButtons(buttons?: TelegramInlineButton[][]) {
    if (!buttons || buttons.length === 0) return undefined;
    return {
      inline_keyboard: buttons.map((row) =>
        row.map((b) => {
          const btnObj: any = { text: b.text };
          if (b.callbackData) btnObj.callback_data = b.callbackData;
          if (b.url) btnObj.url = b.url;
          return btnObj;
        })
      ),
    };
  }

  public async sendMessage(dto: SendTelegramMessageDTO): Promise<{ messageId?: number; ok: boolean }> {
    const { token, configured } = this.resolveToken(dto.botToken);
    if (!configured) {
      console.warn("[TelegramBotClient] No configurado (falta TELEGRAM_BOT_TOKEN). Mensaje omitido.");
      return { ok: false };
    }

    try {
      const url = `${TELEGRAM_API_BASE}/bot${token}/sendMessage`;
      const body: Record<string, any> = {
        chat_id: dto.chatId,
        text: dto.text,
        parse_mode: dto.parseMode || "Markdown",
      };

      const replyMarkup = this.mapButtons(dto.buttons);
      if (replyMarkup) {
        body.reply_markup = replyMarkup;
      }

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = (await res.json()) as any;
      if (!res.ok || !data.ok) {
        console.error(`[TelegramBotClient] Error enviando mensaje (${res.status}):`, data?.description || data);
        return { ok: false };
      }

      return {
        ok: true,
        messageId: data.result?.message_id,
      };
    } catch (err) {
      console.error("[TelegramBotClient] Excepción al enviar mensaje:", err);
      return { ok: false };
    }
  }

  public async answerCallbackQuery(dto: AnswerCallbackQueryDTO): Promise<void> {
    const { token, configured } = this.resolveToken(dto.botToken);
    if (!configured) return;

    try {
      const url = `${TELEGRAM_API_BASE}/bot${token}/answerCallbackQuery`;
      await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          callback_query_id: dto.callbackQueryId,
          text: dto.text,
          show_alert: dto.showAlert ?? false,
        }),
      });
    } catch (err) {
      console.error("[TelegramBotClient] Error respondiendo callback_query:", err);
    }
  }

  public async editMessage(dto: EditTelegramMessageDTO): Promise<void> {
    const { token, configured } = this.resolveToken(dto.botToken);
    if (!configured) return;

    try {
      const url = `${TELEGRAM_API_BASE}/bot${token}/editMessageText`;
      const body: Record<string, any> = {
        chat_id: dto.chatId,
        message_id: dto.messageId,
        text: dto.text,
        parse_mode: dto.parseMode || "Markdown",
      };

      const replyMarkup = this.mapButtons(dto.buttons);
      if (replyMarkup) {
        body.reply_markup = replyMarkup;
      }

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errText = await res.text();
        console.error(`[TelegramBotClient] Error editando mensaje: ${errText}`);
      }
    } catch (err) {
      console.error("[TelegramBotClient] Excepción al editar mensaje:", err);
    }
  }
}
