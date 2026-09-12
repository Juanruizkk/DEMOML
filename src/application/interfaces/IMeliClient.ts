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

export interface IMeliClient {
  getQuestion(sellerId: string, questionId: string): Promise<MeliQuestionDTO>;
  getItem(sellerId: string, itemId: string): Promise<Item>;
  postAnswer(sellerId: string, questionId: string, text: string): Promise<void>;
  getReceivedQuestions(sellerId: string): Promise<MeliQuestionDTO[]>;
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
