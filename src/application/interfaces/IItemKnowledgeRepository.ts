import { ItemKnowledge } from "../../domain/entities/ItemKnowledge.js";

export interface IItemKnowledgeRepository {
  findByItemId(sellerId: string, itemId: string): Promise<ItemKnowledge | null>;
  listBySellerId(sellerId: string): Promise<ItemKnowledge[]>;
  save(knowledge: ItemKnowledge): Promise<void>;
  delete(sellerId: string, itemId: string): Promise<void>;
}
