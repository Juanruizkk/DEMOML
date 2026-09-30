import { ITelegramClient } from "../../interfaces/ITelegramClient.js";
import { ITenantRepository } from "../../interfaces/ITenantRepository.js";
import { IEventRepository } from "../../interfaces/IEventRepository.js";
import { IClaimRepository } from "../../interfaces/IClaimRepository.js";
import { IOrderMessageRepository } from "../../interfaces/IOrderMessageRepository.js";
import { ITelegramAssistantService } from "../../interfaces/ITelegramAssistantService.js";
import { ApproveAnswerUseCase } from "../questions/ApproveAnswerUseCase.js";
import { RejectAnswerUseCase } from "../questions/RejectAnswerUseCase.js";
import { ReplyOrderMessageUseCase } from "../order-messages/ReplyOrderMessageUseCase.js";
import { TelegramMessageHandler } from "./telegram/TelegramMessageHandler.js";
import { TelegramCallbackQueryHandler } from "./telegram/TelegramCallbackQueryHandler.js";
import { TelegramUpdate } from "./telegram/TelegramUpdate.js";

export type { TelegramUpdate } from "./telegram/TelegramUpdate.js";

/**
 * Fachada del webhook de Telegram: enruta cada update al handler que corresponde
 * (mensajes de texto vs. callbacks de botones inline).
 */
export class HandleTelegramWebhookUseCase {
  private readonly messageHandler: TelegramMessageHandler;
  private readonly callbackHandler: TelegramCallbackQueryHandler;

  constructor(
    telegramClient: ITelegramClient,
    tenantRepo: ITenantRepository,
    eventRepo: IEventRepository,
    approveUseCase: ApproveAnswerUseCase,
    rejectUseCase: RejectAnswerUseCase,
    telegramAssistant?: ITelegramAssistantService,
    replyOrderMessageUseCase?: ReplyOrderMessageUseCase,
    orderMessageRepo?: IOrderMessageRepository,
    claimRepo?: IClaimRepository
  ) {
    this.messageHandler = new TelegramMessageHandler(
      telegramClient, tenantRepo, eventRepo, telegramAssistant
    );
    this.callbackHandler = new TelegramCallbackQueryHandler(
      telegramClient, tenantRepo, eventRepo, approveUseCase, rejectUseCase,
      telegramAssistant, replyOrderMessageUseCase, orderMessageRepo, claimRepo
    );
  }

  public async execute(update: TelegramUpdate): Promise<void> {
    try {
      // 1. Mensaje de texto o comando
      if (update.message && update.message.text) {
        await this.messageHandler.handle(update.message);
        return;
      }

      // 2. Callback de botón inline
      if (update.callback_query && update.callback_query.data) {
        await this.callbackHandler.handle(update.callback_query);
        return;
      }
    } catch (err) {
      console.error("[HandleTelegramWebhookUseCase] Error procesando update de Telegram:", err);
    }
  }
}
