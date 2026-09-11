import { FastifyRequest, FastifyReply } from "fastify";
import { SimulateQuestionUseCase, SimulateQuestionParams } from "../../application/use-cases/SimulateQuestionUseCase.js";

export class SimulatorController {
  constructor(private readonly simulateUseCase: SimulateQuestionUseCase) {}

  public simulate = async (
    request: FastifyRequest<{ Body: SimulateQuestionParams }>,
    reply: FastifyReply
  ) => {
    const { text } = request.body || {};
    if (!text) {
      return reply.status(400).send({ error: "Falta el texto de la pregunta" });
    }

    try {
      const question = await this.simulateUseCase.execute(request.body);
      return reply.send({ received: true, question });
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  };
}
