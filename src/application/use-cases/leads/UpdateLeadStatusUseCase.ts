import { ILeadRepository } from '../../interfaces/ILeadRepository.js';
import { LeadStatus } from '../../../domain/entities/Lead.js';

interface Input {
  id: string;
  status: LeadStatus;
}

interface Output {
  id: string;
  status: LeadStatus;
}

export class UpdateLeadStatusUseCase {
  constructor(private readonly leadRepo: ILeadRepository) {}

  async execute({ id, status }: Input): Promise<Output> {
    const lead = await this.leadRepo.findById(id);
    if (!lead) throw new Error(`Lead no encontrado: ${id}`);

    await this.leadRepo.updateStatus(id, status);
    return { id, status };
  }
}
