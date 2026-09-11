import { Item } from "../../domain/entities/Item.js";

export interface IItemCacheRepository {
  getItem(itemId: string): Promise<Item | null>;
  saveItem(item: Item): Promise<void>;
}
