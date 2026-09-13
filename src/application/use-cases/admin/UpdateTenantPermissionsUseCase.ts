import { ITenantRepository } from "../../interfaces/ITenantRepository.js";
import { TenantPermissions } from "../../../domain/entities/Tenant.js";

interface Input {
  sellerId: string;
  permissions: Partial<TenantPermissions>;
}

export class UpdateTenantPermissionsUseCase {
  constructor(private readonly tenantRepo: ITenantRepository) {}

  async execute({ sellerId, permissions }: Input): Promise<{ sellerId: string; permissions: TenantPermissions }> {
    const tenant = await this.tenantRepo.findBySellerId(sellerId);
    if (!tenant) throw new Error(`Tenant not found: ${sellerId}`);

    tenant.updatePermissions(permissions);
    await this.tenantRepo.save(tenant);

    return { sellerId, permissions: tenant.effectivePermissions };
  }
}
