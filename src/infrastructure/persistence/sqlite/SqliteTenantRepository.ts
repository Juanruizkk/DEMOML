import { Database as DatabaseType } from "better-sqlite3";
import { ITenantRepository } from "../../../application/interfaces/ITenantRepository.js";
import { Tenant, TenantPermissions } from "../../../domain/entities/Tenant.js";

const DEFAULT_PERMISSIONS: TenantPermissions = {
  whatsappEnabled: true,
  telegramEnabled: true,
  emailEnabled: false,
  preSaleEnabled: true,
  postSaleEnabled: true,
};

export class SqliteTenantRepository implements ITenantRepository {
  constructor(private readonly db: DatabaseType) {}

  public async findById(id: string): Promise<Tenant | null> {
    const row = this.db.prepare("SELECT * FROM tenants WHERE id = ?").get(id) as any;
    if (!row) return null;
    return this.mapToDomain(row);
  }

  public async findBySellerId(sellerId: string): Promise<Tenant | null> {
    const row = this.db.prepare("SELECT * FROM tenants WHERE seller_id = ?").get(sellerId) as any;
    if (!row) return null;
    return this.mapToDomain(row);
  }

  public async save(tenant: Tenant): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO tenants (id, seller_id, nickname, email, access_token, refresh_token, expires_at, settings_json, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(id) DO UPDATE SET
        seller_id = excluded.seller_id,
        nickname = excluded.nickname,
        email = excluded.email,
        access_token = excluded.access_token,
        refresh_token = excluded.refresh_token,
        expires_at = excluded.expires_at,
        settings_json = excluded.settings_json,
        updated_at = CURRENT_TIMESTAMP
    `);

    stmt.run(
      tenant.id,
      tenant.sellerId,
      tenant.nickname || null,
      tenant.email || null,
      tenant.accessToken,
      tenant.refreshToken,
      tenant.expiresAt,
      JSON.stringify(tenant.settings)
    );
  }

  public async getAll(): Promise<Tenant[]> {
    const rows = this.db.prepare("SELECT * FROM tenants").all() as any[];
    return rows.map((r) => this.mapToDomain(r));
  }

  private mapToDomain(row: any): Tenant {
    const parsedSettings = JSON.parse(row.settings_json || "{}");
    return new Tenant({
      id: row.id,
      sellerId: row.seller_id,
      nickname: row.nickname,
      email: row.email,
      accessToken: row.access_token,
      refreshToken: row.refresh_token,
      expiresAt: row.expires_at,
      settings: {
        ...parsedSettings,
        permissions: parsedSettings.permissions ?? DEFAULT_PERMISSIONS,
      },
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    });
  }
}
