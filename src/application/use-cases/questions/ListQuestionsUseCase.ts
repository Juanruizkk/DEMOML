import { IQuestionRepository } from "../../interfaces/IQuestionRepository.js";
import { IItemCacheRepository } from "../../interfaces/IItemCacheRepository.js";

export interface GroupedQuestions {
  pending_review: any[];
  auto_answered: any[];
  other: any[];
}

export interface ListQuestionsResult {
  questions: any[];
  grouped: GroupedQuestions;
}

export class ListQuestionsUseCase {
  constructor(
    private readonly questionRepo: IQuestionRepository,
    private readonly itemCacheRepo?: IItemCacheRepository
  ) {}

  public async execute(params: {
    sellerId?: string;
    status?: string;
    itemId?: string;
  }): Promise<ListQuestionsResult> {
    const { sellerId, status, itemId } = params;

    let questions = sellerId
      ? await this.questionRepo.findBySellerId(sellerId, 500)
      : await this.questionRepo.findByStatus("pending_review", 500);

    if (itemId) {
      questions = questions.filter((q) => q.itemId === itemId);
    }
    if (status && status !== "all") {
      questions = questions.filter((q) => q.appStatus === status);
    }

    // Enriquecer con títulos de ítems desde el cache
    const itemTitles = new Map<string, string>();
    if (this.itemCacheRepo) {
      const itemIds = Array.from(new Set(questions.map((q) => q.itemId).filter(Boolean)));
      await Promise.all(
        itemIds.map(async (id) => {
          try {
            const item = await this.itemCacheRepo!.getItem(id);
            if (item) itemTitles.set(id, item.title);
          } catch {}
        })
      );
    }

    const formatQuestion = (q: any) => ({
      ...q,
      itemTitle: itemTitles.get(q.itemId) || q.itemTitle || (q.itemId ? `Producto ${q.itemId.slice(-4)}` : undefined),
    });

    const formattedAll = questions.map(formatQuestion);

    const grouped: GroupedQuestions = {
      pending_review: [],
      auto_answered: [],
      other: [],
    };

    for (const q of formattedAll) {
      if (q.appStatus === "pending_review") {
        grouped.pending_review.push(q);
      } else if (q.appStatus === "auto_answered" || q.appStatus === "approved") {
        grouped.auto_answered.push(q);
      } else {
        grouped.other.push(q);
      }
    }

    return { questions: formattedAll, grouped };
  }
}
