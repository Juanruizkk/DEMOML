import { ILeadRepository } from '../../interfaces/ILeadRepository.js';
import { Lead } from '../../../domain/entities/Lead.js';

export class ListLeadsUseCase {
  constructor(private readonly leadRepo: ILeadRepository) {}

  async execute(): Promise<Lead[]> {
    return this.leadRepo.findAll();
  }
}
