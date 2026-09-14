import { Item } from "../../domain/entities/Item.js";
import { ItemKnowledge } from "../../domain/entities/ItemKnowledge.js";
import { TenantSettings } from "../../domain/entities/Tenant.js";
import { IntentType } from "../../domain/value-objects/Intent.js";
import { OrderMessageIntent } from "../../domain/entities/OrderMessage.js";

export interface LLMClassificationResult {
  intent: IntentType;
  confidence: number;
  requires_human: boolean;
  reason: string | null;
  answer: string;
}

export interface LLMOrderMessageResult {
  intent: OrderMessageIntent;
  confidence: number;
  requires_human: boolean;
  reason: string | null;
  answer: string;
}

export interface LLMCredentials {
  provider: string;
  apiKey: string;
}

export interface ILLMService {
  classifyAndAnswer(params: {
    questionText: string;
    item: Item;
    settings?: Partial<TenantSettings>;
    itemKnowledge?: ItemKnowledge | null;
    llmCredentials?: LLMCredentials | null;
  }): Promise<LLMClassificationResult>;

  classifyOrderMessage(params: {
    messageText: string;
    itemTitle?: string;
    buyerNickname?: string;
    settings?: Partial<TenantSettings>;
    orderContext?: string;
    llmCredentials?: LLMCredentials | null;
  }): Promise<LLMOrderMessageResult>;

  getProviderLabel(): string;
}
