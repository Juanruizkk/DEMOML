export type WhatsAppMode = "platform_shared" | "custom_byo";

export interface PlanFeatures {
  llmResponsesPerMonth: number;
  claimsEnabled: boolean;
  whatsappEnabled: boolean;
}

export const PLAN_LIMITS: Record<string, PlanFeatures> = {
  starter:    { llmResponsesPerMonth: 300,      claimsEnabled: false, whatsappEnabled: false },
  pro:        { llmResponsesPerMonth: 1_000,    claimsEnabled: true,  whatsappEnabled: false },
  business:   { llmResponsesPerMonth: 5_000,    claimsEnabled: true,  whatsappEnabled: true  },
  enterprise: { llmResponsesPerMonth: 999_999_999, claimsEnabled: true,  whatsappEnabled: true  },
};

const QUOTA_GRACE_PERIOD_MS = 12 * 60 * 60 * 1000;

export type AutomationMode = "always_auto" | "smart_hybrid" | "always_manual" | "schedule";

export interface TenantPermissions {
  whatsappEnabled: boolean;
  telegramEnabled: boolean;
  emailEnabled: boolean;
  preSaleEnabled: boolean;
  postSaleEnabled: boolean;
  multiUserEnabled?: boolean;
}

export interface WebNotificationsSettings {
  enabled: boolean;
  scope: "all" | "questions_only" | "claims_only";
  soundEnabled: boolean;
  desktopPushEnabled: boolean;
}

export interface ScheduleSettings {
  enabled: boolean;
  timezone: string;
  workDays: number[]; // 0=Dom, 1=Lun, ..., 6=Sab
  workStartHour: string; // "09:00"
  workEndHour: string;   // "18:00"
  daytimeMode: "smart_hybrid" | "always_manual";
  nighttimeMode: "always_auto" | "smart_hybrid";
}

export interface StorePolicies {
  billingPolicy?: string;
  shippingPolicy?: string;
  warrantyPolicy?: string;
  greeting?: string;
  signature?: string;
}

export interface TenantSettings {
  // Automation
  automationMode: AutomationMode;
  autoAnswerEnabled: boolean; // backward compat
  confidenceThreshold: number;

  // Schedule / guardia nocturna
  schedule?: ScheduleSettings;

  // Tone, style & policies
  tone: "casual_rioplatense" | "formal" | "concise" | "sales_oriented";
  policies?: StorePolicies;
  customInstructions?: string;

  // WhatsApp
  whatsappAlertPhone?: string;
  whatsappMode: WhatsAppMode;
  customPhoneNumberId?: string;
  customAccessToken?: string;
  customWabaId?: string;

  // LLM (Bring Your Own Key)
  llmProvider?: "groq" | "openai" | "anthropic";
  llmApiKey?: string;

  // Multi-channel alerts
  preferredAlertChannel?: "whatsapp" | "telegram" | "email" | "both" | "all";
  telegramAlertChatId?: string;
  telegramAlertBotToken?: string;
  telegramEnabled?: boolean;

  // Email alerts (Resend)
  emailAlertAddress?: string;
  emailAlertsEnabled?: boolean;
  emailAlertTypes?: "all" | "questions_only" | "claims_only";

  // Web notifications
  webNotifications?: WebNotificationsSettings;

  // Quota and billing
  planId: "starter" | "pro" | "business" | "enterprise";
  monthlyAlertsLimit: number;
  alertsSentThisMonth: number;
  cycleResetDate: string;

  // LLM quota
  monthlyLLMLimit: number;
  llmResponsesThisMonth: number;
  llmQuotaExhaustedAt: string | null;

  // Billing
  billingStatus: "active" | "overdue" | "cancelled";
  nextBillingDate: string;

  permissions?: TenantPermissions;
}

export interface TenantProps {
  id: string;
  sellerId: string;
  nickname?: string;
  email?: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  settings: TenantSettings;
  createdAt: Date;
  updatedAt: Date;
}

