import { FastifyRequest, FastifyReply } from "fastify";
import { SeedDemoDataUseCase } from "../../application/use-cases/demo/SeedDemoDataUseCase.js";

export class DemoController {
  constructor(
    private readonly seedDemoDataUseCase: SeedDemoDataUseCase,
    private readonly sellerId: string
  ) {}

  seed = async (_req: FastifyRequest, reply: FastifyReply) => {
    const { questions, claims } = await this.seedDemoDataUseCase.execute({ sellerId: this.sellerId });

    return reply.send({
      ok: true,
      message: `${questions.length} preguntas y ${claims.length} reclamos demo generados`,
      questions,
      claims,
    });
  };
}
