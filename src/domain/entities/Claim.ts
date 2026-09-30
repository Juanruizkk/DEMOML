export type ClaimType = "med_pnr" | "med_pdd" | "return" | "cancel_purchase" | "other";
export type ClaimStage = "claim" | "dispute" | "closed";
export type ClaimStatus = "opened" | "closed";
export type ClaimUrgency = "critical" | "high" | "normal";

export interface ClaimAction {
  action: string;
  dueDate: Date | null;
  mandatory: boolean;
}

export interface ClaimProps {
  id: string;
  sellerId: string;
  orderId: string;
  type: ClaimType;
  stage: ClaimStage;
  status: ClaimStatus;
  reason: string;
  reasonDetail?: string;
  buyerId?: string;
  buyerNickname?: string;
  itemId?: string;
  itemTitle?: string;
  itemPrice?: number;
  itemQuantity?: number;
  complainantMessage?: string;
  actions: ClaimAction[];
  dueDate: Date;
  notifiedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export class Claim {
  public readonly id: string;
  public readonly sellerId: string;
  public readonly orderId: string;
  public readonly type: ClaimType;
  public stage: ClaimStage;
  public status: ClaimStatus;
  public readonly reason: string;
  public readonly reasonDetail?: string;
  public readonly buyerId?: string;
  public readonly buyerNickname?: string;
  public readonly itemId?: string;
  public readonly itemTitle?: string;
  public readonly itemPrice?: number;
  public readonly itemQuantity?: number;
  public readonly complainantMessage?: string;
  public actions: ClaimAction[];
  public dueDate: Date;
  public notifiedAt?: Date;
  public readonly createdAt: Date;
  public updatedAt: Date;

  constructor(props: ClaimProps) {
    this.id = props.id;
    this.sellerId = props.sellerId;
    this.orderId = props.orderId;
    this.type = props.type;
    this.stage = props.stage;
    this.status = props.status;
    this.reason = props.reason;
    this.reasonDetail = props.reasonDetail;
    this.buyerId = props.buyerId;
    this.buyerNickname = props.buyerNickname;
    this.itemId = props.itemId;
    this.itemTitle = props.itemTitle;
    this.itemPrice = props.itemPrice;
    this.itemQuantity = props.itemQuantity;
    this.complainantMessage = props.complainantMessage;
    this.actions = props.actions;
    this.dueDate = props.dueDate;
    this.notifiedAt = props.notifiedAt;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  public getUrgency(now: Date = new Date()): ClaimUrgency {
    const hours = this.getRemainingHours(now);
    if (hours <= 12) return "critical";
    if (hours <= 24) return "high";
    return "normal";
  }

  public getRemainingHours(now: Date = new Date()): number {
    return Math.max(0, Math.round((this.dueDate.getTime() - now.getTime()) / (1000 * 60 * 60)));
  }

  public markNotified(): void {
    this.notifiedAt = new Date();
    this.updatedAt = new Date();
  }

  public resetNotified(): void {
    this.notifiedAt = undefined;
    this.updatedAt = new Date();
  }

  public close(): void {
    this.status = "closed";
    this.stage = "closed";
    this.updatedAt = new Date();
  }

  public reopen(): void {
    this.status = "opened";
    this.stage = "claim";
    this.updatedAt = new Date();
  }
}