export class Tenant {
  public readonly id: string;
  public readonly sellerId: string;
  public nickname?: string;
  public email?: string;
  private _accessToken: string;
  private _refreshToken: string;
  private _expiresAt: number;
  public settings: TenantSettings;
  public readonly createdAt: Date;
  public updatedAt: Date;

  constructor(props: TenantProps) {
    this.id = props.id;
    this.sellerId = props.sellerId;
    this.nickname = props.nickname;
    this.email = props.email;
    this._accessToken = props.accessToken;
    this._refreshToken = props.refreshToken;
    this._expiresAt = props.expiresAt;
    const planId = props.settings.planId || "starter";
    this.settings = {
      ...props.settings,
      planId,
      billingStatus: props.settings.billingStatus ?? "active",
      monthlyLLMLimit: props.settings.monthlyLLMLimit ?? PLAN_LIMITS[planId]?.llmResponsesPerMonth ?? 300,
      llmResponsesThisMonth: props.settings.llmResponsesThisMonth ?? 0,
      llmQuotaExhaustedAt: props.settings.llmQuotaExhaustedAt ?? null,
    };
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  get accessToken(): string { return this._accessToken; }
  get refreshToken(): string { return this._refreshToken; }
  get expiresAt(): number { return this._expiresAt; }

  public isTokenExpiringSoon(marginMs: number = 10 * 60 * 1000): boolean {
    return this._expiresAt - Date.now() < marginMs;
  }

  public updateTokens(accessToken: string, refreshToken: string, expiresInSec: number): void {
    this._accessToken = accessToken;
    this._refreshToken = refreshToken;
    this._expiresAt = Date.now() + expiresInSec * 1000;
    this.updatedAt = new Date();
  }

  public updateSettings(partialSettings: Partial<TenantSettings>): void {
    this.settings = { ...this.settings, ...partialSettings };
    this.updatedAt = new Date();
  }

  public get effectivePermissions(): TenantPermissions {
    return this.settings.permissions ?? {
      whatsappEnabled: true,
      telegramEnabled: true,
      emailEnabled: false,
      preSaleEnabled: true,
      postSaleEnabled: true,
      multiUserEnabled: false,
    };
  }

  public canSendWhatsAppAlert(): boolean {
    if (!this.effectivePermissions.whatsappEnabled) return false;
    if (this.settings.whatsappMode === "custom_byo") return true;
    return this.settings.alertsSentThisMonth < this.settings.monthlyAlertsLimit;
  }

  public isTelegramConfigured(): boolean {
    return Boolean(this.settings.telegramAlertChatId);
  }

  public canSendTelegramAlert(): boolean {
    if (this.settings.telegramEnabled === false) return false;
    if (!this.effectivePermissions.telegramEnabled) return false;
    return this.isTelegramConfigured();
  }

  public isEmailAlertConfigured(): boolean {
    return Boolean(this.settings.emailAlertAddress || this.email);
  }

  public canSendEmailAlert(type?: "question" | "claim"): boolean {
    if (this.settings.emailAlertsEnabled === false) return false;
    if (this.effectivePermissions.emailEnabled === false) return false;

    const pref = this.settings.preferredAlertChannel;
    const channelAllowed = !pref || pref === "email" || pref === "all";
    if (!channelAllowed) return false;

    if (type && this.settings.emailAlertTypes) {
      if (this.settings.emailAlertTypes === "questions_only" && type !== "question") return false;
      if (this.settings.emailAlertTypes === "claims_only" && type !== "claim") return false;
    }

    return this.isEmailAlertConfigured();
  }

  public getEmailAlertAddress(): string | undefined {
    return this.settings.emailAlertAddress || this.email;
  }

  public updatePermissions(permissions: Partial<TenantPermissions>): void {
    this.settings = {
      ...this.settings,
      permissions: { ...this.effectivePermissions, ...permissions },
    };
    this.updatedAt = new Date();
  }

  public incrementAlertsSent(): void {
    this.settings = {
      ...this.settings,
      alertsSentThisMonth: this.settings.alertsSentThisMonth + 1,
    };
    this.updatedAt = new Date();
  }

  public incrementLLMResponses(): void {
    const limit = this.settings.monthlyLLMLimit ?? PLAN_LIMITS[this.settings.planId || "starter"]?.llmResponsesPerMonth ?? 300;
    const newCount = (this.settings.llmResponsesThisMonth ?? 0) + 1;
    const justExhausted =
      newCount >= limit &&
      !this.settings.llmQuotaExhaustedAt;

    this.settings = {
      ...this.settings,
      llmResponsesThisMonth: newCount,
      llmQuotaExhaustedAt: justExhausted
        ? new Date().toISOString()
        : this.settings.llmQuotaExhaustedAt ?? null,
    };
    this.updatedAt = new Date();
  }

  public isLLMQuotaAtWarning(): boolean {
    if (this.settings.llmQuotaExhaustedAt) return false;
    const limit = this.settings.monthlyLLMLimit ?? PLAN_LIMITS[this.settings.planId || "starter"]?.llmResponsesPerMonth ?? 300;
    if (!limit || !isFinite(limit)) return false;
    const count = this.settings.llmResponsesThisMonth ?? 0;
    return count / limit >= 0.8;
  }

  public canAutoAnswer(): boolean {
    const status = this.settings.billingStatus ?? "active";
    if (status !== "active") return false;
    if (!this.settings.llmQuotaExhaustedAt) return true;

    const exhaustedAt = new Date(this.settings.llmQuotaExhaustedAt).getTime();
    return Date.now() - exhaustedAt < QUOTA_GRACE_PERIOD_MS;
  }

  public canAccessClaims(): boolean {
    const planId = this.settings.planId || "starter";
    return PLAN_LIMITS[planId]?.claimsEnabled ?? false;
  }

  public canAccessWhatsApp(): boolean {
    return PLAN_LIMITS[this.settings.planId]?.whatsappEnabled ?? false;
  }

  public getWhatsAppCredentials(): { phoneNumberId?: string; accessToken?: string } | null {
    if (this.settings.whatsappMode === "custom_byo") {
      return {
        phoneNumberId: this.settings.customPhoneNumberId,
        accessToken: this.settings.customAccessToken,
      };
    }
    return null;
  }

  public getLLMCredentials(): { provider: string; apiKey: string } | null {
    if (this.settings.llmProvider && this.settings.llmApiKey) {
      return {
        provider: this.settings.llmProvider,
        apiKey: this.settings.llmApiKey,
      };
    }
    return null;
  }

  public getTelegramCredentials(): { chatId?: string; botToken?: string } | null {
    if (this.isTelegramConfigured()) {
      return {
        chatId: this.settings.telegramAlertChatId,
        botToken: this.settings.telegramAlertBotToken,
      };
    }
    return null;
  }

  // ── Automation logic ────────────────────────────────────────────────────────

  public isWithinWorkSchedule(now: Date = new Date()): boolean {
    const sch = this.settings.schedule;
    if (!sch?.enabled) return true;

    const currentDay = now.getDay(); // 0=Dom … 6=Sab
    if (!sch.workDays.includes(currentDay)) return false;

    const [startH, startM] = (sch.workStartHour || "09:00").split(":").map(Number);
    const [endH, endM] = (sch.workEndHour || "18:00").split(":").map(Number);
    const currentTotal = now.getHours() * 60 + now.getMinutes();

    return currentTotal >= startH * 60 + startM && currentTotal < endH * 60 + endM;
  }

  public shouldAutoAnswer(
    confidence: number,
    now: Date = new Date()
  ): { autoAnswer: boolean; reason: string } {
    const mode: AutomationMode =
      this.settings.automationMode ||
      (this.settings.autoAnswerEnabled ? "smart_hybrid" : "always_manual");

    if (mode === "always_manual") {
      return { autoAnswer: false, reason: "Modo 100% manual configurado" };
    }

    if (mode === "always_auto") {
      return { autoAnswer: true, reason: "Modo 100% automático activo" };
    }

    if (mode === "smart_hybrid") {
      const threshold = this.settings.confidenceThreshold ?? 0.75;
      const ok = confidence >= threshold;
      return {
        autoAnswer: ok,
        reason: ok
          ? `Confianza suficiente (${confidence.toFixed(2)} >= ${threshold})`
          : `Confianza insuficiente (${confidence.toFixed(2)} < ${threshold})`,
      };
    }

    if (mode === "schedule") {
      const isWorkHours = this.isWithinWorkSchedule(now);
      const subMode = isWorkHours
        ? (this.settings.schedule?.daytimeMode || "always_manual")
        : (this.settings.schedule?.nighttimeMode || "always_auto");
      const period = isWorkHours ? "diurno" : "nocturno";

      if (subMode === "always_auto") {
        return { autoAnswer: true, reason: `Guardia automática (${period})` };
      }
      if (subMode === "always_manual") {
        return { autoAnswer: false, reason: `Revisión manual en horario ${period}` };
      }
      // smart_hybrid sub-mode
      const threshold = this.settings.confidenceThreshold ?? 0.75;
      const ok = confidence >= threshold;
      return {
        autoAnswer: ok,
        reason: ok
          ? `Híbrido por horario ${period} (${confidence.toFixed(2)} >= ${threshold})`
          : `Confianza insuficiente en horario ${period} (${confidence.toFixed(2)})`,
      };
    }

    return { autoAnswer: false, reason: "Modo no reconocido" };
  }

  // ── Factory ─────────────────────────────────────────────────────────────────

  public static createDefault(props: {
    id: string;
    sellerId: string;
    accessToken: string;
    refreshToken: string;
    expiresInSec: number;
    nickname?: string;
    email?: string;
  }): Tenant {
    const now = new Date();
    const nextMonth = new Date(now);
    nextMonth.setMonth(nextMonth.getMonth() + 1);

    return new Tenant({
      id: props.id,
      sellerId: props.sellerId,
      nickname: props.nickname,
      email: props.email,
      accessToken: props.accessToken,
      refreshToken: props.refreshToken,
      expiresAt: Date.now() + props.expiresInSec * 1000,
      settings: {
        automationMode: "smart_hybrid",
        autoAnswerEnabled: true,
        confidenceThreshold: 0.75,
        tone: "casual_rioplatense",
        customInstructions: "",
        policies: {},
        schedule: {
          enabled: false,
          timezone: "America/Argentina/Buenos_Aires",
          workDays: [1, 2, 3, 4, 5],
          workStartHour: "09:00",
          workEndHour: "18:00",
          daytimeMode: "always_manual",
          nighttimeMode: "always_auto",
        },
        preferredAlertChannel: "whatsapp",
        whatsappMode: "platform_shared",
        telegramEnabled: true,
        webNotifications: {
          enabled: true,
          scope: "all",
          soundEnabled: true,
          desktopPushEnabled: false,
        },
        planId: "starter",
        monthlyAlertsLimit: 150,
        alertsSentThisMonth: 0,
        cycleResetDate: nextMonth.toISOString(),
        monthlyLLMLimit: PLAN_LIMITS["starter"].llmResponsesPerMonth,
        llmResponsesThisMonth: 0,
        llmQuotaExhaustedAt: null,
        billingStatus: "active",
        nextBillingDate: nextMonth.toISOString(),
        permissions: {
          whatsappEnabled: true,
          telegramEnabled: true,
          emailEnabled: false,
          preSaleEnabled: true,
          postSaleEnabled: true,
          multiUserEnabled: false,
        },
      },
      createdAt: now,
      updatedAt: now,
    });
  }
}
