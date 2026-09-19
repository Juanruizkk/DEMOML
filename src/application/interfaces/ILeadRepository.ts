import { Lead, LeadStatus } from '../../domain/entities/Lead.js';

export interface ILeadRepository {
  save(lead: Lead): Promise<void>;
  findAll(): Promise<Lead[]>;
  findById(id: string): Promise<Lead | null>;
  updateStatus(id: string, status: LeadStatus): Promise<void>;
}
