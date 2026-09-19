export interface SendQuestionAlertParams {
  to: string;
  sellerId: string;
  questionId: string;
  itemTitle: string;
  itemPrice?: number;
  questionText: string;
  suggestedAnswer?: string;
  reason: string;
  portalUrl?: string;
}

export interface SendClaimAlertParams {
  to: string;
  sellerId: string;
  claimId: string;
  orderId?: string;
  reason: string;
  remainingHours: number;
  urgency: "low" | "medium" | "high" | "critical";
  portalUrl?: string;
}

export interface SendTestEmailParams {
  to: string;
  tenantName?: string;
}

export interface SendTenantInvitationParams {
  to: string;
  name: string;
  activationUrl: string;
  temporaryToken?: string;
}

export interface SendPasswordResetParams {
  to: string;
  name?: string;
  resetUrl: string;
  expiresInMinutes?: number;
}

export interface SendNewLeadAlertParams {
  to: string;
  lead: {
    name: string;
    email: string;
    phone: string;
    mlStore: string;
    weeklyQuestions: string;
  };
}

export interface EmailSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface IEmailClient {
  sendQuestionReviewAlert(params: SendQuestionAlertParams): Promise<EmailSendResult>;
  sendClaimSlaAlert(params: SendClaimAlertParams): Promise<EmailSendResult>;
  sendTestEmail(params: SendTestEmailParams): Promise<EmailSendResult>;
  sendTenantInvitation(params: SendTenantInvitationParams): Promise<EmailSendResult>;
  sendPasswordReset(params: SendPasswordResetParams): Promise<EmailSendResult>;
  sendNewLeadAlert(params: SendNewLeadAlertParams): Promise<EmailSendResult>;
}
