import { IMeliClient } from "../../application/interfaces/IMeliClient.js";
import { ITenantRepository } from "../../application/interfaces/ITenantRepository.js";
import { IQuestionRepository } from "../../application/interfaces/IQuestionRepository.js";
import { IQueueBroker } from "../../application/interfaces/IQueueBroker.js";
import { IEventRepository } from "../../application/interfaces/IEventRepository.js";
import { EventLog } from "../../domain/entities/EventLog.js";

export class QuestionsPoller {
  private timer: NodeJS.Timeout | null = null;
  private isPolling = false;

  constructor(
    private readonly tenantRepo: ITenantRepository,
    private readonly questionRepo: IQuestionRepository,
    private readonly meliClient: IMeliClient,
    private readonly queueBroker: IQueueBroker,
    private readonly eventRepo: IEventRepository,
    private readonly intervalMs: number = 15_000
  ) {}

  public start(): void {
    if (this.timer) return;

    // Ejecución inicial a los 2 segundos
    setTimeout(() => {
      this.poll().catch((err) => {
        console.error("[QuestionsPoller] Error en polling inicial:", err);
      });
    }, 2000);

    this.timer = setInterval(() => {
      this.poll().catch((err) => {
        console.error("[QuestionsPoller] Error en ciclo de polling:", err);
      });
    }, this.intervalMs);

    console.log(`⏱️ [QuestionsPoller] Poller de respaldo activo (cada ${this.intervalMs / 1000}s)`);
  }

  public stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  public async poll(): Promise<void> {
    if (this.isPolling) return;
    this.isPolling = true;

    try {
      const tenants = await this.tenantRepo.getAll();
      for (const tenant of tenants) {
        if (!tenant.sellerId || !tenant.accessToken) continue;

        try {
          const questions = await this.meliClient.getReceivedQuestions(tenant.sellerId);
          for (const q of questions) {
            if (q.status !== "UNANSWERED") continue;

            const qIdStr = String(q.id);
            const existing = await this.questionRepo.findById(qIdStr);
            if (existing && existing.isAlreadyFinalized()) continue;
            if (existing && existing.appStatus === "processing") continue;
            if (existing && existing.appStatus === "pending_review") continue;

            await this.eventRepo.log(
              new EventLog({
                sellerId: tenant.sellerId,
                questionId: qIdStr,
                type: "poller_question_detected",
                message: `🔍 [Poller] Nueva pregunta sin responder detectada en Mercado Libre: "${q.text}" (ID: ${qIdStr})`,
              })
            );

            await this.queueBroker.enqueue({
              questionId: qIdStr,
              sellerId: tenant.sellerId,
            });
          }
        } catch (err: any) {
          // Errores individuales de tenant (por ejemplo token no autorizado todavía) no detienen el loop
        }
      }
    } finally {
      this.isPolling = false;
    }
  }
}
