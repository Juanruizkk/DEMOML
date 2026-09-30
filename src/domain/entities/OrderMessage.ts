export type OrderMessageStatus = "unread" | "pending_review" | "auto_answered" | "replied" | "error";

export type OrderMessageIntent =
  | "facturacion"
  | "envio_seguimiento"
  | "garantia_consulta"
  | "soporte_tecnico"
  | "reclamo_potencial"
  | "agradecimiento"
  | "otro";

export interface OrderMessageProps {
  id: string;
  sellerId: string;
  packId: string;
  orderId?: string;
  buyerId: string;
  buyerNickname?: string;
  itemId?: string;
  itemTitle?: string;
  messageText: string;
  senderRole: "buyer" | "seller";
  intent?: OrderMessageIntent;
  confidence?: number;
  aiConfidence?: number;
  requiresHuman?: boolean;
  reason?: string | null;
  suggestedAnswer?: string;
  finalAnswer?: string;
  sellerAnswer?: string;
  status: OrderMessageStatus;
  createdAt?: Date;
  repliedAt?: Date | null;
  answeredAt?: Date | null;
  latencyMs?: number | null;
  mlError?: string | null;
}

export class OrderMessage {
  public readonly id: string;
  public readonly sellerId: string;
  public readonly packId: string;
  public orderId?: string;
  public readonly buyerId: string;
  public buyerNickname?: string;
  public itemId?: string;
  public itemTitle?: string;
  public messageText: string;
  public senderRole: "buyer" | "seller";
  public intent?: OrderMessageIntent;
  public confidence?: number;
  public requiresHuman: boolean;
  public reason?: string | null;
  public suggestedAnswer?: string;
  public finalAnswer?: string;
  public status: OrderMessageStatus;
  public readonly createdAt: Date;
  public repliedAt?: Date | null;
  public latencyMs?: number | null;
  public mlError?: string | null;

  constructor(props: OrderMessageProps) {
    this.id = props.id;
    this.sellerId = props.sellerId;
    this.packId = props.packId;
    this.orderId = props.orderId;
    this.buyerId = props.buyerId;
    this.buyerNickname = props.buyerNickname;
    this.itemId = props.itemId;
    this.itemTitle = props.itemTitle;
    this.messageText = props.messageText;
    this.senderRole = props.senderRole;
    this.intent = props.intent;
    this.confidence = props.confidence ?? props.aiConfidence;
    this.requiresHuman = props.requiresHuman ?? false;
    this.reason = props.reason ?? null;
    this.suggestedAnswer = props.suggestedAnswer;
    this.finalAnswer = props.finalAnswer ?? props.sellerAnswer;
    this.status = props.status;
    this.createdAt = props.createdAt || new Date();
    this.repliedAt = props.repliedAt || props.answeredAt || null;
    this.latencyMs = props.latencyMs || null;
    this.mlError = props.mlError || null;
  }

  get aiConfidence(): number | undefined {
    return this.confidence;
  }

  get sellerAnswer(): string | undefined {
    return this.finalAnswer;
  }

  get answeredAt(): Date | null | undefined {
    return this.repliedAt;
  }

  public reply(answer: string): void {
    this.markAsReplied(answer);
  }

  public isFinalized(): boolean {
    return this.status === "auto_answered" || this.status === "replied";
  }

  public markAsAutoAnswered(answer: string, latencyMs?: number): void {
    this.status = "auto_answered";
    this.finalAnswer = answer;
    this.repliedAt = new Date();
    if (latencyMs) this.latencyMs = latencyMs;
  }

  public markAsReplied(answer: string, latencyMs?: number): void {
    this.status = "replied";
    this.finalAnswer = answer;
    this.repliedAt = new Date();
    if (latencyMs) this.latencyMs = latencyMs;
  }

  public markAsPendingReview(reason: string): void {
    this.status = "pending_review";
    this.requiresHuman = true;
    this.reason = reason;
  }

  public markAsError(errorMsg: string): void {
    this.status = "error";
    this.mlError = errorMsg;
  }
}

