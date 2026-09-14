import { Database as DatabaseType } from "better-sqlite3";
import { IItemKnowledgeRepository } from "../../../application/interfaces/IItemKnowledgeRepository.js";
import { ItemKnowledge, ItemFaq } from "../../../domain/entities/ItemKnowledge.js";

export class SqliteItemKnowledgeRepository implements IItemKnowledgeRepository {
  constructor(private readonly db: DatabaseType) {}

  public async save(knowledge: ItemKnowledge): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO item_knowledge (
        id, seller_id, item_id, custom_instructions, faqs_json, is_active, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(seller_id, item_id) DO UPDATE SET
        custom_instructions = excluded.custom_instructions,
        faqs_json = excluded.faqs_json,
        is_active = excluded.is_active,
        updated_at = CURRENT_TIMESTAMP
    `);

    stmt.run(
      knowledge.id,
      knowledge.sellerId,
      knowledge.itemId,
      knowledge.customInstructions,
      JSON.stringify(knowledge.faqs),
      knowledge.isActive ? 1 : 0
    );
  }

  public async findByItemId(
    sellerId: string,
    itemId: string
  ): Promise<ItemKnowledge | null> {
    const row = this.db
      .prepare(
        "SELECT * FROM item_knowledge WHERE seller_id = ? AND item_id = ?"
      )
      .get(sellerId, itemId) as any;

    if (!row) return null;
    return this.mapToDomain(row);
  }

  public async listBySellerId(sellerId: string): Promise<ItemKnowledge[]> {
    const rows = this.db
      .prepare(
        "SELECT * FROM item_knowledge WHERE seller_id = ? ORDER BY updated_at DESC"
      )
      .all(sellerId) as any[];

    return rows.map((r) => this.mapToDomain(r));
  }

  public async delete(sellerId: string, itemId: string): Promise<void> {
    this.db
      .prepare(
        "DELETE FROM item_knowledge WHERE seller_id = ? AND item_id = ?"
      )
      .run(sellerId, itemId);
  }

  private mapToDomain(row: any): ItemKnowledge {
    let faqs: ItemFaq[] = [];
    try {
      faqs = JSON.parse(row.faqs_json || "[]");
    } catch {
      faqs = [];
    }

    return new ItemKnowledge({
      id: row.id,
      sellerId: row.seller_id,
      itemId: row.item_id,
      customInstructions: row.custom_instructions || "",
      faqs,
      isActive: row.is_active === 1,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    });
  }
}
