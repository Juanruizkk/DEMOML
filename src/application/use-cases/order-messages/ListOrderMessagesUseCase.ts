import { IOrderMessageRepository, OrderMessageFilters } from "../../interfaces/IOrderMessageRepository.js";
import { OrderMessage } from "../../../domain/entities/OrderMessage.js";

export interface ListOrderMessagesResult {
  messages: OrderMessage[];
  pendingCount: number;
}

export class ListOrderMessagesUseCase {
  constructor(private readonly orderMessageRepo: IOrderMessageRepository) {}

  public async execute(sellerId: string, filters: OrderMessageFilters = {}): Promise<ListOrderMessagesResult> {
    const [messages, pendingCount] = await Promise.all([
      this.orderMessageRepo.listBySeller(sellerId, filters),
      this.orderMessageRepo.countPending(sellerId),
    ]);

    return {
      messages,
      pendingCount,
    };
  }
}
