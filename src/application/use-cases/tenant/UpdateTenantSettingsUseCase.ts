import { ITenantRepository } from "../../interfaces/ITenantRepository.js";

export class UpdateTenantSettingsUseCase {
  constructor(private readonly tenantRepo: ITenantRepository) {}

  /** @returns settings y permisos actualizados, o null si el tenant no existe. */
  public async execute(params: {
    sellerId: string;
    settings: Record<string, unknown>;
  }): Promise<{ settings: unknown; permissions: unknown } | null> {
    const tenant = await this.tenantRepo.findBySellerId(params.sellerId);
    if (!tenant) return null;

    tenant.updateSettings(params.settings);
    await this.tenantRepo.save(tenant);

    return {
      settings: tenant.settings,
      permissions: tenant.effectivePermissions,
    };
  }
}
