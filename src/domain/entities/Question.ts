import { IntentType } from "../value-objects/Intent.js";

export type QuestionAppStatus =
  | "pending_review"
  | "auto_answered"
  | "approved"
  | "rejected"
  | "processing"
  | "skipped_already_answered"
  | "error";

export interface QuestionProps {
  id: string; // question_id from Mercado Libre
  sellerId: string;
  itemId: string;
  buyerId?: string;
  text: string;
  mlStatus?: string; // UNANSWERED, ANSWERED, etc.
  intent?: IntentType;
  confidence?: number;
  requiresHuman?: boolean;
  reason?: string | null;
  suggestedAnswer?: string;
  finalAnswer?: string;
  appStatus: QuestionAppStatus;
  receivedAt?: Date;
  answeredAt?: Date | null;
  latencyMs?: number | null;
  mlError?: string | null;
}

export class Question {
  public readonly id: string;
  public readonly sellerId: string;
  public itemId: string;
  public buyerId?: string;
  public text: string;
  public mlStatus?: string;
  public intent?: IntentType;
  public confidence?: number;
  public requiresHuman: boolean;
  public reason?: string | null;
  public suggestedAnswer?: string;
  public finalAnswer?: string;
  public appStatus: QuestionAppStatus;
  public readonly receivedAt: Date;
  public answeredAt?: Date | null;
  public latencyMs?: number | null;
  public mlError?: string | null;

  constructor(props: QuestionProps) {
    this.id = props.id;
    this.sellerId = props.sellerId;
    this.itemId = props.itemId;
    this.buyerId = props.buyerId;
    this.text = props.text;
    this.mlStatus = props.mlStatus;
    this.intent = props.intent;
    this.confidence = props.confidence;
    this.requiresHuman = props.requiresHuman ?? false;
    this.reason = props.reason ?? null;
    this.suggestedAnswer = props.suggestedAnswer;
    this.finalAnswer = props.finalAnswer;
    this.appStatus = props.appStatus;
    this.receivedAt = props.receivedAt || new Date();
    this.answeredAt = props.answeredAt || null;
    this.latencyMs = props.latencyMs || null;
    this.mlError = props.mlError || null;
  }

  public isAlreadyFinalized(): boolean {
    return ["auto_answered", "approved", "rejected", "skipped_already_answered"].includes(this.appStatus);
  }

  public markAsAutoAnswered(answer: string, latencyMs: number): void {
    this.appStatus = "auto_answered";
    this.finalAnswer = answer;
    this.answeredAt = new Date();
    this.latencyMs = latencyMs;
  }

  public markAsApproved(answer: string, latencyMs: number): void {
    this.appStatus = "approved";
    this.finalAnswer = answer;
    this.answeredAt = new Date();
    this.latencyMs = latencyMs;
  }

  public markAsRejected(): void {
    this.appStatus = "rejected";
  }

  public markAsPendingReview(reason: string): void {
    this.appStatus = "pending_review";
    this.requiresHuman = true;
    this.reason = reason;
  }

  public markAsError(errorMessage: string): void {
    this.appStatus = "error";
    this.mlError = errorMessage;
  }
}
