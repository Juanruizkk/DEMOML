import { IQueueBroker, QueueJob } from "../../application/interfaces/IQueueBroker.js";

export class InMemoryQueueBroker implements IQueueBroker {
  private queue: QueueJob[] = [];
  private inFlight: Set<string> = new Set();
  private handler: ((job: QueueJob) => Promise<void>) | null = null;
  private activeWorkers = 0;
  private maxConcurrency: number;

  constructor(maxConcurrency: number = 5) {
    this.maxConcurrency = maxConcurrency;
  }

  public async enqueue(job: QueueJob): Promise<void> {
    const jobKey = `${job.sellerId}:${job.questionId}`;
    if (this.inFlight.has(jobKey)) {
      return;
    }

    this.queue.push(job);
    this.inFlight.add(jobKey);
    this.drain();
  }

  public registerProcessor(handler: (job: QueueJob) => Promise<void>): void {
    this.handler = handler;
  }

  private drain(): void {
    if (!this.handler) return;

    while (this.activeWorkers < this.maxConcurrency && this.queue.length > 0) {
      const job = this.queue.shift();
      if (!job) break;

      this.activeWorkers++;
      const jobKey = `${job.sellerId}:${job.questionId}`;

      this.handler(job)
        .catch((err) => {
          console.error(`[QueueBroker] Error procesando job ${jobKey}:`, err);
        })
        .finally(() => {
          this.activeWorkers--;
          this.inFlight.delete(jobKey);
          this.drain();
        });
    }
  }
}
