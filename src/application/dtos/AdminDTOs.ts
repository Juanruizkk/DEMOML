import { IntentType } from "../../domain/value-objects/Intent.js";

export interface GlobalMetricsDTO {
  totalQuestions: number;
  autoAnsweredCount: number;
  approvedCount: number;
  pendingReviewCount: number;
  rejectedCount: number;
  errorCount: number;
  autoAnswerRatePercent: number; // e.g. 78.5%
  averageLatencyMs: number;
  totalActiveTenants: number;
  intentDistribution: Record<IntentType | "otro", number>;
}

export type TokenHealthStatus = "healthy" | "expiring_soon" | "expired";

export interface TenantOverviewDTO {
  sellerId: string;
  nickname?: string;
  email?: string;
  tokenHealth: TokenHealthStatus;
  expiresInMinutes: number;
  autoAnswerEnabled: boolean;
  confidenceThreshold: number;
  tone: string;
  totalQuestions: number;
  autoAnsweredQuestions: number;
  createdAt: string;
  updatedAt: string;
}

export interface TenantDetailDTO {
  tenant: TenantOverviewDTO;
  settings: {
    autoAnswerEnabled: boolean;
    confidenceThreshold: number;
    tone: string;
    customInstructions?: string;
    whatsappAlertPhone?: string;
  };
  recentQuestions: Array<{
    id: string;
    text: string;
    intent?: string;
    confidence?: number;
    appStatus: string;
    receivedAt: string;
  }>;
  recentEvents: Array<{
    id?: number;
    type: string;
    message: string;
    createdAt: string;
  }>;
}
