import { IMeliClient } from "../../interfaces/IMeliClient.js";
import { IItemKnowledgeRepository } from "../../interfaces/IItemKnowledgeRepository.js";
import { ItemKnowledge } from "../../../domain/entities/ItemKnowledge.js";

export interface SellerProductDTO {
  id: string;
  title: string;
  price: number;
  currencyId: string;
  availableQuantity: number;
  condition: string;
  permalink?: string;
  hasCustomKnowledge: boolean;
  knowledge?: {
    customInstructions: string;
    faqsCount: number;
    isActive: boolean;
    updatedAt: string;
  };
}

export class GetSellerProductsUseCase {
  constructor(
    private readonly meliClient: IMeliClient,
    private readonly itemKnowledgeRepo: IItemKnowledgeRepository
  ) {}

  public async execute(
    sellerId: string,
    status: string = "active"
  ): Promise<SellerProductDTO[]> {
    if (!sellerId) {
      throw new Error("sellerId is required");
    }

    const [itemIds, customKnowledgeList] = await Promise.all([
      this.meliClient.getSellerItemIds(sellerId, status).catch(() => []),
      this.itemKnowledgeRepo.listBySellerId(sellerId).catch(() => []),
    ]);

    const knowledgeMap = new Map<string, ItemKnowledge>();
    for (const k of customKnowledgeList) {
      knowledgeMap.set(k.itemId, k);
    }

    const items = await Promise.all(
      itemIds.map(async (itemId) => {
        try {
          const item = await this.meliClient.getItem(sellerId, itemId);
          const k = knowledgeMap.get(itemId);
          return {
            id: item.id,
            title: item.title,
            price: item.price,
            currencyId: item.currencyId,
            availableQuantity: item.availableQuantity,
            condition: item.condition,
            permalink: item.permalink,
            hasCustomKnowledge: k ? k.hasContent() : false,
            knowledge: k
              ? {
                  customInstructions: k.customInstructions,
                  faqsCount: k.faqs.length,
                  isActive: k.isActive,
                  updatedAt: k.updatedAt.toISOString(),
                }
              : undefined,
          };
        } catch {
          return null;
        }
      })
    );

    return items.filter((item): item is SellerProductDTO => item !== null);
  }
}
