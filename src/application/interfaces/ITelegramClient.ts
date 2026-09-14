export interface TelegramInlineButton {
  text: string;
  callbackData?: string;
  url?: string;
}

export interface SendTelegramMessageDTO {
  chatId: string;
  text: string;
  parseMode?: "Markdown" | "HTML";
  buttons?: TelegramInlineButton[][];
  botToken?: string;
}

export interface AnswerCallbackQueryDTO {
  callbackQueryId: string;
  text?: string;
  showAlert?: boolean;
  botToken?: string;
}

export interface EditTelegramMessageDTO {
  chatId: string;
  messageId: number;
  text: string;
  parseMode?: "Markdown" | "HTML";
  buttons?: TelegramInlineButton[][];
  botToken?: string;
}

export interface ITelegramClient {
  sendMessage(dto: SendTelegramMessageDTO): Promise<{ messageId?: number; ok: boolean }>;
  answerCallbackQuery(dto: AnswerCallbackQueryDTO): Promise<void>;
  editMessage(dto: EditTelegramMessageDTO): Promise<void>;
}
