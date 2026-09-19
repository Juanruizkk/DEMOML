import crypto from 'node:crypto';
import { ILeadRepository } from '../../interfaces/ILeadRepository.js';
import { IEmailClient } from '../../interfaces/IEmailClient.js';
import { Lead, WeeklyQuestions } from '../../../domain/entities/Lead.js';

interface Input {
  name: string;
  email: string;
  phone: string;
  mlStore: string;
  weeklyQuestions: WeeklyQuestions;
}

interface Output {
  id: string;
  qualified: boolean;
}

export class CreateLeadUseCase {
  constructor(
    private readonly leadRepo: ILeadRepository,
    private readonly emailClient: IEmailClient,
    private readonly adminEmail: string,
  ) {}

  async execute(input: Input): Promise<Output> {
    const qualified = input.weeklyQuestions !== '<10';

    const lead = new Lead({
      id: crypto.randomUUID(),
      name: input.name,
      email: input.email,
      phone: input.phone,
      mlStore: input.mlStore,
      weeklyQuestions: input.weeklyQuestions,
      qualified,
      status: 'nuevo',
    });

    await this.leadRepo.save(lead);

    if (qualified) {
      await (this.emailClient as any).sendNewLeadAlert({
        to: this.adminEmail,
        lead,
      }).catch(() => {});
    }

    return { id: lead.id, qualified };
  }
}
