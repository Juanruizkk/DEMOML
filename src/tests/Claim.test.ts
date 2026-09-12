import { describe, it, expect } from "vitest";
import { Claim, ClaimProps } from "../domain/entities/Claim.js";

function makeClaim(overrides: Partial<ClaimProps> = {}): Claim {
  const now = new Date("2026-01-01T12:00:00Z");
  return new Claim({
    id: "5000000001",
    sellerId: "123456",
    orderId: "2000000001",
    type: "med_pnr",
    stage: "claim",
    status: "opened",
    reason: "PNR3430",
    actions: [],
    dueDate: new Date(now.getTime() + 48 * 60 * 60 * 1000),
    createdAt: now,
    updatedAt: now,
    ...overrides,
  });
}

describe("Claim.getUrgency", () => {
  it("returns 'critical' when under 12 hours remain", () => {
    const now = new Date("2026-01-01T12:00:00Z");
    const claim = makeClaim({ dueDate: new Date(now.getTime() + 10 * 60 * 60 * 1000) });
    expect(claim.getUrgency(now)).toBe("critical");
  });

  it("returns 'high' when between 12 and 24 hours remain", () => {
    const now = new Date("2026-01-01T12:00:00Z");
    const claim = makeClaim({ dueDate: new Date(now.getTime() + 20 * 60 * 60 * 1000) });
    expect(claim.getUrgency(now)).toBe("high");
  });

  it("returns 'normal' when more than 24 hours remain", () => {
    const now = new Date("2026-01-01T12:00:00Z");
    const claim = makeClaim({ dueDate: new Date(now.getTime() + 48 * 60 * 60 * 1000) });
    expect(claim.getUrgency(now)).toBe("normal");
  });

  it("returns 'critical' when due date is in the past", () => {
    const now = new Date("2026-01-01T12:00:00Z");
    const claim = makeClaim({ dueDate: new Date(now.getTime() - 1 * 60 * 60 * 1000) });
    expect(claim.getUrgency(now)).toBe("critical");
    expect(claim.getRemainingHours(now)).toBe(0);
  });
});

describe("Claim.markNotified", () => {
  it("sets notifiedAt and updatedAt", () => {
    const claim = makeClaim();
    expect(claim.notifiedAt).toBeUndefined();
    claim.markNotified();
    expect(claim.notifiedAt).toBeInstanceOf(Date);
    expect(claim.updatedAt).toBeInstanceOf(Date);
  });
});
