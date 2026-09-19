import { FastifyRequest, FastifyReply } from 'fastify';
import { CreateLeadUseCase } from '../../application/use-cases/leads/CreateLeadUseCase.js';
import { UpdateLeadStatusUseCase } from '../../application/use-cases/leads/UpdateLeadStatusUseCase.js';
import { ListLeadsUseCase } from '../../application/use-cases/leads/ListLeadsUseCase.js';
import { LeadStatus, WeeklyQuestions } from '../../domain/entities/Lead.js';

export class LeadController {
  constructor(
    private readonly createLeadUseCase: CreateLeadUseCase,
    private readonly updateLeadStatusUseCase: UpdateLeadStatusUseCase,
    private readonly listLeadsUseCase: ListLeadsUseCase,
  ) {}

  public create = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as {
        name?: string;
        email?: string;
        phone?: string;
        mlStore?: string;
        weeklyQuestions?: WeeklyQuestions;
      };

      if (!body.name || !body.email || !body.phone || !body.mlStore || !body.weeklyQuestions) {
        return reply.status(400).send({ error: 'Todos los campos son requeridos.' });
      }

      const result = await this.createLeadUseCase.execute({
        name: body.name,
        email: body.email,
        phone: body.phone,
        mlStore: body.mlStore,
        weeklyQuestions: body.weeklyQuestions,
      });

      return reply.status(201).send(result);
    } catch (err: any) {
      const isValidation = err.message?.includes('inválido') || err.message?.includes('caracteres');
      return reply.status(isValidation ? 400 : 500).send({ error: err.message });
    }
  };

  public updateStatus = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const { status } = request.body as { status?: LeadStatus };

      const validStatuses: LeadStatus[] = ['nuevo', 'contactado', 'convertido', 'descartado'];
      if (!status || !validStatuses.includes(status)) {
        return reply.status(400).send({ error: 'Estado inválido.' });
      }

      const result = await this.updateLeadStatusUseCase.execute({ id, status });
      return reply.send(result);
    } catch (err: any) {
      const isNotFound = err.message.includes('no encontrado');
      return reply.status(isNotFound ? 404 : 500).send({ error: err.message });
    }
  };

  public list = async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const leads = await this.listLeadsUseCase.execute();
      return reply.send(leads);
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  };
}
