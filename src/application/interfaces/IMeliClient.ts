import { Item } from "../../domain/entities/Item.js";

export interface MeliQuestionDTO {
  id: number;
  seller_id: number;
  item_id: string;
  from: { id: number };
  text: string;
  status: "UNANSWERED" | "ANSWERED" | "CLOSED_UNANSWERED" | "UNDER_REVIEW";
  date_created: string;
}

export interface MeliClaimPlayerAction {
  action: string;
  due_date: string | null;
  mandatory: boolean;
}

export interface MeliClaimPlayer {
  role: "complainant" | "respondent" | "mediator";
  type: "buyer" | "seller" | "internal";
  user_id: number;
  available_actions: MeliClaimPlayerAction[];
}

export interface MeliClaimMessageDTO {
  sender_role: "complainant" | "respondent" | "mediator" | string;
  receiver_role?: string;
  message: string;
  date_created: string;
  stage?: string;
}

export interface MeliClaimDTO {
  id: number;
  resource_id: number;
  status: "opened" | "closed";
  type: string;
  stage: "claim" | "dispute" | "closed";
  reason_id: string;
  players: MeliClaimPlayer[];
  date_created: string;
  last_updated: string;
}

export interface MeliOrderDTO {
  id: number;
  date_created: string;
  status: string;
  pack_id?: number | null;
  buyer: {
    id: number;
    nickname: string;
    email?: string;
    first_name?: string;
    last_name?: string;
  };
  order_items: Array<{
    item: {
      id: string;
      title: string;
    };
    quantity: number;
    unit_price: number;
  }>;
  shipping?: {
    id: number;
    status?: string;
    substatus?: string;
  };
}

export interface MeliPackMessageDTO {
  id: string;
  from: {
    user_id: number | string;
    email?: string;
    name?: string;
  };
  to: Array<{
    user_id: number | string;
    email?: string;
    name?: string;
  }>;
  text: string;
  message_date: {
    created: string;
    read?: string | null;
  };
}

export interface IMeliClient {
  getQuestion(sellerId: string, questionId: string): Promise<MeliQuestionDTO>;
  getItem(sellerId: string, itemId: string): Promise<Item>;
  getSellerItemIds(sellerId: string, status?: string): Promise<string[]>;
  postAnswer(sellerId: string, questionId: string, text: string): Promise<void>;
  getReceivedQuestions(sellerId: string): Promise<MeliQuestionDTO[]>;
  getClaim(sellerId: string, claimId: string): Promise<MeliClaimDTO>;
  getClaimMessages(sellerId: string, claimId: string): Promise<MeliClaimMessageDTO[]>;
  searchClaims(sellerId: string, status?: string): Promise<MeliClaimDTO[]>;
  getOrder(sellerId: string, orderId: string): Promise<MeliOrderDTO>;
  getOrderMessages(sellerId: string, packId: string): Promise<MeliPackMessageDTO[]>;
  postOrderMessage(sellerId: string, packId: string, buyerId: string, text: string): Promise<void>;
  getSellerProfile(sellerId: string, accessToken?: string): Promise<{
    id: number;
    nickname: string;
    email?: string;
    permalink?: string;
  }>;
  exchangeCodeForTokens(code: string): Promise<{
    access_token: string;
    refresh_token: string;
    expires_in: number;
    user_id: number;
  }>;
  refreshTokens(refreshToken: string): Promise<{
    access_token: string;
    refresh_token: string;
    expires_in: number;
    user_id: number;
  }>;
}
