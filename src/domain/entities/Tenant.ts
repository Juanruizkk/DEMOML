export interface TenantSettings {
  autoAnswerEnabled: boolean;
  confidenceThreshold: number; // e.g. 0.75
  tone: "casual_rioplatense" | "formal" | "concise";
  customInstructions?: string; // Custom FAQ/business rules
  whatsappAlertPhone?: string; // WhatsApp number for human review alerts
}

export interface TenantProps {
  id: string; // Internal UUID or seller ID
  sellerId: string; // Mercado Libre User ID
  nickname?: string;
  email?: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // Timestamp ms
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
      },
      createdAt: now,
      updatedAt: now,
    });
  }
}
