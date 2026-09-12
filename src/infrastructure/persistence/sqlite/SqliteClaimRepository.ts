import { Database as DatabaseType } from "better-sqlite3";
import { IClaimRepository } from "../../../application/interfaces/IClaimRepository.js";
import { Claim, ClaimAction, ClaimStage, ClaimStatus, ClaimType } from "../../../domain/entities/Claim.js";

export class SqliteClaimRepository implements IClaimRepository {
  constructor(private readonly db: DatabaseType) {}

  public async save(claim: Claim): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO claims (
        id, seller_id, order_id, type, stage, status, reason,
        buyer_id, actions_json, due_date, notified_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(id) DO UPDATE SET
        stage = excluded.stage,
        status = excluded.status,
        actions_json = excluded.actions_json,
        due_date = excluded.due_date,
        notified_at = excluded.notified_at,
        updated_at = CURRENT_TIMESTAMP
    `);

    stmt.run(
      claim.id,
      claim.sellerId,
      claim.orderId,
      claim.type,
      claim.stage,
      claim.status,
      claim.reason,
      claim.buyerId ?? null,
      JSON.stringify(claim.actions),
      claim.dueDate.toISOString(),
      claim.notifiedAt ? claim.notifiedAt.toISOString() : null,
    );
  }

  public async findById(id: string): Promise<Claim | null> {
    const row = this.db.prepare("SELECT * FROM claims WHERE id = ?").get(id) as any;
    if (!row) return null;
    return this.mapToDomain(row);
  }

  public async listBySellerId(sellerId: string, status?: ClaimStatus): Promise<Claim[]> {
    const rows = status
      ? (this.db.prepare("SELECT * FROM claims WHERE seller_id = ? AND status = ? ORDER BY due_date ASC").all(sellerId, status) as any[])
      : (this.db.prepare("SELECT * FROM claims WHERE seller_id = ? ORDER BY due_date ASC").all(sellerId) as any[]);
    return rows.map((r) => this.mapToDomain(r));
  }

  private mapToDomain(row: any): Claim {
    return new Claim({
      id: row.id,
      sellerId: row.seller_id,
      orderId: row.order_id,
      type: row.type as ClaimType,
      stage: row.stage as ClaimStage,
      status: row.status as ClaimStatus,
      reason: row.reason,
      buyerId: row.buyer_id ?? undefined,
      actions: JSON.parse(row.actions_json || "[]") as ClaimAction[],
      dueDate: new Date(row.due_date),
      notifiedAt: row.notified_at ? new Date(row.notified_at) : undefined,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    });
  }
}
