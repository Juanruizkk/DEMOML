import { describe, it, expect, vi, beforeEach } from "vitest";
import { UpdateTenantPlanUseCase } from "../../src/application/use-cases/admin/UpdateTenantPlanUseCase.js";
import { Tenant } from "../../src/domain/entities/Tenant.js";
import { PLAN_LIMITS } from "../../src/domain/entities/Tenant.js";

function makeActiveTenant(planId = "starter"): Tenant {
  const now = new Date();
  return new Tenant({
    id: "t-001",
    sellerId: "seller_1",
    accessToken: "tok",
    refreshToken: "ref",
    expiresAt: Date.now() + 3600_000,
    settings: {
      automationMode: "smart_hybrid",
      autoAnswerEnabled: true,
      confidenceThreshold: 0.75,
      tone: "casual_rioplatense",
      whatsappMode: "platform_shared",
      planId: planId as any,
      monthlyAlertsLimit: 150,
      alertsSentThisMonth: 0,
      monthlyLLMLimit: PLAN_LIMITS[planId].llmResponsesPerMonth,
      llmResponsesThisMonth: 0,
      llmQuotaExhaustedAt: null,
      billingStatus: "active",
      nextBillingDate: new Date(now.getTime() + 30 * 24 * 3600_000).toISOString(),
      cycleResetDate: new Date(now.getTime() + 30 * 24 * 3600_000).toISOString(),
    },
    createdAt: now,
    updatedAt: now,
  });
}

describe("UpdateTenantPlanUseCase", () => {
  let mockTenantRepo: any;
  let useCase: UpdateTenantPlanUseCase;

  beforeEach(() => {
    mockTenantRepo = {
      findBySellerId: vi.fn().mockResolvedValue(makeActiveTenant("starter")),
      save: vi.fn().mockResolvedValue(undefined),
    };
    useCase = new UpdateTenantPlanUseCase(mockTenantRepo);
  });

  it("throws if tenant not found", async () => {
    mockTenantRepo.findBySellerId.mockResolvedValue(null);
    await expect(
      useCase.execute({ sellerId: "seller_1", planId: "pro", billingStatus: "active", nextBillingDate: new Date().toISOString() })
    ).rejects.toThrow("Tenant not found");
  });

  it("updates planId and monthlyLLMLimit from PLAN_LIMITS", async () => {
    await useCase.execute({
      sellerId: "seller_1",
      planId: "pro",
      billingStatus: "active",
      nextBillingDate: "2026-10-17T00:00:00.000Z",
    });

    const saved: Tenant = mockTenantRepo.save.mock.calls[0][0];
    expect(saved.settings.planId).toBe("pro");
    expect(saved.settings.monthlyLLMLimit).toBe(1000);
    expect(saved.settings.billingStatus).toBe("active");
    expect(saved.settings.nextBillingDate).toBe("2026-10-17T00:00:00.000Z");
  });

  it("clears llmQuotaExhaustedAt when upgrading plan", async () => {
    const exhaustedTenant = makeActiveTenant("starter");
    exhaustedTenant.updateSettings({ llmQuotaExhaustedAt: new Date().toISOString() });
    mockTenantRepo.findBySellerId.mockResolvedValue(exhaustedTenant);

    await useCase.execute({
      sellerId: "seller_1",
      planId: "pro",
      billingStatus: "active",
      nextBillingDate: "2026-10-17T00:00:00.000Z",
    });

    const saved: Tenant = mockTenantRepo.save.mock.calls[0][0];
    expect(saved.settings.llmQuotaExhaustedAt).toBeNull();
  });

  it("updates billingStatus to overdue without changing planId", async () => {
    await useCase.execute({
      sellerId: "seller_1",
      planId: "starter",
      billingStatus: "overdue",
      nextBillingDate: "2026-10-17T00:00:00.000Z",
    });

    const saved: Tenant = mockTenantRepo.save.mock.calls[0][0];
    expect(saved.settings.billingStatus).toBe("overdue");
    expect(saved.settings.planId).toBe("starter");
  });
});
