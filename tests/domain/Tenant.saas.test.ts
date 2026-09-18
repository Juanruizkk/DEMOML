import { describe, it, expect } from "vitest";
import { Tenant, TenantSettings, PLAN_LIMITS } from "../../src/domain/entities/Tenant.js";

function makeTenant(settingsOverride: Partial<TenantSettings> = {}): Tenant {
  const now = new Date();
  return new Tenant({
    id: "t-001",
    sellerId: "123456",
    accessToken: "token",
    refreshToken: "refresh",
    expiresAt: Date.now() + 3600 * 1000,
    settings: {
      automationMode: "always_auto",
      autoAnswerEnabled: true,
      confidenceThreshold: 0.75,
      tone: "casual_rioplatense",
      whatsappMode: "platform_shared",
      planId: "starter",
      monthlyAlertsLimit: 150,
      alertsSentThisMonth: 0,
      monthlyLLMLimit: 300,
      llmResponsesThisMonth: 0,
      llmQuotaExhaustedAt: null,
      billingStatus: "active",
      nextBillingDate: new Date(now.getTime() + 30 * 24 * 3600 * 1000).toISOString(),
      cycleResetDate: new Date(now.getTime() + 30 * 24 * 3600 * 1000).toISOString(),
      ...settingsOverride,
    },
    createdAt: now,
    updatedAt: now,
  });
}

describe("PLAN_LIMITS", () => {
  it("starter has 300 LLM responses and 0 WA alerts", () => {
    expect(PLAN_LIMITS.starter.llmResponsesPerMonth).toBe(300);
    expect(PLAN_LIMITS.starter.whatsappEnabled).toBe(false);
    expect(PLAN_LIMITS.starter.claimsEnabled).toBe(false);
  });

  it("pro has 1000 LLM responses and claims enabled", () => {
    expect(PLAN_LIMITS.pro.llmResponsesPerMonth).toBe(1000);
    expect(PLAN_LIMITS.pro.claimsEnabled).toBe(true);
    expect(PLAN_LIMITS.pro.whatsappEnabled).toBe(false);
  });

  it("business has 5000 LLM responses, claims, and WhatsApp", () => {
    expect(PLAN_LIMITS.business.llmResponsesPerMonth).toBe(5000);
    expect(PLAN_LIMITS.business.claimsEnabled).toBe(true);
    expect(PLAN_LIMITS.business.whatsappEnabled).toBe(true);
  });
});

describe("Tenant.incrementLLMResponses", () => {
  it("increments llmResponsesThisMonth by 1", () => {
    const tenant = makeTenant({ llmResponsesThisMonth: 10 });
    tenant.incrementLLMResponses();
    expect(tenant.settings.llmResponsesThisMonth).toBe(11);
  });

  it("sets llmQuotaExhaustedAt when reaching monthlyLLMLimit", () => {
    const tenant = makeTenant({ llmResponsesThisMonth: 299, monthlyLLMLimit: 300 });
    expect(tenant.settings.llmQuotaExhaustedAt).toBeNull();
    tenant.incrementLLMResponses();
    expect(tenant.settings.llmQuotaExhaustedAt).not.toBeNull();
  });

  it("does not overwrite llmQuotaExhaustedAt if already set", () => {
    const exhaustedAt = new Date(Date.now() - 1000).toISOString();
    const tenant = makeTenant({
      llmResponsesThisMonth: 350,
      monthlyLLMLimit: 300,
      llmQuotaExhaustedAt: exhaustedAt,
    });
    tenant.incrementLLMResponses();
    expect(tenant.settings.llmQuotaExhaustedAt).toBe(exhaustedAt);
  });
});

