import { IOrderMessageRepository } from "../interfaces/IOrderMessageRepository.js";
import { ITenantRepository } from "../interfaces/ITenantRepository.js";
import { IEventRepository } from "../interfaces/IEventRepository.js";
import { IMeliClient } from "../interfaces/IMeliClient.js";
import { ILLMService } from "../interfaces/ILLMService.js";
import { IRealtimeNotifier } from "../interfaces/IRealtimeNotifier.js";
import { ITelegramClient } from "../interfaces/ITelegramClient.js";
import { IEmailClient } from "../interfaces/IEmailClient.js";
import { OrderMessage, OrderMessageIntent } from "../../domain/entities/OrderMessage.js";
import { EventLog } from "../../domain/entities/EventLog.js";

export interface ProcessOrderMessageParams {
  sellerId: string;
  packId?: string;
  orderId?: string;
  messageId?: string;
  resource?: string;
  // Direct simulation / injection fields
  buyerId?: string;
  buyerNickname?: string;
  messageText?: string;
  itemTitle?: string;
  conversationId?: string;
}

export class ProcessOrderMessageUseCase {
  constructor(
    private readonly orderMessageRepo: IOrderMessageRepository,
    private readonly tenantRepo: ITenantRepository,
    private readonly eventRepo: IEventRepository,
    private readonly meliClient: IMeliClient,
    private readonly llmService: ILLMService,
    private readonly sseNotifier: IRealtimeNotifier,
    private readonly telegramClient?: ITelegramClient,
    private readonly emailClient?: IEmailClient
  ) {}

  public async execute(params: ProcessOrderMessageParams): Promise<OrderMessage | null> {
    const { sellerId } = params;
    let { packId, orderId, messageId, buyerId, buyerNickname, messageText, itemTitle } = params;

    try {
      // 1. If message details are not provided directly, fetch from Mercado Libre
      if (!messageText && packId) {
        const raw = await this.meliClient.getOrderMessages(sellerId, packId);
        const messages = Array.isArray(raw) ? raw : (raw as any)?.messages || [];

        // Find the latest message from buyer
        const latestBuyerMsg = [...messages].reverse().find(
          (m) => String(m.from.user_id) !== String(sellerId)
        );


        if (!latestBuyerMsg) {
          // No new buyer message (might be a seller's own echo)
          return null;
        }

        messageId = latestBuyerMsg.id;
        messageText = latestBuyerMsg.text;
        buyerId = String(latestBuyerMsg.from.user_id);
      }

      if (!messageText || !packId) {
        console.warn("[ProcessOrderMessageUseCase] Faltan datos requeridos (messageText o packId)", params);
        return null;
      }

      messageId = messageId || `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      orderId = orderId || packId;

      // Deduplication check
      const existing = await this.orderMessageRepo.findById(messageId);
      if (existing && existing.status !== "unread" && existing.status !== "pending_review") {
        return existing;
      }

      // Fetch order details if needed for context
      if (!itemTitle || !buyerNickname) {
        try {
          const order = await this.meliClient.getOrder(sellerId, orderId);
          if (order) {
            itemTitle = itemTitle || order.order_items?.[0]?.item?.title || "Producto de la orden";
            buyerNickname = buyerNickname || order.buyer?.nickname || "Comprador";
            buyerId = buyerId || String(order.buyer?.id || "");
          }
        } catch (e) {
          // Optional enrichment failure is tolerated
          itemTitle = itemTitle || "Producto comprado";
          buyerNickname = buyerNickname || "Comprador";
        }
      }

      // 2. Fetch Tenant and verify permissions
      const tenant = await this.tenantRepo.findBySellerId(sellerId);
      if (tenant && tenant.effectivePermissions.postSaleEnabled === false) {
        await this.eventRepo.log(
          new EventLog({
            sellerId,
            type: "order_message_skipped",
            message: `⚠️ Mensajería post-venta deshabilitada por permisos del vendedor`,
          })
        );
        return null;
      }

      // 3. Classify message with LLM
      const llmResult = await this.llmService.classifyOrderMessage({
        messageText,
        itemTitle,
        buyerNickname,
        settings: tenant?.settings,
        orderContext: `Orden #${orderId} - Pack #${packId}`,
        llmCredentials: tenant?.getLLMCredentials() ?? null,
        usageContext: { sellerId: params.sellerId, channel: "order_messages" },
      });

