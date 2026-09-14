import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { SqliteLLMUsageRepository } from "../infrastructure/persistence/sqlite/SqliteLLMUsageRepository.js";

function makeDb() {
  const db = new Database(":memory:");
  db.exec(`
    CREATE TABLE llm_usage_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      seller_id TEXT NOT NULL,
      channel TEXT NOT NULL,
      provider TEXT NOT NULL,
      model TEXT NOT NULL,
      tokens_in INTEGER NOT NULL DEFAULT 0,
      tokens_out INTEGER NOT NULL DEFAULT 0,
      tokens_estimated INTEGER NOT NULL DEFAULT 0,
      cost_usd REAL NOT NULL DEFAULT 0,
      latency_ms INTEGER NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE llm_usage_monthly (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      seller_id TEXT NOT NULL,
      year_month TEXT NOT NULL,
      total_calls INTEGER NOT NULL DEFAULT 0,
      total_tokens INTEGER NOT NULL DEFAULT 0,
      total_cost_usd REAL NOT NULL DEFAULT 0.0,
      spending_limit_usd REAL,
      alert_sent_at DATETIME,
      UNIQUE(seller_id, year_month)
    );
  `);
  return db;
}

describe("SqliteLLMUsageRepository", () => {
  let repo: SqliteLLMUsageRepository;

  beforeEach(() => {
    repo = new SqliteLLMUsageRepository(makeDb());
  });

  it("log() inserts a row in llm_usage_logs and returns false when no limit", () => {
    const exceeded = repo.log({
      sellerId: "seller_1",
      channel: "questions",
      provider: "groq",
      model: "llama-3.3-70b-versatile",
      tokensIn: 450,
      tokensOut: 60,
      tokensEstimated: false,
      costUsd: 0.000312,
      latencyMs: 420,
    });
    expect(exceeded).toBe(false);
  });

  it("log() upserts monthly summary on second call in same month", () => {
    repo.log({ sellerId: "s1", channel: "questions", provider: "groq", model: "llama", tokensIn: 100, tokensOut: 50, tokensEstimated: false, costUsd: 0.001, latencyMs: 200 });
    repo.log({ sellerId: "s1", channel: "questions", provider: "groq", model: "llama", tokensIn: 200, tokensOut: 100, tokensEstimated: false, costUsd: 0.002, latencyMs: 300 });
    const stats = repo.getMonthlyStats("s1", new Date().toISOString().slice(0, 7));
    expect(stats).not.toBeNull();
    expect(stats!.totalCalls).toBe(2);
    expect(stats!.totalTokens).toBe(450); // (100+50) + (200+100)
    expect(stats!.totalCostUsd).toBeCloseTo(0.003, 6);
  });

  it("log() returns true when spending limit is exceeded", () => {
    repo.setSpendingLimit("s1", 0.001);
    const exceeded = repo.log({ sellerId: "s1", channel: "questions", provider: "groq", model: "llama", tokensIn: 100, tokensOut: 50, tokensEstimated: false, costUsd: 0.002, latencyMs: 200 });
    expect(exceeded).toBe(true);
  });

  it("getMonthlyStats() returns null for unknown seller/month", () => {
    expect(repo.getMonthlyStats("nobody", "2020-01")).toBeNull();
  });

  it("getRecentLogs() returns latest N entries for a seller", () => {
    for (let i = 0; i < 5; i++) {
      repo.log({ sellerId: "s2", channel: "questions", provider: "groq", model: "llama", tokensIn: i * 10, tokensOut: i * 5, tokensEstimated: false, costUsd: 0.001, latencyMs: 100 });
    }
    const logs = repo.getRecentLogs("s2", 3);
    expect(logs).toHaveLength(3);
  });

  it("setSpendingLimit() updates the limit and getMonthlyStats() reflects it", () => {
    repo.log({ sellerId: "s3", channel: "questions", provider: "groq", model: "llama", tokensIn: 10, tokensOut: 5, tokensEstimated: false, costUsd: 0.001, latencyMs: 100 });
    repo.setSpendingLimit("s3", 5.00);
    const stats = repo.getMonthlyStats("s3", new Date().toISOString().slice(0, 7));
    expect(stats!.spendingLimitUsd).toBe(5.00);
  });

  it("getAllTenantsMonthlyStats() aggregates all tenants for a month", () => {
    const month = new Date().toISOString().slice(0, 7);
    repo.log({ sellerId: "ta", channel: "questions", provider: "groq", model: "llama", tokensIn: 100, tokensOut: 50, tokensEstimated: false, costUsd: 0.001, latencyMs: 100 });
    repo.log({ sellerId: "tb", channel: "order_messages", provider: "openai", model: "gpt-4o-mini", tokensIn: 200, tokensOut: 100, tokensEstimated: false, costUsd: 0.002, latencyMs: 200 });
    const all = repo.getAllTenantsMonthlyStats(month);
    expect(all).toHaveLength(2);
    expect(all.map(t => t.sellerId).sort()).toEqual(["ta", "tb"]);
  });
});
