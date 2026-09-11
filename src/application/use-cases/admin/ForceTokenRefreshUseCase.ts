import { ITenantRepository } from "../../interfaces/ITenantRepository.js";
import { IMeliClient } from "../../interfaces/IMeliClient.js";
import { IEventRepository } from "../../interfaces/IEventRepository.js";
import { EventLog } from "../../../domain/entities/EventLog.js";

export class ForceTokenRefreshUseCase {
  constructor(
    private readonly tenantRepo: ITenantRepository,
    private readonly meliClient: IMeliClient,
    private readonly eventRepo: IEventRepository
  ) {}

  public async execute(sellerId: string): Promise<{ sellerId: string; success: boolean; expiresAt: number; expiresInMinutes: number }> {
    const tenant = await this.tenantRepo.findBySellerId(sellerId);
    if (!tenant) {
      throw new Error(`Inquilino no encontrado para el vendedor ${sellerId}`);
    }

    const tokens = await this.meliClient.refreshTokens(tenant.refreshToken);
    tenant.updateTokens(tokens.access_token, tokens.refresh_token, tokens.expires_in);
    await this.tenantRepo.save(tenant);

    await this.eventRepo.log(
      new EventLog({
        sellerId,
        type: "oauth_refreshed",
        message: `🔑 [Admin] Token de Mercado Libre renovado exitosamente para ${tenant.nickname || sellerId}`,
      })
    );

    return {
      sellerId,
      success: true,
      expiresAt: tenant.expiresAt,
      expiresInMinutes: Math.round((tenant.expiresAt - Date.now()) / (60 * 1000)),
    };
  }
}
