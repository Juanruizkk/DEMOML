import { eq, sql } from 'drizzle-orm';
import { DrizzleDB } from '../drizzle/db.js';
import { tenants } from '../drizzle/schema.js';
import { ITenantRepository } from '../../../application/interfaces/ITenantRepository.js';
import { Tenant } from '../../../domain/entities/Tenant.js';

export class PostgresTenantRepository implements ITenantRepository {
  constructor(private readonly db: DrizzleDB) {}

  public async findById(id: string): Promise<Tenant | null> {
    const [row] = await this.db.select().from(tenants).where(eq(tenants.id, id));
    return row ? this.map(row) : null;
  }

  public async findBySellerId(sellerId: string): Promise<Tenant | null> {
    const [row] = await this.db.select().from(tenants).where(eq(tenants.sellerId, sellerId));
    return row ? this.map(row) : null;
  }

  public async findByTelegramChatId(chatId: string): Promise<Tenant | null> {
    const all = await this.getAll();
    return all.find(t => t.settings.telegramAlertChatId === chatId) ?? null;
  }

  public async save(tenant: Tenant): Promise<void> {
    const settings = { ...tenant.settings };
    await this.db.insert(tenants).values({
      id: tenant.id,
      sellerId: tenant.sellerId,
      nickname: tenant.nickname ?? null,
      email: tenant.email ?? null,
      accessToken: tenant.accessToken,
      refreshToken: tenant.refreshToken,
      expiresAt: tenant.expiresAt,
      settingsJson: JSON.stringify(settings),
      updatedAt: new Date(),
    }).onConflictDoUpdate({
      target: tenants.id,
      set: {
        sellerId: tenant.sellerId,
        nickname: tenant.nickname ?? null,
        email: tenant.email ?? null,
        accessToken: tenant.accessToken,
        refreshToken: tenant.refreshToken,
        expiresAt: tenant.expiresAt,
        settingsJson: JSON.stringify(settings),
        updatedAt: new Date(),
      },
    });
  }

  public async getAll(): Promise<Tenant[]> {
    const rows = await this.db.select().from(tenants);
    return rows.map(r => this.map(r));
  }

  private map(row: typeof tenants.$inferSelect): Tenant {
    const settings = JSON.parse(row.settingsJson);
    return new Tenant({
      id: row.id,
      sellerId: row.sellerId,
      nickname: row.nickname ?? undefined,
      email: row.email ?? undefined,
      accessToken: row.accessToken,
      refreshToken: row.refreshToken,
      expiresAt: row.expiresAt,
      settings,
      createdAt: row.createdAt ?? new Date(),
      updatedAt: row.updatedAt ?? new Date(),
    });
  }
}
