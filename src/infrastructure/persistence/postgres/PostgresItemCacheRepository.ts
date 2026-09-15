import { eq } from 'drizzle-orm';
import { DrizzleDB } from '../drizzle/db.js';
import { itemsCache } from '../drizzle/schema.js';
import { IItemCacheRepository } from '../../../application/interfaces/IItemCacheRepository.js';
import { Item } from '../../../domain/entities/Item.js';

export class PostgresItemCacheRepository implements IItemCacheRepository {
  constructor(private readonly db: DrizzleDB) {}

  public async getItem(itemId: string): Promise<Item | null> {
    const [row] = await this.db.select().from(itemsCache).where(eq(itemsCache.itemId, itemId));
    if (!row) return null;
    const payload = JSON.parse(row.payloadJson);
    return new Item({
      id: row.itemId,
      sellerId: row.sellerId ?? undefined,
      title: payload.title,
      price: payload.price,
      currencyId: payload.currency_id,
      availableQuantity: payload.available_quantity,
      condition: payload.condition,
      attributes: payload.attributes || [],
      descriptionText: payload.description_text || '',
      permalink: payload.permalink,
      cachedAt: Number(row.cachedAt),
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
    await this.db.insert(itemsCache).values({
      itemId: item.id,
      sellerId: item.sellerId ?? null,
      payloadJson: JSON.stringify(payload),
      cachedAt: item.cachedAt,
    }).onConflictDoUpdate({
      target: itemsCache.itemId,
      set: {
        sellerId: item.sellerId ?? null,
        payloadJson: JSON.stringify(payload),
        cachedAt: item.cachedAt,
      },
    });
  }
}
