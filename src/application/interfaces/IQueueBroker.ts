export interface QueueJob {
  questionId: string;
  sellerId: string;
}

export interface IQueueBroker {
  enqueue(job: QueueJob): Promise<void>;
  registerProcessor(handler: (job: QueueJob) => Promise<void>): void;
}
