import { eq, and } from 'drizzle-orm';
import { DrizzleDB } from '../drizzle/db.js';
import { itemKnowledge } from '../drizzle/schema.js';
import { IItemKnowledgeRepository } from '../../../application/interfaces/IItemKnowledgeRepository.js';
import { ItemKnowledge } from '../../../domain/entities/ItemKnowledge.js';

export class PostgresItemKnowledgeRepository implements IItemKnowledgeRepository {
  constructor(private readonly db: DrizzleDB) {}

  public async findByItemId(sellerId: string, itemId: string): Promise<ItemKnowledge | null> {
    const [row] = await this.db.select().from(itemKnowledge)
      .where(and(eq(itemKnowledge.sellerId, sellerId), eq(itemKnowledge.itemId, itemId)));
    return row ? this.map(row) : null;
  }

  public async listBySellerId(sellerId: string): Promise<ItemKnowledge[]> {
    const rows = await this.db.select().from(itemKnowledge)
      .where(eq(itemKnowledge.sellerId, sellerId));
    return rows.map(r => this.map(r));
  }

  public async save(knowledge: ItemKnowledge): Promise<void> {
    await this.db.insert(itemKnowledge).values({
      id: knowledge.id,
      sellerId: knowledge.sellerId,
      itemId: knowledge.itemId,
      customInstructions: knowledge.customInstructions,
      faqsJson: JSON.stringify(knowledge.faqs),
      isActive: knowledge.isActive,
      createdAt: knowledge.createdAt,
      updatedAt: knowledge.updatedAt,
    }).onConflictDoUpdate({
      target: [itemKnowledge.sellerId, itemKnowledge.itemId],
      set: {
        customInstructions: knowledge.customInstructions,
        faqsJson: JSON.stringify(knowledge.faqs),
        isActive: knowledge.isActive,
        updatedAt: knowledge.updatedAt,
      },
    });
  }

  public async delete(sellerId: string, itemId: string): Promise<void> {
    await this.db.delete(itemKnowledge)
      .where(and(eq(itemKnowledge.sellerId, sellerId), eq(itemKnowledge.itemId, itemId)));
  }

  private map(row: typeof itemKnowledge.$inferSelect): ItemKnowledge {
    return new ItemKnowledge({
      id: row.id,
      sellerId: row.sellerId,
      itemId: row.itemId,
      customInstructions: row.customInstructions ?? '',
      faqs: JSON.parse(row.faqsJson ?? '[]'),
      isActive: row.isActive ?? true,
      createdAt: row.createdAt ?? new Date(),
      updatedAt: row.updatedAt ?? new Date(),
    });
  }
}
