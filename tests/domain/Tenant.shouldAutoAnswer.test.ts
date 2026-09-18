import { describe, it, expect } from "vitest";
import { Tenant, TenantSettings } from "../domain/entities/Tenant.js";

function makeTenant(overrides: Partial<TenantSettings> = {}): Tenant {
  return Tenant.createDefault({
    id: "t1",
    sellerId: "s1",
    accessToken: "tok",
    refreshToken: "ref",
    expiresInSec: 3600,
  });
}

function withMode(mode: TenantSettings["automationMode"], extra: Partial<TenantSettings> = {}): Tenant {
  const t = makeTenant();
  t.updateSettings({ automationMode: mode, ...extra });
  return t;
}

// ── always_auto ──────────────────────────────────────────────────────────────
describe("always_auto", () => {
  it("auto-responde siempre sin importar confianza", () => {
    const t = withMode("always_auto");
    expect(t.shouldAutoAnswer(0.0).autoAnswer).toBe(true);
    expect(t.shouldAutoAnswer(0.5).autoAnswer).toBe(true);
    expect(t.shouldAutoAnswer(1.0).autoAnswer).toBe(true);
  });

  it("reason indica modo 100% automático", () => {
    const t = withMode("always_auto");
    expect(t.shouldAutoAnswer(0.5).reason).toContain("100% automático");
  });
});

// ── always_manual ────────────────────────────────────────────────────────────
describe("always_manual", () => {
  it("nunca auto-responde", () => {
    const t = withMode("always_manual");
    expect(t.shouldAutoAnswer(1.0).autoAnswer).toBe(false);
    expect(t.shouldAutoAnswer(0.0).autoAnswer).toBe(false);
  });

  it("reason indica modo manual", () => {
    const t = withMode("always_manual");
    expect(t.shouldAutoAnswer(0.9).reason).toContain("manual");
  });
});

// ── smart_hybrid ─────────────────────────────────────────────────────────────
describe("smart_hybrid", () => {
  it("auto-responde si confianza >= umbral", () => {
    const t = withMode("smart_hybrid", { confidenceThreshold: 0.75 });
    expect(t.shouldAutoAnswer(0.75).autoAnswer).toBe(true);
    expect(t.shouldAutoAnswer(0.9).autoAnswer).toBe(true);
  });

  it("deriva a humano si confianza < umbral", () => {
    const t = withMode("smart_hybrid", { confidenceThreshold: 0.75 });
    expect(t.shouldAutoAnswer(0.74).autoAnswer).toBe(false);
    expect(t.shouldAutoAnswer(0.0).autoAnswer).toBe(false);
  });

  it("reason incluye los valores de confianza y umbral", () => {
    const t = withMode("smart_hybrid", { confidenceThreshold: 0.75 });
    const { reason } = t.shouldAutoAnswer(0.60);
    expect(reason).toContain("0.60");
    expect(reason).toContain("0.75");
  });
});

// ── schedule ─────────────────────────────────────────────────────────────────
describe("schedule", () => {
  function makeScheduleTenant(daytimeMode: "smart_hybrid" | "always_manual", nighttimeMode: "always_auto" | "smart_hybrid") {
    const t = withMode("schedule", {
      schedule: {
        enabled: true,
        timezone: "America/Argentina/Buenos_Aires",
        workDays: [1, 2, 3, 4, 5], // Lun-Vie
        workStartHour: "09:00",
        workEndHour: "18:00",
        daytimeMode,
        nighttimeMode,
      },
      confidenceThreshold: 0.75,
    });
    return t;
  }

  // Lunes a las 10:00 hs → dentro de horario
  const workingHour = new Date("2026-09-14T10:00:00"); // lunes 10am UTC (simplificación)
  // Lunes a las 22:00 hs → fuera de horario
  const nightHour = new Date("2026-09-14T22:00:00");
  // Domingo → fuera de días laborales
  const weekend = new Date("2026-09-13T10:00:00");

  describe("horario diurno con daytimeMode=always_manual", () => {
    it("deriva a humano en horario laboral", () => {
      const t = makeScheduleTenant("always_manual", "always_auto");
      expect(t.shouldAutoAnswer(1.0, workingHour).autoAnswer).toBe(false);
    });
  });

  describe("horario nocturno con nighttimeMode=always_auto", () => {
    it("auto-responde fuera de horario laboral", () => {
      const t = makeScheduleTenant("always_manual", "always_auto");
      expect(t.shouldAutoAnswer(0.1, nightHour).autoAnswer).toBe(true);
    });

    it("auto-responde en fin de semana", () => {
      const t = makeScheduleTenant("always_manual", "always_auto");
      expect(t.shouldAutoAnswer(0.5, weekend).autoAnswer).toBe(true);
    });
  });

  describe("smart_hybrid sub-mode", () => {
    it("evalúa umbral en horario nocturno con nighttimeMode=smart_hybrid", () => {
      const t = makeScheduleTenant("always_manual", "smart_hybrid");
      expect(t.shouldAutoAnswer(0.8, nightHour).autoAnswer).toBe(true);
      expect(t.shouldAutoAnswer(0.5, nightHour).autoAnswer).toBe(false);
    });
  });
});

// ── isWithinWorkSchedule ─────────────────────────────────────────────────────
describe("isWithinWorkSchedule", () => {
  it("retorna true si schedule no está enabled", () => {
    const t = makeTenant();
    t.updateSettings({ schedule: { enabled: false, timezone: "UTC", workDays: [], workStartHour: "09:00", workEndHour: "18:00", daytimeMode: "always_manual", nighttimeMode: "always_auto" } });
    expect(t.isWithinWorkSchedule()).toBe(true);
  });

  it("retorna false si el día no es laboral", () => {
    const t = withMode("schedule", {
      schedule: {
        enabled: true,
        timezone: "UTC",
        workDays: [1, 2, 3, 4, 5],
        workStartHour: "09:00",
        workEndHour: "18:00",
        daytimeMode: "always_manual",
        nighttimeMode: "always_auto",
      },
    });
    const sunday = new Date("2026-09-13T10:00:00"); // domingo
    expect(t.isWithinWorkSchedule(sunday)).toBe(false);
  });
});
