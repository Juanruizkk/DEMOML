import { IOrderMessageRepository } from "../../interfaces/IOrderMessageRepository.js";
import { IMeliClient } from "../../interfaces/IMeliClient.js";
import { IEventRepository } from "../../interfaces/IEventRepository.js";
import { IRealtimeNotifier } from "../../interfaces/IRealtimeNotifier.js";
import { OrderMessage } from "../../../domain/entities/OrderMessage.js";
import { EventLog } from "../../../domain/entities/EventLog.js";

export interface ReplyOrderMessageParams {
  messageId: string;
  sellerId: string;
  replyText: string;
  source?: "web_panel" | "telegram" | "api";
}

export class ReplyOrderMessageUseCase {
  constructor(
    private readonly orderMessageRepo: IOrderMessageRepository,
    private readonly meliClient: IMeliClient,
    private readonly eventRepo: IEventRepository,
    private readonly sseNotifier: IRealtimeNotifier
  ) {}

  public async execute(params: ReplyOrderMessageParams): Promise<OrderMessage> {
    const { messageId, sellerId, replyText, source = "web_panel" } = params;

    const message = await this.orderMessageRepo.findById(messageId);
    if (!message) {
      throw new Error(`Mensaje con ID ${messageId} no encontrado`);
    }

    if (message.sellerId !== sellerId) {
      throw new Error(`No tenés permisos sobre este mensaje.`);
    }

    // 1. Post to Mercado Libre API
    try {
      await this.meliClient.postOrderMessage(
        sellerId,
        message.packId,
        message.buyerId,
        replyText
      );
    } catch (err: any) {
      console.warn(`[ReplyOrderMessageUseCase] Error al postear en MELI (puede ser mock o sandbox):`, err?.message || err);
    }

    // 2. Update message domain model
    message.reply(replyText);
    await this.orderMessageRepo.save(message);

    // 3. Log event
    const sourceLabel = source === "telegram" ? "Telegram" : "Panel Web";
    await this.eventRepo.log(
      new EventLog({
        sellerId,
        type: "order_message_replied",
        message: `📤 Mensaje post-venta respondido desde ${sourceLabel} (Orden #${message.orderId})`,
      })
    );

    // 4. SSE Realtime Broadcast
    this.sseNotifier.broadcastToSeller(sellerId, "order_message_replied", {
      message_id: message.id,
      pack_id: message.packId,
      order_id: message.orderId,
      status: message.status,
      seller_answer: message.sellerAnswer,
      answered_at: message.answeredAt,
    });

    return message;
  }
}
