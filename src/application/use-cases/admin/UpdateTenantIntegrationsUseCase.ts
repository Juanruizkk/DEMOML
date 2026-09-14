import { ITenantRepository } from "../../interfaces/ITenantRepository.js";
import { TenantSettings, WhatsAppMode } from "../../../domain/entities/Tenant.js";

interface IntegrationsInput {
  whatsappMode?: WhatsAppMode;
  customPhoneNumberId?: string;
  customAccessToken?: string;
  customWabaId?: string;
  llmProvider?: "groq" | "openai" | "anthropic";
  llmApiKey?: string;
}

interface Input {
  sellerId: string;
  integrations: IntegrationsInput;
}

export class UpdateTenantIntegrationsUseCase {
  constructor(private readonly tenantRepo: ITenantRepository) {}

  async execute({ sellerId, integrations }: Input): Promise<{ sellerId: string; integrations: Partial<TenantSettings> }> {
    const tenant = await this.tenantRepo.findBySellerId(sellerId);
    if (!tenant) throw new Error(`Tenant not found: ${sellerId}`);

    tenant.updateSettings(integrations);
    await this.tenantRepo.save(tenant);

    // Devolver solo metadata — nunca los secrets
    const integrationsMeta: Partial<TenantSettings> & { hasLlmApiKey?: boolean; hasCustomAccessToken?: boolean } = {
      whatsappMode: tenant.settings.whatsappMode,
      customPhoneNumberId: tenant.settings.customPhoneNumberId,
      customWabaId: tenant.settings.customWabaId,
      llmProvider: tenant.settings.llmProvider,
      hasLlmApiKey: Boolean(tenant.settings.llmApiKey),
      hasCustomAccessToken: Boolean(tenant.settings.customAccessToken),
    };
    return {
      sellerId,
      integrations: integrationsMeta as Partial<TenantSettings>,
    };
  }
}
