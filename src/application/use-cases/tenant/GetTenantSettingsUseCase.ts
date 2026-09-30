import { ITenantRepository } from "../../interfaces/ITenantRepository.js";

export interface TenantSettingsView {
  sellerId: string;
  nickname?: string;
  email?: string;
  tokenHealth: "healthy" | "expiring_soon" | "expired";
  expiresInMinutes: number;
  settings: unknown;
  permissions: unknown;
}

export class GetTenantSettingsUseCase {
  constructor(private readonly tenantRepo: ITenantRepository) {}

  /** @returns la vista de settings, o null si el tenant no existe. */
  public async execute(sellerId: string): Promise<TenantSettingsView | null> {
    const tenant = await this.tenantRepo.findBySellerId(sellerId);
    if (!tenant) return null;

    let tokenHealth: "healthy" | "expiring_soon" | "expired" = "healthy";
    const remainingMs = tenant.expiresAt - Date.now();
    if (remainingMs <= 0) {
      tokenHealth = "expired";
    } else if (remainingMs < 15 * 60 * 1000) {
      tokenHealth = "expiring_soon";
    }

    return {
      sellerId: tenant.sellerId,
      nickname: tenant.nickname,
      email: tenant.email,
      tokenHealth,
      expiresInMinutes: Math.max(0, Math.round(remainingMs / (60 * 1000))),
      settings: tenant.settings,
      permissions: tenant.effectivePermissions,
    };
  }
}
