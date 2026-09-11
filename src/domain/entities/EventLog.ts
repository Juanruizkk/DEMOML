export interface EventLogProps {
  id?: number;
  sellerId?: string;
  questionId?: string;
  type: string;
  message: string;
  durationMs?: number;
  createdAt?: Date;
}

export class EventLog {
  public readonly id?: number;
  public readonly sellerId?: string;
  public readonly questionId?: string;
  public readonly type: string;
  public readonly message: string;
  public readonly durationMs?: number;
  public readonly createdAt: Date;

  constructor(props: EventLogProps) {
    this.id = props.id;
    this.sellerId = props.sellerId;
    this.questionId = props.questionId;
    this.type = props.type;
    this.message = props.message;
    this.durationMs = props.durationMs;
    this.createdAt = props.createdAt || new Date();
  }
}
