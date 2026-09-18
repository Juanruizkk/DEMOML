import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { TelegramBotClient } from "../infrastructure/telegram/TelegramBotClient.js";

describe("TelegramBotClient", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("should send message with inline keyboard buttons successfully", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, result: { message_id: 1234 } }),
    });
    globalThis.fetch = mockFetch;

    const client = new TelegramBotClient("test_bot_token_123");
    const res = await client.sendMessage({
      chatId: "987654321",
      text: "Hola desde test!",
      buttons: [
        [
          { text: "✅ Aprobar", callbackData: "approve_100" },
          { text: "❌ Rechazar", callbackData: "reject_100" },
        ],
      ],
    });

    expect(res.ok).toBe(true);
    expect(res.messageId).toBe(1234);
    expect(mockFetch).toHaveBeenCalledOnce();

    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe("https://api.telegram.org/bottest_bot_token_123/sendMessage");
    const body = JSON.parse(options.body);
    expect(body.chat_id).toBe("987654321");
    expect(body.text).toBe("Hola desde test!");
    expect(body.reply_markup.inline_keyboard[0][0].callback_data).toBe("approve_100");
  });

  it("should answer callback query", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true }),
    });
    globalThis.fetch = mockFetch;

    const client = new TelegramBotClient("test_bot_token_123");
    await client.answerCallbackQuery({
      callbackQueryId: "cb_id_555",
      text: "Acción procesada",
      showAlert: false,
    });

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe("https://api.telegram.org/bottest_bot_token_123/answerCallbackQuery");
    const body = JSON.parse(options.body);
    expect(body.callback_query_id).toBe("cb_id_555");
    expect(body.text).toBe("Acción procesada");
  });

  it("should edit message text", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true }),
    });
    globalThis.fetch = mockFetch;

    const client = new TelegramBotClient("test_bot_token_123");
    await client.editMessage({
      chatId: "987654321",
      messageId: 1234,
      text: "Mensaje editado con éxito",
      buttons: [],
    });

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe("https://api.telegram.org/bottest_bot_token_123/editMessageText");
    const body = JSON.parse(options.body);
    expect(body.message_id).toBe(1234);
    expect(body.text).toBe("Mensaje editado con éxito");
  });
});