describe("Tenant.isLLMQuotaAtWarning", () => {
  it("returns false when below 80%", () => {
    const tenant = makeTenant({ llmResponsesThisMonth: 239, monthlyLLMLimit: 300 });
    expect(tenant.isLLMQuotaAtWarning()).toBe(false);
  });

  it("returns true at exactly 80%", () => {
    const tenant = makeTenant({ llmResponsesThisMonth: 240, monthlyLLMLimit: 300 });
    expect(tenant.isLLMQuotaAtWarning()).toBe(true);
  });

  it("returns true above 80%", () => {
    const tenant = makeTenant({ llmResponsesThisMonth: 280, monthlyLLMLimit: 300 });
    expect(tenant.isLLMQuotaAtWarning()).toBe(true);
  });

  it("returns false when quota is already exhausted (warning already passed)", () => {
    const tenant = makeTenant({
      llmResponsesThisMonth: 300,
      monthlyLLMLimit: 300,
      llmQuotaExhaustedAt: new Date().toISOString(),
    });
    expect(tenant.isLLMQuotaAtWarning()).toBe(false);
  });
});

describe("Tenant.canAutoAnswer", () => {
  it("returns true when under quota", () => {
    const tenant = makeTenant({ llmResponsesThisMonth: 100, monthlyLLMLimit: 300 });
    expect(tenant.canAutoAnswer()).toBe(true);
  });

  it("returns true when quota just exhausted (within 12h grace)", () => {
    const justNow = new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString();
    const tenant = makeTenant({
      llmResponsesThisMonth: 300,
      monthlyLLMLimit: 300,
      llmQuotaExhaustedAt: justNow,
    });
    expect(tenant.canAutoAnswer()).toBe(true);
  });

  it("returns false when quota exhausted for more than 12h", () => {
    const longAgo = new Date(Date.now() - 13 * 60 * 60 * 1000).toISOString();
    const tenant = makeTenant({
      llmResponsesThisMonth: 300,
      monthlyLLMLimit: 300,
      llmQuotaExhaustedAt: longAgo,
    });
    expect(tenant.canAutoAnswer()).toBe(false);
  });

  it("returns false when billingStatus is cancelled", () => {
    const tenant = makeTenant({ billingStatus: "cancelled" });
    expect(tenant.canAutoAnswer()).toBe(false);
  });

  it("returns false when billingStatus is overdue", () => {
    const tenant = makeTenant({ billingStatus: "overdue" });
    expect(tenant.canAutoAnswer()).toBe(false);
  });
});

describe("Tenant.canAccessClaims", () => {
  it("returns false for starter plan", () => {
    const tenant = makeTenant({ planId: "starter" });
    expect(tenant.canAccessClaims()).toBe(false);
  });

  it("returns true for pro plan", () => {
    const tenant = makeTenant({ planId: "pro" });
    expect(tenant.canAccessClaims()).toBe(true);
  });

  it("returns true for business plan", () => {
    const tenant = makeTenant({ planId: "business" });
    expect(tenant.canAccessClaims()).toBe(true);
  });
});

describe("Tenant.canAccessWhatsApp", () => {
  it("returns false for starter plan", () => {
    const tenant = makeTenant({ planId: "starter" });
    expect(tenant.canAccessWhatsApp()).toBe(false);
  });

  it("returns false for pro plan", () => {
    const tenant = makeTenant({ planId: "pro" });
    expect(tenant.canAccessWhatsApp()).toBe(false);
  });

  it("returns true for business plan", () => {
    const tenant = makeTenant({ planId: "business" });
    expect(tenant.canAccessWhatsApp()).toBe(true);
  });
});

describe("Tenant.createDefault SaaS fields", () => {
  it("initializes with starter plan and correct LLM limits", () => {
    const tenant = Tenant.createDefault({
      id: "t-001",
      sellerId: "999",
      accessToken: "tok",
      refreshToken: "ref",
      expiresInSec: 3600,
    });
    expect(tenant.settings.planId).toBe("starter");
    expect(tenant.settings.monthlyLLMLimit).toBe(300);
    expect(tenant.settings.llmResponsesThisMonth).toBe(0);
    expect(tenant.settings.llmQuotaExhaustedAt).toBeNull();
    expect(tenant.settings.billingStatus).toBe("active");
    expect(tenant.settings.nextBillingDate).toBeDefined();
  });
});
