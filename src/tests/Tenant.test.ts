import { describe, it, expect } from "vitest";
import { Tenant, TenantSettings } from "../domain/entities/Tenant.js";

function makeTenant(settingsOverride: Partial<TenantSettings> = {}): Tenant {
  const now = new Date();
  return new Tenant({
    id: "t-001",
    sellerId: "123456",
    accessToken: "token",
    refreshToken: "refresh",
    expiresAt: Date.now() + 3600 * 1000,
    settings: {
      autoAnswerEnabled: true,
      confidenceThreshold: 0.75,
      tone: "casual_rioplatense",
      whatsappMode: "platform_shared",
      planId: "starter",
      monthlyAlertsLimit: 150,
      alertsSentThisMonth: 0,
      cycleResetDate: new Date(now.getTime() + 30 * 24 * 3600 * 1000).toISOString(),
      ...settingsOverride,
    },
    createdAt: now,
    updatedAt: now,
  });
}

describe("Tenant.canSendWhatsAppAlert", () => {
  it("returns true for platform_shared when under quota", () => {
    const tenant = makeTenant({ alertsSentThisMonth: 100, monthlyAlertsLimit: 150 });
    expect(tenant.canSendWhatsAppAlert()).toBe(true);
  });

  it("returns false for platform_shared when at quota limit", () => {
    const tenant = makeTenant({ alertsSentThisMonth: 150, monthlyAlertsLimit: 150 });
    expect(tenant.canSendWhatsAppAlert()).toBe(false);
  });

  it("returns false for platform_shared when over quota", () => {
    const tenant = makeTenant({ alertsSentThisMonth: 200, monthlyAlertsLimit: 150 });
    expect(tenant.canSendWhatsAppAlert()).toBe(false);
  });

  it("returns true for custom_byo regardless of counter", () => {
    const tenant = makeTenant({ whatsappMode: "custom_byo", alertsSentThisMonth: 9999, monthlyAlertsLimit: 150 });
    expect(tenant.canSendWhatsAppAlert()).toBe(true);
  });
});

describe("Tenant.incrementAlertsSent", () => {
  it("increments alertsSentThisMonth by 1", () => {
    const tenant = makeTenant({ alertsSentThisMonth: 42 });
    tenant.incrementAlertsSent();
    expect(tenant.settings.alertsSentThisMonth).toBe(43);
  });

  it("updates updatedAt", () => {
    const tenant = makeTenant();
    const before = tenant.updatedAt.getTime();
    tenant.incrementAlertsSent();
    expect(tenant.updatedAt.getTime()).toBeGreaterThanOrEqual(before);
  });
});

describe("Tenant.getWhatsAppCredentials", () => {
  it("returns null for platform_shared mode", () => {
    const tenant = makeTenant({ whatsappMode: "platform_shared" });
    expect(tenant.getWhatsAppCredentials()).toBeNull();
  });

  it("returns phoneNumberId and accessToken for custom_byo", () => {
    const tenant = makeTenant({
      whatsappMode: "custom_byo",
      customPhoneNumberId: "111222333",
      customAccessToken: "EAAG_test",
    });
    const creds = tenant.getWhatsAppCredentials();
    expect(creds).not.toBeNull();
    expect(creds?.phoneNumberId).toBe("111222333");
    expect(creds?.accessToken).toBe("EAAG_test");
  });
});

describe("Tenant.createDefault", () => {
  it("initializes with platform_shared mode and starter plan", () => {
    const tenant = Tenant.createDefault({
      id: "t-001",
      sellerId: "999",
      accessToken: "tok",
      refreshToken: "ref",
      expiresInSec: 3600,
    });
    expect(tenant.settings.whatsappMode).toBe("platform_shared");
    expect(tenant.settings.planId).toBe("starter");
    expect(tenant.settings.monthlyAlertsLimit).toBe(150);
    expect(tenant.settings.alertsSentThisMonth).toBe(0);
  });
});
