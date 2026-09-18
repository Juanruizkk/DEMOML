import { ITenantRepository } from "../../interfaces/ITenantRepository.js";
import { PLAN_LIMITS } from "../../../domain/entities/Tenant.js";

interface Input {
  sellerId: string;
  planId: "starter" | "pro" | "business" | "enterprise";
  billingStatus: "active" | "overdue" | "cancelled";
  nextBillingDate: string;
}

interface Output {
  sellerId: string;
  planId: string;
  monthlyLLMLimit: number;
  billingStatus: string;
  nextBillingDate: string;
}

export class UpdateTenantPlanUseCase {
  constructor(private readonly tenantRepo: ITenantRepository) {}

  async execute({ sellerId, planId, billingStatus, nextBillingDate }: Input): Promise<Output> {
    const tenant = await this.tenantRepo.findBySellerId(sellerId);
    if (!tenant) throw new Error(`Tenant not found: ${sellerId}`);

    const planFeatures = PLAN_LIMITS[planId];
    const isUpgrade = planFeatures.llmResponsesPerMonth > tenant.settings.monthlyLLMLimit;

    tenant.updateSettings({
      planId,
      monthlyLLMLimit: planFeatures.llmResponsesPerMonth,
      billingStatus,
      nextBillingDate,
      ...(isUpgrade && { llmQuotaExhaustedAt: null }),
    });

    await this.tenantRepo.save(tenant);

    return {
      sellerId,
      planId,
      monthlyLLMLimit: planFeatures.llmResponsesPerMonth,
      billingStatus,
      nextBillingDate,
    };
  }
}
