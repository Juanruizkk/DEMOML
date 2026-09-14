import { Tenant } from "../../domain/entities/Tenant.js";

export interface ITenantRepository {
  findById(id: string): Promise<Tenant | null>;
  findBySellerId(sellerId: string): Promise<Tenant | null>;
  findByTelegramChatId(chatId: string): Promise<Tenant | null>;
  save(tenant: Tenant): Promise<void>;
  getAll(): Promise<Tenant[]>;
}
