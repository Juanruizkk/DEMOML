export type WhatsAppMode = "platform_shared" | "custom_byo";

export interface TenantPermissions {
  // Notification channels — super admin controls which are available to this tenant
  whatsappEnabled: boolean;
  telegramEnabled: boolean;
  emailEnabled: boolean; // reserved for future use

  // Sale stage access
  preSaleEnabled: boolean; // questions + auto-answer
  postSaleEnabled: boolean; // claims / reclamos
}

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

  // Granular feature permissions (admin-controlled)
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

  public get effectivePermissions(): TenantPermissions {
    return this.settings.permissions ?? {
      whatsappEnabled: true,
      telegramEnabled: true,
      emailEnabled: false,
      preSaleEnabled: true,
      postSaleEnabled: true,
    };
  }

  public canSendWhatsAppAlert(): boolean {
    if (!this.effectivePermissions.whatsappEnabled) return false;
    if (this.settings.whatsappMode === "custom_byo") return true;
    return this.settings.alertsSentThisMonth < this.settings.monthlyAlertsLimit;
  }

  public canSendTelegramAlert(): boolean {
    if (!this.effectivePermissions.telegramEnabled) return false;
    return this.isTelegramConfigured();
  }

  public isTelegramConfigured(): boolean {
    return !!(this.settings as any).telegramEnabled;
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
        permissions: {
          whatsappEnabled: true,
          telegramEnabled: true,
          emailEnabled: false,
          preSaleEnabled: true,
          postSaleEnabled: true,
        },
      },
      createdAt: now,
      updatedAt: now,
    });
  }
}
