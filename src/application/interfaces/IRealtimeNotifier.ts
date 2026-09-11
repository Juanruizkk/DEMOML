export interface IRealtimeNotifier {
  broadcast(event: string, data: unknown): void;
  broadcastToSeller(sellerId: string, event: string, data: unknown): void;
}
