import { OrderMessage, OrderMessageIntent, OrderMessageStatus } from "../../domain/entities/OrderMessage.js";

export interface OrderMessageFilters {
  sellerId?: string;
  status?: OrderMessageStatus | string;
  intent?: OrderMessageIntent | string;
  search?: string;
  packId?: string;
  limit?: number;
  offset?: number;
}

export interface IOrderMessageRepository {
  findById(id: string): Promise<OrderMessage | null>;
  findByPackId(packId: string): Promise<OrderMessage[]>;
  save(orderMessage: OrderMessage): Promise<void>;
  list(filters: OrderMessageFilters): Promise<{ data: OrderMessage[]; total: number }>;
  listBySeller(sellerId: string, filters?: OrderMessageFilters): Promise<OrderMessage[]>;
  countPending(sellerId: string): Promise<number>;
}

