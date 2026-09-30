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

export type TelegramMessage = NonNullable<TelegramUpdate["message"]>;
export type TelegramCallbackQuery = NonNullable<TelegramUpdate["callback_query"]>;
