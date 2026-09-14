import { FastifyRequest, FastifyReply } from "fastify";
import { GetSellerProductsUseCase } from "../../application/use-cases/products/GetSellerProductsUseCase.js";
import { SaveItemKnowledgeUseCase } from "../../application/use-cases/products/SaveItemKnowledgeUseCase.js";
import { IItemKnowledgeRepository } from "../../application/interfaces/IItemKnowledgeRepository.js";
import { IMeliClient } from "../../application/interfaces/IMeliClient.js";
import { ILLMService } from "../../application/interfaces/ILLMService.js";
import { ITenantRepository } from "../../application/interfaces/ITenantRepository.js";
import { paginateArray } from "../../domain/value-objects/Pagination.js";

export class ProductsController {
  constructor(
    private readonly getProductsUseCase: GetSellerProductsUseCase,
    private readonly saveKnowledgeUseCase: SaveItemKnowledgeUseCase,
    private readonly itemKnowledgeRepo: IItemKnowledgeRepository,
    private readonly meliClient: IMeliClient,
    private readonly llmService: ILLMService,
    private readonly tenantRepo: ITenantRepository
  ) {}

  private extractSellerId(request: FastifyRequest): string {
    const user = (request as any).user;
    return (
      user?.sellerId ||
      (request.query as any)?.seller_id ||
      process.env.ML_SELLER_ID ||
      ""
    );
  }

  public list = async (request: FastifyRequest, reply: FastifyReply) => {
    const sellerId = this.extractSellerId(request);
    if (!sellerId) {
      return reply
        .status(400)
        .send({ error: "No se especificó un sellerId para listar productos." });
    }

    try {
      const query = (request.query as any) || {};
      const status = query.status || "active";
      const page = Number(query.page) || 1;
      const limit = Number(query.limit) || 20;
      const search = (query.search as string | undefined)?.toLowerCase();

      let products = await this.getProductsUseCase.execute(sellerId, status);

      if (search) {
        products = products.filter(
          (p) =>
            p.title.toLowerCase().includes(search) ||
            p.id.toLowerCase().includes(search)
        );
      }

      const { data: paginatedProducts, pagination } = paginateArray(products, page, limit);

      return reply.send({
        ok: true,
        sellerId,
        count: products.length,
        pagination,
        products: paginatedProducts,
      });
    } catch (err: any) {
      return reply
        .status(500)
        .send({ error: `Error al obtener catálogo: ${err.message}` });
    }
  };

  public getKnowledge = async (request: FastifyRequest, reply: FastifyReply) => {
    const sellerId = this.extractSellerId(request);
    const { itemId } = request.params as { itemId: string };

    if (!sellerId || !itemId) {
      return reply.status(400).send({ error: "sellerId e itemId son requeridos." });
    }

    try {
      const knowledge = await this.itemKnowledgeRepo.findByItemId(sellerId, itemId);
      return reply.send({
        ok: true,
        sellerId,
        itemId,
        hasCustomKnowledge: knowledge ? knowledge.hasContent() : false,
        knowledge: knowledge || {
          customInstructions: "",
          faqs: [],
          isActive: true,
        },
      });
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  };

  public saveKnowledge = async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    const sellerId = this.extractSellerId(request);
    const { itemId } = request.params as { itemId: string };
    const body = request.body as any;

    if (!sellerId || !itemId) {
      return reply.status(400).send({ error: "sellerId e itemId son requeridos." });
    }

    try {
      const knowledge = await this.saveKnowledgeUseCase.execute({
        sellerId,
        itemId,
        customInstructions: body?.customInstructions,
        faqs: body?.faqs,
        isActive: body?.isActive,
      });

      return reply.send({
        ok: true,
        message: "Reglas de conocimiento guardadas correctamente.",
        knowledge,
      });
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  };

  public deleteKnowledge = async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    const sellerId = this.extractSellerId(request);
    const { itemId } = request.params as { itemId: string };

    if (!sellerId || !itemId) {
      return reply.status(400).send({ error: "sellerId e itemId son requeridos." });
    }

    try {
      await this.itemKnowledgeRepo.delete(sellerId, itemId);
      return reply.send({
        ok: true,
        message: `Reglas de conocimiento del producto ${itemId} eliminadas.`,
      });
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  };

  public simulate = async (request: FastifyRequest, reply: FastifyReply) => {
    const sellerId = this.extractSellerId(request);
    const { itemId } = request.params as { itemId: string };
    const body = request.body as {
      questionText: string;
      customInstructions?: string;
      faqs?: Array<{ question: string; answer: string }>;
    };

    if (!sellerId || !itemId || !body?.questionText) {
      return reply.status(400).send({
        error: "sellerId, itemId y questionText son requeridos para la simulación.",
      });
    }

    try {
      const [item, tenant, storedKnowledge] = await Promise.all([
        this.meliClient.getItem(sellerId, itemId),
        this.tenantRepo.findBySellerId(sellerId),
        this.itemKnowledgeRepo.findByItemId(sellerId, itemId),
      ]);

      const effectiveKnowledge = storedKnowledge;
      if (effectiveKnowledge && body.customInstructions !== undefined) {
        effectiveKnowledge.customInstructions = body.customInstructions;
      }
      if (effectiveKnowledge && body.faqs !== undefined) {
        effectiveKnowledge.faqs = body.faqs;
      }

      const result = await this.llmService.classifyAndAnswer({
        questionText: body.questionText,
        item,
        settings: tenant?.settings,
        itemKnowledge: effectiveKnowledge,
      });

      return reply.send({
        ok: true,
        simulation: {
          questionText: body.questionText,
          intent: result.intent,
          confidence: result.confidence,
          requiresHuman: result.requires_human,
          reason: result.reason,
          answer: result.answer,
          itemTitle: item.title,
        },
      });
    } catch (err: any) {
      return reply
        .status(500)
        .send({ error: `Error en simulación: ${err.message}` });
    }
  };
}
