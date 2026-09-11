import { Question, QuestionAppStatus } from "../../domain/entities/Question.js";

export interface QuestionCountsByStatus {
  total: number;
  auto_answered: number;
  approved: number;
  pending_review: number;
  rejected: number;
  error: number;
}

export interface IQuestionRepository {
  findById(id: string): Promise<Question | null>;
  save(question: Question): Promise<void>;
  findBySellerId(sellerId: string, limit?: number): Promise<Question[]>;
  findByStatus(status: QuestionAppStatus, limit?: number): Promise<Question[]>;
  getCountsByStatus(): Promise<QuestionCountsByStatus>;
  getAverageLatency(): Promise<number>;
  getIntentDistribution(): Promise<Record<string, number>>;
  getStatsBySellerId(sellerId: string): Promise<{ total: number; autoAnswered: number }>;
}
