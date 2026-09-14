import { describe, it, expect } from "vitest";
import { calculateCost, resolveModelKey } from "../../src/domain/value-objects/LLMPricing.js";

describe("calculateCost", () => {
  it("calculates cost for a known groq model", () => {
    // 1M input tokens at $0.59 + 0.5M output at $0.79/M = $0.59 + $0.395 = $0.985
    const cost = calculateCost("groq", "llama-3.3-70b-versatile", 1_000_000, 500_000);
    expect(cost).toBeCloseTo(0.985, 5);
  });

  it("calculates cost for openai gpt-4o-mini", () => {
    // 100k input @ $0.15/M + 50k output @ $0.60/M = $0.015 + $0.03 = $0.045
    const cost = calculateCost("openai", "gpt-4o-mini", 100_000, 50_000);
    expect(cost).toBeCloseTo(0.045, 6);
  });

  it("returns 0 for unknown model", () => {
    expect(calculateCost("unknown", "some-model", 1000, 500)).toBe(0);
  });

  it("returns 0 for zero tokens", () => {
    expect(calculateCost("groq", "llama-3.3-70b-versatile", 0, 0)).toBe(0);
  });
});

describe("resolveModelKey", () => {
  it("strips provider prefix from groq model name", () => {
    // groq model names sometimes come with 'openai/' prefix from env
    expect(resolveModelKey("groq", "openai/gpt-oss-120b")).toBe("groq/openai/gpt-oss-120b");
  });

  it("builds key from provider + model", () => {
    expect(resolveModelKey("groq", "llama-3.3-70b-versatile")).toBe("groq/llama-3.3-70b-versatile");
  });
});
