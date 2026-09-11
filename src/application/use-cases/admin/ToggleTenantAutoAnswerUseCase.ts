import { ITenantRepository } from "../../interfaces/ITenantRepository.js";
import { IEventRepository } from "../../interfaces/IEventRepository.js";
import { EventLog } from "../../../domain/entities/EventLog.js";

export class ToggleTenantAutoAnswerUseCase {
  constructor(
    private readonly tenantRepo: ITenantRepository,
    private readonly eventRepo: IEventRepository
  ) {}

  public async execute(params: { sellerId: string; enabled?: boolean }): Promise<{ sellerId: string; autoAnswerEnabled: boolean }> {
    const { sellerId, enabled } = params;
    const tenant = await this.tenantRepo.findBySellerId(sellerId);
    if (!tenant) {
      throw new Error(`Inquilino no encontrado para el vendedor ${sellerId}`);
    }

    const newStatus = typeof enabled === "boolean" ? enabled : !tenant.settings.autoAnswerEnabled;
    tenant.updateSettings({ autoAnswerEnabled: newStatus });
    await this.tenantRepo.save(tenant);

    await this.eventRepo.log(
      new EventLog({
        sellerId,
        type: "config_changed",
        message: `⚙️ [Admin] Respuesta automática ${newStatus ? "ACTIVADA" : "DESACTIVADA"} para ${tenant.nickname || sellerId}`,
      })
    );

    return {
      sellerId,
      autoAnswerEnabled: newStatus,
    };
  }
}
