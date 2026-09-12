export type WhatsAppMode = "platform_shared" | "custom_byo";

export interface TenantSettings {
  autoAnswerEnabled: boolean;
  confidenceThreshold: number;
  tone: "casual_rioplatense" | "formal" | "concise";
  customInstructions?: string;
  whatsappAlertPhone?: string;

  // Hybrid WhatsApp config
  whatsappMode: WhatsAppMode;
  customPhoneNumberId?: string;
  customAccessToken?: string;
  customWabaId?: string;

  // Quota and billing
  planId: "starter" | "pro" | "enterprise";
  monthlyAlertsLimit: number;
  alertsSentThisMonth: number;
  cycleResetDate: string;
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
    this.settings = props.settings;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  get accessToken(): string {
    return this._accessToken;
  }

  get refreshToken(): string {
    return this._refreshToken;
  }

  get expiresAt(): number {
    return this._expiresAt;
  }

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

  public canSendWhatsAppAlert(): boolean {
    if (this.settings.whatsappMode === "custom_byo") return true;
    return this.settings.alertsSentThisMonth < this.settings.monthlyAlertsLimit;
  }

  public incrementAlertsSent(): void {
    this.settings = {
      ...this.settings,
      alertsSentThisMonth: this.settings.alertsSentThisMonth + 1,
    };
    this.updatedAt = new Date();
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
        autoAnswerEnabled: true,
        confidenceThreshold: 0.75,
        tone: "casual_rioplatense",
        customInstructions: "",
        whatsappMode: "platform_shared",
        planId: "starter",
        monthlyAlertsLimit: 150,
        alertsSentThisMonth: 0,
        cycleResetDate: nextMonth.toISOString(),
      },
      createdAt: now,
      updatedAt: now,
    });
  }
}