      const intentLabels: Record<OrderMessageIntent, string> = {
        facturacion: "🧾 Facturación (Factura A/B)",
        envio_seguimiento: "🚚 Envío y Seguimiento",
        soporte_tecnico: "🔧 Soporte Técnico y Uso",
        garantia_consulta: "🛡️ Consulta de Garantía",
        reclamo_potencial: "⚠️ Posible Reclamo / Disconformidad",
        agradecimiento: "🙌 Agradecimiento / Saludo",
        otro: "💬 Consulta General",
      };

      // 4. Determine Automation vs Human Review
      const autoMode = tenant?.settings?.automationMode || "smart_hybrid";
      const threshold = tenant?.settings?.confidenceThreshold ?? 0.75;
      const isHighConfidence = llmResult.confidence >= threshold;

      let shouldAutoAnswer = false;
      if (autoMode === "always_auto" && isHighConfidence) {
        shouldAutoAnswer = true;
      } else if (autoMode === "smart_hybrid" && isHighConfidence && !llmResult.requires_human) {
        shouldAutoAnswer = true;
      }

      // Special safety rule: Potential claims should never auto-answer blindly unless 100% confidence & not requiring human
      if (llmResult.intent === "reclamo_potencial" && llmResult.requires_human) {
        shouldAutoAnswer = false;
      }

      const now = new Date();
      let orderMessage: OrderMessage;

