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

export interface IMeliClient {
  getQuestion(sellerId: string, questionId: string): Promise<MeliQuestionDTO>;
  getItem(sellerId: string, itemId: string): Promise<Item>;
  postAnswer(sellerId: string, questionId: string, text: string): Promise<void>;
  getReceivedQuestions(sellerId: string): Promise<MeliQuestionDTO[]>;
  getClaim(sellerId: string, claimId: string): Promise<MeliClaimDTO>;
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
