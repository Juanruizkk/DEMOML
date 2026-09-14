import { Item } from "../../domain/entities/Item.js";
import { ItemKnowledge } from "../../domain/entities/ItemKnowledge.js";
import { TenantSettings } from "../../domain/entities/Tenant.js";
import { IntentType } from "../../domain/value-objects/Intent.js";

export interface LLMClassificationResult {
  intent: IntentType;
  confidence: number;
  requires_human: boolean;
  reason: string | null;
  answer: string;
}

export interface ILLMService {
  classifyAndAnswer(params: {
    questionText: string;
    item: Item;
    settings?: Partial<TenantSettings>;
    itemKnowledge?: ItemKnowledge | null;
  }): Promise<LLMClassificationResult>;
  getProviderLabel(): string;
}
