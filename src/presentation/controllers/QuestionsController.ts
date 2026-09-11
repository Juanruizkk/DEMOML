import { FastifyRequest, FastifyReply } from "fastify";
import { IQuestionRepository } from "../../application/interfaces/IQuestionRepository.js";
import { ApproveAnswerUseCase } from "../../application/use-cases/ApproveAnswerUseCase.js";
import { RejectAnswerUseCase } from "../../application/use-cases/RejectAnswerUseCase.js";

export class QuestionsController {
  constructor(
    private readonly questionRepo: IQuestionRepository,
    private readonly approveUseCase: ApproveAnswerUseCase,
    private readonly rejectUseCase: RejectAnswerUseCase
  ) {}

  private resolveSellerId(request: FastifyRequest): string {
    const user = (request as any).user;
    if (user && user.role === "tenant" && user.sellerId) {
      return user.sellerId;
    }
    const querySellerId = (request.query as any)?.seller_id;
    return querySellerId || process.env.ML_SELLER_ID || "";
  }

  public getQuestions = async (request: FastifyRequest, reply: FastifyReply) => {
    const sellerId = this.resolveSellerId(request);
    const questions = sellerId
      ? await this.questionRepo.findBySellerId(sellerId)
      : await this.questionRepo.findByStatus("pending_review");

    const grouped = {
      pending_review: [] as any[],
      auto_answered: [] as any[],
      other: [] as any[],
    };

    for (const q of questions) {
      if (q.appStatus === "pending_review") {
        grouped.pending_review.push(q);
      } else if (q.appStatus === "auto_answered" || q.appStatus === "approved") {
        grouped.auto_answered.push(q);
      } else {
        grouped.other.push(q);
      }
    }

    return reply.send(grouped);
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
}
