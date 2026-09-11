import { FastifyReply } from "fastify";
import { IRealtimeNotifier } from "../../application/interfaces/IRealtimeNotifier.js";

interface SseClient {
  id: number;
  sellerId?: string;
  reply: FastifyReply;
}

export class FastifySseNotifier implements IRealtimeNotifier {
  private clients: Map<number, SseClient> = new Map();
  private clientIdCounter = 1;

  public registerClient(reply: FastifyReply, sellerId?: string): () => void {
    const id = this.clientIdCounter++;

    // Configurar headers SSE nativos
    reply.raw.setHeader("Content-Type", "text/event-stream");
    reply.raw.setHeader("Cache-Control", "no-cache");
    reply.raw.setHeader("Connection", "keep-alive");
    reply.raw.setHeader("Access-Control-Allow-Origin", "*");
    reply.raw.flushHeaders();

    // Heartbeat inicial
    reply.raw.write(`event: ping\ndata: ${JSON.stringify({ time: Date.now() })}\n\n`);

    const client: SseClient = { id, sellerId, reply };
    this.clients.set(id, client);

    const cleanup = () => {
      this.clients.delete(id);
    };

    reply.raw.on("close", cleanup);
    return cleanup;
  }

  public broadcast(event: string, data: unknown): void {
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const client of this.clients.values()) {
      try {
        client.reply.raw.write(payload);
      } catch (err) {
        this.clients.delete(client.id);
      }
    }
  }

  public broadcastToSeller(sellerId: string, event: string, data: unknown): void {
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const client of this.clients.values()) {
      if (!client.sellerId || client.sellerId === sellerId || client.sellerId === "all") {
        try {
          client.reply.raw.write(payload);
        } catch (err) {
          this.clients.delete(client.id);
        }
      }
    }
  }
}
