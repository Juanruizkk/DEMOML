import { eq, desc } from 'drizzle-orm';
import { DrizzleDB } from '../drizzle/db.js';
import { leads } from '../drizzle/schema.js';
import { ILeadRepository } from '../../../application/interfaces/ILeadRepository.js';
import { Lead, LeadStatus, WeeklyQuestions } from '../../../domain/entities/Lead.js';

export class PostgresLeadRepository implements ILeadRepository {
  constructor(private readonly db: DrizzleDB) {}

  public async save(lead: Lead): Promise<void> {
    await this.db.insert(leads).values({
      id: lead.id,
      name: lead.name,
      email: lead.email,
      phone: lead.phone,
      mlStore: lead.mlStore,
      weeklyQuestions: lead.weeklyQuestions,
      qualified: lead.qualified,
      status: lead.status,
      createdAt: lead.createdAt,
    });
  }

  public async findAll(): Promise<Lead[]> {
    const rows = await this.db.select().from(leads).orderBy(desc(leads.createdAt));
    return rows.map(r => this.map(r));
  }

  public async findById(id: string): Promise<Lead | null> {
    const [row] = await this.db.select().from(leads).where(eq(leads.id, id));
    return row ? this.map(row) : null;
  }

  public async updateStatus(id: string, status: LeadStatus): Promise<void> {
    await this.db.update(leads).set({ status }).where(eq(leads.id, id));
  }

  private map(row: typeof leads.$inferSelect): Lead {
    return new Lead({
      id: row.id,
      name: row.name,
      email: row.email,
      phone: row.phone,
      mlStore: row.mlStore,
      weeklyQuestions: row.weeklyQuestions as WeeklyQuestions,
      qualified: row.qualified,
      status: row.status as LeadStatus,
      createdAt: row.createdAt ?? new Date(),
    });
  }
}
