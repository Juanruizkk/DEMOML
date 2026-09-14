import { Tenant } from "../../domain/entities/Tenant.js";
import { TelegramInlineButton } from "./ITelegramClient.js";

export interface TelegramAssistantResponse {
  text: string;
  buttons?: TelegramInlineButton[][];
}

export interface ITelegramAssistantService {
  processMessage(params: {
    tenant: Tenant;
    userMessage: string;
    chatId: string;
  }): Promise<TelegramAssistantResponse>;
}
