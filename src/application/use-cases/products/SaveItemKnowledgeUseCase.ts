import crypto from "node:crypto";
import { IItemKnowledgeRepository } from "../../interfaces/IItemKnowledgeRepository.js";
import { ItemKnowledge, ItemFaq } from "../../../domain/entities/ItemKnowledge.js";

export interface SaveItemKnowledgeInput {
  sellerId: string;
  itemId: string;
  customInstructions?: string;
  faqs?: ItemFaq[];
  isActive?: boolean;
}

export class SaveItemKnowledgeUseCase {
  constructor(private readonly itemKnowledgeRepo: IItemKnowledgeRepository) {}

  public async execute(input: SaveItemKnowledgeInput): Promise<ItemKnowledge> {
    if (!input.sellerId || !input.itemId) {
      throw new Error("sellerId and itemId are required");
    }

    const cleanFaqs = (input.faqs || []).filter(
      (f) => f && f.question && f.question.trim().length > 0
    );

    let knowledge = await this.itemKnowledgeRepo.findByItemId(
      input.sellerId,
      input.itemId
    );

    if (!knowledge) {
      knowledge = new ItemKnowledge({
        id: crypto.randomUUID(),
        sellerId: input.sellerId,
        itemId: input.itemId,
        customInstructions: input.customInstructions || "",
        faqs: cleanFaqs,
        isActive: input.isActive !== undefined ? input.isActive : true,
      });
    } else {
      knowledge.update({
        customInstructions: input.customInstructions,
        faqs: cleanFaqs,
        isActive: input.isActive,
      });
    }

    await this.itemKnowledgeRepo.save(knowledge);
    return knowledge;
  }
}
