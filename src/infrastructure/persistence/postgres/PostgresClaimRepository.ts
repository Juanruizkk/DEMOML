import { eq, desc, and } from 'drizzle-orm';
import { DrizzleDB } from '../drizzle/db.js';
import { claims } from '../drizzle/schema.js';
import { IClaimRepository } from '../../../application/interfaces/IClaimRepository.js';
import { Claim, ClaimAction, ClaimStage, ClaimStatus, ClaimType } from '../../../domain/entities/Claim.js';

export class PostgresClaimRepository implements IClaimRepository {
  constructor(private readonly db: DrizzleDB) {}

  public async save(claim: Claim): Promise<void> {
    await this.db.insert(claims).values({
      id: claim.id,
      sellerId: claim.sellerId,
      orderId: claim.orderId,
      type: claim.type,
      stage: claim.stage,
      status: claim.status,
      reason: claim.reason,
      reasonDetail: claim.reasonDetail ?? null,
      buyerId: claim.buyerId ?? null,
      buyerNickname: claim.buyerNickname ?? null,
      itemId: claim.itemId ?? null,
      itemTitle: claim.itemTitle ?? null,
      itemPrice: claim.itemPrice ?? null,
      itemQuantity: claim.itemQuantity ?? null,
      complainantMessage: claim.complainantMessage ?? null,
      actionsJson: JSON.stringify(claim.actions),
      dueDate: claim.dueDate,
      notifiedAt: claim.notifiedAt ?? null,
      updatedAt: new Date(),
    }).onConflictDoUpdate({
      target: claims.id,
      set: {
        stage: claim.stage,
        status: claim.status,
        reason: claim.reason,
        reasonDetail: claim.reasonDetail ?? null,
        buyerNickname: claim.buyerNickname ?? null,
        itemId: claim.itemId ?? null,
        itemTitle: claim.itemTitle ?? null,
        itemPrice: claim.itemPrice ?? null,
        itemQuantity: claim.itemQuantity ?? null,
        complainantMessage: claim.complainantMessage ?? null,
        actionsJson: JSON.stringify(claim.actions),
        dueDate: claim.dueDate,
        notifiedAt: claim.notifiedAt ?? null,
        updatedAt: new Date(),
      },
    });
  }

  public async findById(id: string): Promise<Claim | null> {
    const [row] = await this.db.select().from(claims).where(eq(claims.id, id));
    return row ? this.map(row) : null;
  }

  public async listBySellerId(sellerId: string, status?: ClaimStatus): Promise<Claim[]> {
    let query = this.db.select().from(claims)
      .where(eq(claims.sellerId, sellerId));

    if (status) {
      query = this.db.select().from(claims)
        .where(and(eq(claims.sellerId, sellerId), eq(claims.status, status)));
    }

    const rows = await query.orderBy(desc(claims.dueDate));
    return rows.map(r => this.map(r));
  }

  private map(row: typeof claims.$inferSelect): Claim {
    return new Claim({
      id: row.id,
      sellerId: row.sellerId,
      orderId: row.orderId,
      type: row.type as ClaimType,
      stage: row.stage as ClaimStage,
      status: row.status as ClaimStatus,
      reason: row.reason,
      reasonDetail: row.reasonDetail ?? undefined,
      buyerId: row.buyerId ?? undefined,
      buyerNickname: row.buyerNickname ?? undefined,
      itemId: row.itemId ?? undefined,
      itemTitle: row.itemTitle ?? undefined,
      itemPrice: row.itemPrice ?? undefined,
      itemQuantity: row.itemQuantity ?? undefined,
      complainantMessage: row.complainantMessage ?? undefined,
      actions: JSON.parse(row.actionsJson) as ClaimAction[],
      dueDate: row.dueDate,
      notifiedAt: row.notifiedAt ?? undefined,
      createdAt: row.createdAt ?? new Date(),
      updatedAt: row.updatedAt ?? new Date(),
    });
  }
}
