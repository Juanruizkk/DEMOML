export interface ItemFaq {
  question: string;
  answer: string;
}

export interface ItemKnowledgeProps {
  id: string;
  sellerId: string;
  itemId: string;
  customInstructions?: string;
  faqs?: ItemFaq[];
  isActive?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export class ItemKnowledge {
  public readonly id: string;
  public readonly sellerId: string;
  public readonly itemId: string;
  public customInstructions: string;
  public faqs: ItemFaq[];
  public isActive: boolean;
  public readonly createdAt: Date;
  public updatedAt: Date;

  constructor(props: ItemKnowledgeProps) {
    this.id = props.id;
    this.sellerId = props.sellerId;
    this.itemId = props.itemId;
    this.customInstructions = props.customInstructions || "";
    this.faqs = props.faqs || [];
    this.isActive = props.isActive !== undefined ? props.isActive : true;
    this.createdAt = props.createdAt || new Date();
    this.updatedAt = props.updatedAt || new Date();
  }

  public update(props: {
    customInstructions?: string;
    faqs?: ItemFaq[];
    isActive?: boolean;
  }): void {
    if (props.customInstructions !== undefined) {
      this.customInstructions = props.customInstructions;
    }
    if (props.faqs !== undefined) {
      this.faqs = props.faqs;
    }
    if (props.isActive !== undefined) {
      this.isActive = props.isActive;
    }
    this.updatedAt = new Date();
  }

  public hasContent(): boolean {
    return (
      (this.customInstructions.trim().length > 0 || this.faqs.length > 0) &&
      this.isActive
    );
  }

  public formatPromptContext(): string {
    if (!this.hasContent()) return "";

    const parts: string[] = [];
    if (this.customInstructions.trim().length > 0) {
      parts.push(`- Reglas prioritarias: ${this.customInstructions.trim()}`);
    }

    if (this.faqs.length > 0) {
      parts.push("- Preguntas y Respuestas frecuentes específicas:");
      for (const faq of this.faqs) {
        if (faq.question.trim() && faq.answer.trim()) {
          parts.push(`  * P: ${faq.question.trim()} -> R: ${faq.answer.trim()}`);
        }
      }
    }

    return parts.join("\n");
  }
}
