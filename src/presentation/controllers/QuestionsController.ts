import { FastifyRequest, FastifyReply } from "fastify";
import { IQuestionRepository } from "../../application/interfaces/IQuestionRepository.js";
import { IItemCacheRepository } from "../../application/interfaces/IItemCacheRepository.js";
import { ApproveAnswerUseCase } from "../../application/use-cases/ApproveAnswerUseCase.js";
import { RejectAnswerUseCase } from "../../application/use-cases/RejectAnswerUseCase.js";
import { paginateArray } from "../../domain/value-objects/Pagination.js";
import { SaveHumanDecisionUseCase } from "../../application/use-cases/SaveHumanDecisionUseCase.js";
import { IGoldenDatasetRepository } from "../../application/interfaces/IGoldenDatasetRepository.js";

export class QuestionsController {
  constructor(
    private readonly questionRepo: IQuestionRepository,
    private readonly approveUseCase: ApproveAnswerUseCase,
    private readonly rejectUseCase: RejectAnswerUseCase,
    private readonly itemCacheRepo?: IItemCacheRepository,
    private readonly saveHumanDecisionUseCase?: SaveHumanDecisionUseCase,
    private readonly goldenDatasetRepo?: IGoldenDatasetRepository,
  ) {}

  private resolveSellerId(request: FastifyRequest): string {
    const user = (request as any).user;
    if (user?.role === "tenant") {
      return user.sellerId || "";
    }
    const querySellerId = (request.query as any)?.seller_id;
    return querySellerId || process.env.ML_SELLER_ID || "";
  }

  public getQuestions = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user;
    const sellerId = this.resolveSellerId(request);

    if (user?.role === "tenant" && !sellerId) {
      return reply.send({
        ok: true,
        pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
        questions: [],
        grouped: { pending_review: [], auto_answered: [], other: [] },
        pending_review: [],
        auto_answered: [],
        other: [],
      });
    }
    const query = (request.query as any) || {};
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const filterStatus = query.status as string | undefined;
    const filterItemId = query.item_id as string | undefined;

    let questions = sellerId
      ? await this.questionRepo.findBySellerId(sellerId, 500)
      : await this.questionRepo.findByStatus("pending_review", 500);

    if (filterItemId) {
      questions = questions.filter((q) => q.itemId === filterItemId);
    }
    if (filterStatus && filterStatus !== "all") {
      questions = questions.filter((q) => q.appStatus === filterStatus);
    }

    const itemTitles = new Map<string, string>();
    if (this.itemCacheRepo) {
      const itemIds = Array.from(new Set(questions.map((q) => q.itemId).filter(Boolean)));
      await Promise.all(
        itemIds.map(async (itemId) => {
          try {
            const item = await this.itemCacheRepo!.getItem(itemId);
            if (item) itemTitles.set(itemId, item.title);
          } catch {}
        })
      );
    }

    const formatQuestion = (q: any) => ({
      ...q,
      itemTitle: itemTitles.get(q.itemId) || q.itemTitle || (q.itemId ? `Producto ${q.itemId.slice(-4)}` : undefined),
    });

    const formattedAll = questions.map(formatQuestion);

    const grouped = {
      pending_review: [] as any[],
      auto_answered: [] as any[],
      other: [] as any[],
    };

    for (const q of formattedAll) {
      if (q.appStatus === "pending_review") {
        grouped.pending_review.push(q);
      } else if (q.appStatus === "auto_answered" || q.appStatus === "approved") {
        grouped.auto_answered.push(q);
      } else {
        grouped.other.push(q);
      }
    }

    const { data: paginatedQuestions, pagination } = paginateArray(formattedAll, page, limit);