      if (shouldAutoAnswer) {
        // Send auto-answer to Mercado Libre
        try {
          await this.meliClient.postOrderMessage(
            sellerId,
            packId,
            buyerId || "0",
            llmResult.answer
          );
        } catch (postErr) {
          console.error("[ProcessOrderMessageUseCase] Error publicando respuesta en MELI:", postErr);
        }

        orderMessage = new OrderMessage({
          id: messageId,
          sellerId,
          packId,
          orderId,
          buyerId: buyerId || "0",
          buyerNickname,
          messageText,
          senderRole: "buyer",
          status: "auto_answered",
          intent: llmResult.intent,
          aiConfidence: llmResult.confidence,
          suggestedAnswer: llmResult.answer,
          sellerAnswer: llmResult.answer,
          itemTitle,
          createdAt: now,
          answeredAt: now,
        });

        await this.orderMessageRepo.save(orderMessage);

        await this.eventRepo.log(
          new EventLog({
            sellerId,
            type: "order_message_auto_answered",
            message: `⚡ Mensaje post-venta auto-respondido (${intentLabels[llmResult.intent] || llmResult.intent}, Certeza: ${Math.round(llmResult.confidence * 100)}%)`,
          })
        );

        // SSE Realtime Broadcast
        this.sseNotifier.broadcastToSeller(sellerId, "order_message_auto_answered", {
          message_id: orderMessage.id,
          pack_id: orderMessage.packId,
          order_id: orderMessage.orderId,
          buyer_nickname: orderMessage.buyerNickname,
          intent: orderMessage.intent,
          answer: orderMessage.sellerAnswer,
        });

        // Notify Telegram (Informational)
        if (this.telegramClient && tenant?.canSendTelegramAlert()) {
          const creds = tenant.getTelegramCredentials();
          if (creds?.chatId) {
            await this.telegramClient.sendMessage({
              chatId: creds.chatId,
              text:
                `⚡ *MENSAJE POST-VENTA AUTO-RESPONDIDO*\n\n` +
                `📦 *Orden:* #${orderId}\n` +
                `👤 *Comprador:* ${buyerNickname}\n` +
                `🔖 *Motivo:* ${intentLabels[llmResult.intent] || llmResult.intent}\n` +
                `💬 *Mensaje del cliente:*\n"${messageText}"\n\n` +
                `🤖 *Respuesta enviada (${Math.round(llmResult.confidence * 100)}%):*\n"${llmResult.answer}"`,
              botToken: creds.botToken,
            }).catch((err) => console.error("[ProcessOrderMessageUseCase] Telegram auto-notify error:", err));
          }
        }
      } else {
        // Pending human review
        orderMessage = new OrderMessage({
          id: messageId,
          sellerId,
          packId,
          orderId,
          buyerId: buyerId || "0",
          buyerNickname,
          messageText,
          senderRole: "buyer",
          status: "pending_review",
          intent: llmResult.intent,
          aiConfidence: llmResult.confidence,
          suggestedAnswer: llmResult.answer,
          itemTitle,
          createdAt: now,
        });

        await this.orderMessageRepo.save(orderMessage);

        await this.eventRepo.log(
          new EventLog({
            sellerId,
            type: "order_message_received",
            message: `💬 Nuevo mensaje post-venta en revisión (${intentLabels[llmResult.intent] || llmResult.intent})`,
          })
        );

        // SSE Realtime Broadcast for alert bell + live list update
        this.sseNotifier.broadcastToSeller(sellerId, "order_message_received", {
          message_id: orderMessage.id,
          pack_id: orderMessage.packId,
          order_id: orderMessage.orderId,
          buyer_nickname: orderMessage.buyerNickname,
          item_title: orderMessage.itemTitle,
          message_text: orderMessage.messageText,
          intent: orderMessage.intent,
          ai_confidence: orderMessage.aiConfidence,
          suggested_answer: orderMessage.suggestedAnswer,
        });

        // Send Interactive Telegram Alert with 1-Click Approve Button
        if (this.telegramClient && tenant?.canSendTelegramAlert()) {
          const creds = tenant.getTelegramCredentials();
          if (creds?.chatId) {
            const isClaimRisk = llmResult.intent === "reclamo_potencial";
            const headerEmoji = isClaimRisk ? "🚨" : "💬";
            const alertTitle = isClaimRisk
              ? "🚨 *ALERTA PREVENTIVA: MENSAJE POST-VENTA (RIESGO DE RECLAMO)*"
              : "💬 *NUEVO MENSAJE POST-VENTA EN MERCADO LIBRE*";

            await this.telegramClient.sendMessage({
              chatId: creds.chatId,
              text:
                `${alertTitle}\n\n` +
                `📦 *Orden:* #${orderId}\n` +
                `🏷️ *Producto:* ${itemTitle}\n` +
                `👤 *Comprador:* ${buyerNickname}\n` +
                `🔖 *Motivo:* ${intentLabels[llmResult.intent] || llmResult.intent}\n\n` +
                `💬 *Mensaje:*\n"${messageText}"\n\n` +
                `🤖 *Respuesta sugerida por IA (${Math.round(llmResult.confidence * 100)}%):*\n` +
                `"${llmResult.answer}"`,
              buttons: [
                [
                  { text: "✅ Aprobar Respuesta", callbackData: `msg_approve_${orderMessage.id}` },
                  { text: "🌐 Ver en Panel", callbackData: `msg_view_${orderMessage.id}` },
                ],
              ],
              botToken: creds.botToken,
            }).catch((err) => console.error("[ProcessOrderMessageUseCase] Telegram alert error:", err));
          }
        }
      }

      return orderMessage;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[ProcessOrderMessageUseCase] Error fatal:", err);
      await this.eventRepo.log(
        new EventLog({
          sellerId,
          type: "error",
          message: `❌ Error procesando mensaje post-venta: ${msg}`,
        })
      );
      return null;
    }
  }
}
