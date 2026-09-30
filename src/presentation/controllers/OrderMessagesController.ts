import { FastifyRequest, FastifyReply } from "fastify";
import { ListOrderMessagesUseCase } from "../../application/use-cases/order-messages/ListOrderMessagesUseCase.js";
import { ReplyOrderMessageUseCase } from "../../application/use-cases/order-messages/ReplyOrderMessageUseCase.js";
import { ProcessOrderMessageUseCase } from "../../application/use-cases/order-messages/ProcessOrderMessageUseCase.js";
import { IOrderMessageRepository } from "../../application/interfaces/IOrderMessageRepository.js";
import { OrderMessageIntent, OrderMessageStatus } from "../../domain/entities/OrderMessage.js";
import { paginateArray } from "../../domain/value-objects/Pagination.js";

export class OrderMessagesController {
  constructor(
    private readonly listOrderMessagesUseCase: ListOrderMessagesUseCase,
    private readonly replyOrderMessageUseCase: ReplyOrderMessageUseCase,
    private readonly processOrderMessageUseCase: ProcessOrderMessageUseCase,
    private readonly orderMessageRepo: IOrderMessageRepository
  ) {}

  public getMessages = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = (request as any).user;
      const query = request.query as {
        seller_id?: string;
        status?: OrderMessageStatus;
        intent?: OrderMessageIntent;
        search?: string;
        page?: string | number;
        limit?: string | number;
      };

      const sellerId =
        user?.role === "tenant"
          ? (user.sellerId || "")
          : (query.seller_id || process.env.ML_SELLER_ID || "3680586616");

      if (!sellerId) {
        return reply.status(400).send({ error: "No hay una tienda vinculada a este usuario." });
      }

      const page = Number(query.page) || 1;
      const limit = Number(query.limit) || 20;

      const { messages, pendingCount } = await this.listOrderMessagesUseCase.execute(sellerId, {
        status: query.status,
        intent: query.intent,
        search: query.search,
      });

      const serialized = messages.map((m) => ({
        id: m.id,
        sellerId: m.sellerId,
        packId: m.packId,
        orderId: m.orderId,
        buyerId: m.buyerId,
        buyerNickname: m.buyerNickname,
        messageText: m.messageText,
        senderRole: m.senderRole,
        status: m.status,
        intent: m.intent,
        aiConfidence: m.aiConfidence,
        suggestedAnswer: m.suggestedAnswer,
        sellerAnswer: m.sellerAnswer,
        itemTitle: m.itemTitle,
        createdAt: m.createdAt.toISOString(),
        answeredAt: m.answeredAt ? m.answeredAt.toISOString() : null,
      }));

      // Calculate summary metrics
      const allMessages = await this.orderMessageRepo.listBySeller(sellerId);
      const metrics = {
        total: allMessages.length,
        pending: allMessages.filter((m) => m.status === "pending_review" || m.status === "unread").length,
        autoAnswered: allMessages.filter((m) => m.status === "auto_answered").length,
        replied: allMessages.filter((m) => m.status === "replied").length,
        claimRisks: allMessages.filter((m) => m.intent === "reclamo_potencial").length,
      };

      const { data: paginatedMessages, pagination } = paginateArray(serialized, page, limit);

      return reply.send({
        success: true,
        pagination,
        messages: paginatedMessages,
        pendingCount,
        metrics,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return reply.status(500).send({ error: `Error al obtener mensajes post-venta: ${msg}` });
    }
  };

  public replyMessage = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = (request as any).user;
      const { id: messageId } = (request.params as any) || {};
      const { replyText, source = "web_panel" } = (request.body as any) || {};

      if (!replyText || !replyText.trim()) {
        return reply.status(400).send({ error: "El texto de la respuesta no puede estar vacío." });
      }

      const existing = await this.orderMessageRepo.findById(messageId);
      if (!existing) {
        return reply.status(404).send({ error: "Mensaje no encontrado." });
      }

      const sellerId =
        user?.role === "tenant"
          ? (user.sellerId || existing.sellerId)
          : existing.sellerId;

      const updated = await this.replyOrderMessageUseCase.execute({
        messageId,
        sellerId,
        replyText: replyText.trim(),
        source,
      });

      return reply.send({
        success: true,
        message: {
          id: updated.id,
          status: updated.status,
          sellerAnswer: updated.sellerAnswer,
          answeredAt: updated.answeredAt ? updated.answeredAt.toISOString() : null,
        },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return reply.status(500).send({ error: `Error al responder mensaje post-venta: ${msg}` });
    }
  };

  public simulate = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = (request as any).user;
      const body = (request.body as any) || {};

      const sellerId =
        user?.role === "tenant"
          ? (user.sellerId || "3680586616")
          : (body.sellerId || process.env.ML_SELLER_ID || "3680586616");

      const packId = body.packId || String(2000000000 + Math.floor(Math.random() * 900000000));
      const orderId = body.orderId || packId;
      const buyerNickname = body.buyerNickname || "COMPRADOR_DEMO";
      const itemTitle = body.itemTitle || "Mouse Gamer Logitech G203 White Lightsync";
      const messageText =
        body.messageText || "Hola, necesitaría si me pueden emitir Factura A para mi empresa, CUIT 30-71234567-9. Gracias!";

      const result = await this.processOrderMessageUseCase.execute({
        sellerId,
        packId,
        orderId,
        buyerId: "3677130936",
        buyerNickname,
        messageText,
        itemTitle,
      });

      if (!result) {
        return reply.status(400).send({ error: "No se pudo procesar la simulación de mensaje post-venta." });
      }

      return reply.status(201).send({
        success: true,
        orderMessage: {
          id: result.id,
          packId: result.packId,
          orderId: result.orderId,
          buyerNickname: result.buyerNickname,
          messageText: result.messageText,
          status: result.status,
          intent: result.intent,
          aiConfidence: result.aiConfidence,
          suggestedAnswer: result.suggestedAnswer,
          sellerAnswer: result.sellerAnswer,
          itemTitle: result.itemTitle,
          createdAt: result.createdAt.toISOString(),
          answeredAt: result.answeredAt ? result.answeredAt.toISOString() : null,
        },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return reply.status(500).send({ error: `Error al simular mensaje post-venta: ${msg}` });
    }
  };
}