    return reply.send({
      ok: true,
      pagination,
      questions: paginatedQuestions,
      grouped,
      // Backward compatibility with previous shape
      pending_review: grouped.pending_review,
      auto_answered: grouped.auto_answered,
      other: grouped.other,
    });
  };

  public approve = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user;
    const { id } = request.params as { id: string };
    const { text } = (request.body as { text?: string }) || {};

    const question = await this.questionRepo.findById(id);
    if (!question) {
      return reply.status(404).send({ error: "Pregunta no encontrada." });
    }

    if (user && user.role === "tenant" && user.sellerId && question.sellerId !== user.sellerId) {
      return reply.status(403).send({ error: "No tienes permisos para modificar preguntas de otro vendedor." });
    }

    try {
      const updatedQuestion = await this.approveUseCase.execute({
        questionId: id,
        customAnswerText: text,
      });
      return reply.send(updatedQuestion);
    } catch (err: any) {
      return reply.status(422).send({ error: err.message });
    }
  };

  public reject = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user;
    const { id } = request.params as { id: string };

    const question = await this.questionRepo.findById(id);
    if (!question) {
      return reply.status(404).send({ error: "Pregunta no encontrada." });
    }

    if (user && user.role === "tenant" && user.sellerId && question.sellerId !== user.sellerId) {
      return reply.status(403).send({ error: "No tienes permisos para modificar preguntas de otro vendedor." });
    }

    try {
      const updatedQuestion = await this.rejectUseCase.execute(id);
      return reply.send(updatedQuestion);
    } catch (err: any) {
      return reply.status(404).send({ error: err.message });
    }
  };

  public replyViaWhatsapp = async (request: FastifyRequest, reply: FastifyReply) => {
    const { question_id, reply_text } = (request.body as any) || {};
    if (!question_id || !reply_text) {
      return reply.status(400).send({ error: "Falta question_id o reply_text" });
    }

    try {
      const isApproveChoice =
        reply_text.trim() === "1" ||
        reply_text.trim().toLowerCase() === "si" ||
        reply_text.trim().toLowerCase() === "aprobar";

      const question = await this.approveUseCase.execute({
        questionId: question_id,
        customAnswerText: isApproveChoice ? undefined : reply_text.trim(),
        isViaWhatsapp: true,
      });

      return reply.send({ ok: true, question });
    } catch (err: any) {
      return reply.status(422).send({ error: err.message });
    }
  };

  public humanDecision = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user;
    const { id } = request.params as { id: string };
    const body = (request.body as {
      decision?: "approved" | "edited" | "edited_from_scratch" | "rejected";
      customAnswer?: string;
      humanIntent?: string;
      qualityRating?: number;
      reasoningNote?: string;
    }) || {};

    if (!body.decision) {
      return reply.status(400).send({ error: "El campo 'decision' es requerido." });
    }

    const validDecisions = ["approved", "edited", "edited_from_scratch", "rejected"];
    if (!validDecisions.includes(body.decision)) {
      return reply.status(400).send({ error: `'decision' debe ser uno de: ${validDecisions.join(", ")}` });
    }

    const question = await this.questionRepo.findById(id);
    if (!question) {
      return reply.status(404).send({ error: "Pregunta no encontrada." });
    }

    if (user?.role === "tenant" && user?.sellerId && question.sellerId !== user.sellerId) {
      return reply.status(403).send({ error: "No tenés permisos para modificar preguntas de otro vendedor." });
    }

    if (!this.saveHumanDecisionUseCase) {
      return reply.status(501).send({ error: "SaveHumanDecisionUseCase no está configurado." });
    }

    try {
      const updatedQuestion = await this.saveHumanDecisionUseCase.execute({
        questionId: id,
        decision: body.decision,
        customAnswer: body.customAnswer,
        humanIntent: body.humanIntent as any,
        qualityRating: body.qualityRating,
        reviewerId: user?.id ?? "unknown",
        reasoningNote: body.reasoningNote ?? null,
      });
      return reply.send(updatedQuestion);
    } catch (err: any) {
      return reply.status(422).send({ error: err.message });
    }
  };

  public getGoldenDataset = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user;
    const { sellerId } = request.params as { sellerId: string };
    const query = (request.query as any) || {};

    if (user?.role !== "super_admin") {
      return reply.status(403).send({ error: "Acceso denegado: se requieren permisos de Super Administrador." });
    }

    if (!this.goldenDatasetRepo) {
      return reply.status(501).send({ error: "GoldenDatasetRepository no está configurado." });
    }

    const entries = await this.goldenDatasetRepo.findBySellerId(sellerId, {
      intent: query.intent,
      decision: query.decision,
      limit: Number(query.limit) || 100,
      offset: Number(query.offset) || 0,
    });

    return reply.send({ ok: true, total: entries.length, entries });
  };

  public getGoldenDatasetMetrics = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user;
    const { sellerId } = request.params as { sellerId: string };

    if (user?.role !== "super_admin") {
      return reply.status(403).send({ error: "Acceso denegado: se requieren permisos de Super Administrador." });
    }

    if (!this.goldenDatasetRepo) {
      return reply.status(501).send({ error: "GoldenDatasetRepository no está configurado." });
    }

    const metrics = await this.goldenDatasetRepo.getMetricsBySellerId(sellerId);
    return reply.send({ ok: true, sellerId, metrics });
  };
}
