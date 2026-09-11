import { Database as DatabaseType } from "better-sqlite3";
import { IItemCacheRepository } from "../../../application/interfaces/IItemCacheRepository.js";
import { Item } from "../../../domain/entities/Item.js";

export class SqliteItemCacheRepository implements IItemCacheRepository {
  constructor(private readonly db: DatabaseType) {}

  public async getItem(itemId: string): Promise<Item | null> {
    const row = this.db.prepare("SELECT * FROM items_cache WHERE item_id = ?").get(itemId) as any;
    if (!row) return null;
    const payload = JSON.parse(row.payload_json);
    return new Item({
      id: row.item_id,
      sellerId: row.seller_id || undefined,
      title: payload.title,
      price: payload.price,
      currencyId: payload.currency_id,
      availableQuantity: payload.available_quantity,
      condition: payload.condition,
      attributes: payload.attributes || [],
      descriptionText: payload.description_text || "",
      permalink: payload.permalink,
      cachedAt: row.cached_at,
    });
  }

  public async saveItem(item: Item): Promise<void> {
    const payload = {
      title: item.title,
      price: item.price,
      currency_id: item.currencyId,
      available_quantity: item.availableQuantity,
      condition: item.condition,
      attributes: item.attributes,
      description_text: item.descriptionText,
      permalink: item.permalink,
    };

    const stmt = this.db.prepare(`
      INSERT INTO items_cache (item_id, seller_id, payload_json, cached_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(item_id) DO UPDATE SET
        seller_id = excluded.seller_id,
        payload_json = excluded.payload_json,
        cached_at = excluded.cached_at
    `);

    stmt.run(item.id, item.sellerId || null, JSON.stringify(payload), item.cachedAt);
  }
}
