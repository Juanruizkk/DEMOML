import { EventLog } from "../../domain/entities/EventLog.js";

export interface IEventRepository {
  log(event: EventLog): Promise<void>;
  getRecent(sinceId?: number, limit?: number): Promise<EventLog[]>;
  getRecentBySellerId(sellerId: string, sinceId?: number, limit?: number): Promise<EventLog[]>;
}
