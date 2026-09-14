# LLM Usage Tracking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Capture token usage and cost for every LLM inference call, expose a monthly breakdown to the Super Admin and to each tenant.

**Architecture:** Intercept usage data in `LangChainLLMService` via LangChain callbacks after each `invoke()`, write synchronously to SQLite via a new `ILLMUsageRepository`, and surface the data through two new REST endpoints and matching frontend sections.

**Tech Stack:** TypeScript, LangChain JS 0.3.x, better-sqlite3 (sync), Fastify, React + Vite, Vitest 5

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/domain/value-objects/LLMPricing.ts` | Create | Pricing table + cost calculator |
| `src/application/interfaces/ILLMUsageRepository.ts` | Create | Repository contract |
| `src/infrastructure/persistence/sqlite/SqliteLLMUsageRepository.ts` | Create | SQLite implementation |
| `src/application/use-cases/admin/GetLLMUsageStatsUseCase.ts` | Create | Admin monthly breakdown |
| `src/application/use-cases/tenant/GetTenantLLMUsageUseCase.ts` | Create | Tenant monthly stats + recent logs |
| `src/application/use-cases/tenant/SetLLMSpendingLimitUseCase.ts` | Create | Set/clear tenant alert limit |
| `src/presentation/controllers/LLMUsageController.ts` | Create | HTTP handlers for both roles |
| `src/tests/LLMPricing.test.ts` | Create | Unit tests for cost calculator |
| `src/tests/SqliteLLMUsageRepository.test.ts` | Create | Integration tests for repository |
| `client/src/components/LLMUsageCard.tsx` | Create | Tenant usage card component |
| `client/src/components/LLMUsageCard.css` | Create | Card styles |
| `src/infrastructure/persistence/sqlite/SqliteDatabase.ts` | Modify | Add 2 new tables |
| `src/application/interfaces/ILLMService.ts` | Modify | Add optional `usageContext` param |
| `src/infrastructure/llm/LangChainLLMService.ts` | Modify | Constructor + capture logic |
| `src/application/use-cases/ProcessQuestionUseCase.ts` | Modify | Pass `usageContext` |
| `src/application/use-cases/ProcessOrderMessageUseCase.ts` | Modify | Pass `usageContext` |
| `src/application/use-cases/SimulateQuestionUseCase.ts` | Modify | Pass `usageContext` |
| `src/presentation/controllers/ProductsController.ts` | Modify | Pass `usageContext` |
| `src/app.ts` | Modify | Wire repo, controller, routes |
| `client/src/pages/AdminPage.tsx` | Modify | Add "Consumo IA" section |
| `client/src/pages/AdminPage.css` | Modify | Styles for usage section |
| `client/src/pages/TenantPage.tsx` | Modify | Add "Consumo IA" tab |

---

## Task 1: LLMPricing value object + tests

**Files:**
- Create: `src/domain/value-objects/LLMPricing.ts`
- Create: `src/tests/LLMPricing.test.ts`

- [ ] **Step 1.1: Write failing tests**

```typescript
// src/tests/LLMPricing.test.ts
import { describe, it, expect } from "vitest";
import { calculateCost, resolveModelKey } from "../domain/value-objects/LLMPricing.js";

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
```

- [ ] **Step 1.2: Run tests to verify they fail**

```
npx vitest run src/tests/LLMPricing.test.ts
```
Expected: FAIL — "Cannot find module"

- [ ] **Step 1.3: Implement LLMPricing**

```typescript
// src/domain/value-objects/LLMPricing.ts

// Cost per million tokens in USD
const PRICING: Record<string, { input: number; output: number }> = {
  "groq/llama-3.3-70b-versatile":     { input: 0.59,  output: 0.79  },
  "groq/llama-3.1-8b-instant":        { input: 0.05,  output: 0.08  },
  "groq/openai/gpt-oss-120b":         { input: 0.90,  output: 0.90  },
  "openai/gpt-4o-mini":               { input: 0.15,  output: 0.60  },
  "openai/gpt-4o":                    { input: 2.50,  output: 10.00 },
  "anthropic/claude-3-5-sonnet-latest":{ input: 3.00, output: 15.00 },
  "anthropic/claude-3-haiku-20240307": { input: 0.25,  output: 1.25  },
};

export function resolveModelKey(provider: string, model: string): string {
  return `${provider}/${model}`;
}

export function calculateCost(provider: string, model: string, tokensIn: number, tokensOut: number): number {
  const key = resolveModelKey(provider, model);
  const rate = PRICING[key];
  if (!rate) return 0;
  return (tokensIn / 1_000_000) * rate.input + (tokensOut / 1_000_000) * rate.output;
}

export { PRICING };
```

- [ ] **Step 1.4: Run tests to verify they pass**

```
npx vitest run src/tests/LLMPricing.test.ts
```
Expected: PASS (3 tests)

- [ ] **Step 1.5: Commit**

```bash
git add src/domain/value-objects/LLMPricing.ts src/tests/LLMPricing.test.ts
git commit -m "feat: add LLM pricing table and cost calculator"
```

---

## Task 2: Database schema — add 2 new tables

**Files:**
- Modify: `src/infrastructure/persistence/sqlite/SqliteDatabase.ts`

- [ ] **Step 2.1: Add tables to `initSchema`**

In `SqliteDatabase.ts`, inside the `db.exec(...)` call in `initSchema`, append after the `order_messages` table and before the CREATE INDEX statements:

```typescript
      CREATE TABLE IF NOT EXISTS llm_usage_logs (
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

      CREATE TABLE IF NOT EXISTS llm_usage_monthly (
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
```

Also append these indexes after the existing indexes at the end of `initSchema`:

```typescript
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_llm_usage_logs_seller_date ON llm_usage_logs(seller_id, created_at);
      CREATE INDEX IF NOT EXISTS idx_llm_usage_monthly_seller ON llm_usage_monthly(seller_id, year_month);
    `);
```

- [ ] **Step 2.2: Verify the app still starts**

```
npx tsx src/server.ts
```
Expected: Server starts without error, press Ctrl+C.

- [ ] **Step 2.3: Commit**

```bash
git add src/infrastructure/persistence/sqlite/SqliteDatabase.ts
git commit -m "feat: add llm_usage_logs and llm_usage_monthly tables"
```

---

## Task 3: ILLMUsageRepository interface + SqliteLLMUsageRepository + tests

**Files:**
- Create: `src/application/interfaces/ILLMUsageRepository.ts`
- Create: `src/infrastructure/persistence/sqlite/SqliteLLMUsageRepository.ts`
- Create: `src/tests/SqliteLLMUsageRepository.test.ts`

- [ ] **Step 3.1: Write failing repository tests**

```typescript
// src/tests/SqliteLLMUsageRepository.test.ts
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
```

- [ ] **Step 3.2: Run tests to verify they fail**

```
npx vitest run src/tests/SqliteLLMUsageRepository.test.ts
```
Expected: FAIL — "Cannot find module"

- [ ] **Step 3.3: Create the interface**

```typescript
// src/application/interfaces/ILLMUsageRepository.ts

export interface LLMUsageLogEntry {
  sellerId: string;
  channel: string;
  provider: string;
  model: string;
  tokensIn: number;
  tokensOut: number;
  tokensEstimated: boolean;
  costUsd: number;
  latencyMs: number;
}

export interface MonthlyStats {
  yearMonth: string;
  totalCalls: number;
  totalTokens: number;
  totalCostUsd: number;
  spendingLimitUsd: number | null;
}

export interface TenantMonthlyStats extends MonthlyStats {
  sellerId: string;
}

export interface ILLMUsageRepository {
  /** Inserts log entry and upserts monthly summary. Returns true if spending limit exceeded. */
  log(entry: LLMUsageLogEntry): boolean;
  getMonthlyStats(sellerId: string, yearMonth: string): MonthlyStats | null;
  getAllTenantsMonthlyStats(yearMonth: string): TenantMonthlyStats[];
  getRecentLogs(sellerId: string, limit: number): (LLMUsageLogEntry & { createdAt: string })[];
  setSpendingLimit(sellerId: string, limitUsd: number | null): void;
  markAlertSent(sellerId: string, yearMonth: string): void;
  getGlobalProviderStats(yearMonth: string): Record<string, { calls: number; costUsd: number }>;
}
```

- [ ] **Step 3.4: Implement SqliteLLMUsageRepository**

```typescript
// src/infrastructure/persistence/sqlite/SqliteLLMUsageRepository.ts
import { Database as DatabaseType } from "better-sqlite3";
import {
  ILLMUsageRepository,
  LLMUsageLogEntry,
  MonthlyStats,
  TenantMonthlyStats,
} from "../../../application/interfaces/ILLMUsageRepository.js";

export class SqliteLLMUsageRepository implements ILLMUsageRepository {
  constructor(private readonly db: DatabaseType) {}

  public log(entry: LLMUsageLogEntry): boolean {
    const yearMonth = new Date().toISOString().slice(0, 7);

    this.db.prepare(`
      INSERT INTO llm_usage_logs
        (seller_id, channel, provider, model, tokens_in, tokens_out, tokens_estimated, cost_usd, latency_ms)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      entry.sellerId, entry.channel, entry.provider, entry.model,
      entry.tokensIn, entry.tokensOut, entry.tokensEstimated ? 1 : 0,
      entry.costUsd, entry.latencyMs
    );

    this.db.prepare(`
      INSERT INTO llm_usage_monthly (seller_id, year_month, total_calls, total_tokens, total_cost_usd)
      VALUES (?, ?, 1, ?, ?)
      ON CONFLICT(seller_id, year_month) DO UPDATE SET
        total_calls    = total_calls + 1,
        total_tokens   = total_tokens + excluded.total_tokens,
        total_cost_usd = total_cost_usd + excluded.total_cost_usd
    `).run(entry.sellerId, yearMonth, entry.tokensIn + entry.tokensOut, entry.costUsd);

    const monthly = this.getMonthlyStats(entry.sellerId, yearMonth);
    if (!monthly || monthly.spendingLimitUsd === null) return false;

    if (monthly.totalCostUsd >= monthly.spendingLimitUsd) {
      const row = this.db.prepare(
        `SELECT alert_sent_at FROM llm_usage_monthly WHERE seller_id = ? AND year_month = ?`
      ).get(entry.sellerId, yearMonth) as { alert_sent_at: string | null } | undefined;

      const today = new Date().toISOString().slice(0, 10);
      const lastAlert = row?.alert_sent_at?.slice(0, 10);
      if (lastAlert !== today) {
        this.markAlertSent(entry.sellerId, yearMonth);
        return true;
      }
    }
    return false;
  }

  public getMonthlyStats(sellerId: string, yearMonth: string): MonthlyStats | null {
    const row = this.db.prepare(
      `SELECT year_month, total_calls, total_tokens, total_cost_usd, spending_limit_usd
       FROM llm_usage_monthly WHERE seller_id = ? AND year_month = ?`
    ).get(sellerId, yearMonth) as any;
    if (!row) return null;
    return {
      yearMonth: row.year_month,
      totalCalls: row.total_calls,
      totalTokens: row.total_tokens,
      totalCostUsd: row.total_cost_usd,
      spendingLimitUsd: row.spending_limit_usd ?? null,
    };
  }

  public getAllTenantsMonthlyStats(yearMonth: string): TenantMonthlyStats[] {
    const rows = this.db.prepare(
      `SELECT seller_id, year_month, total_calls, total_tokens, total_cost_usd, spending_limit_usd
       FROM llm_usage_monthly WHERE year_month = ? ORDER BY total_cost_usd DESC`
    ).all(yearMonth) as any[];
    return rows.map((r) => ({
      sellerId: r.seller_id,
      yearMonth: r.year_month,
      totalCalls: r.total_calls,
      totalTokens: r.total_tokens,
      totalCostUsd: r.total_cost_usd,
      spendingLimitUsd: r.spending_limit_usd ?? null,
    }));
  }

  public getRecentLogs(sellerId: string, limit: number): (LLMUsageLogEntry & { createdAt: string })[] {
    const rows = this.db.prepare(
      `SELECT seller_id, channel, provider, model, tokens_in, tokens_out, tokens_estimated, cost_usd, latency_ms, created_at
       FROM llm_usage_logs WHERE seller_id = ? ORDER BY created_at DESC LIMIT ?`
    ).all(sellerId, limit) as any[];
    return rows.map((r) => ({
      sellerId: r.seller_id,
      channel: r.channel,
      provider: r.provider,
      model: r.model,
      tokensIn: r.tokens_in,
      tokensOut: r.tokens_out,
      tokensEstimated: r.tokens_estimated === 1,
      costUsd: r.cost_usd,
      latencyMs: r.latency_ms,
      createdAt: r.created_at,
    }));
  }

  public setSpendingLimit(sellerId: string, limitUsd: number | null): void {
    const yearMonth = new Date().toISOString().slice(0, 7);
    this.db.prepare(`
      INSERT INTO llm_usage_monthly (seller_id, year_month, spending_limit_usd)
      VALUES (?, ?, ?)
      ON CONFLICT(seller_id, year_month) DO UPDATE SET spending_limit_usd = excluded.spending_limit_usd
    `).run(sellerId, yearMonth, limitUsd);
  }

  public markAlertSent(sellerId: string, yearMonth: string): void {
    this.db.prepare(
      `UPDATE llm_usage_monthly SET alert_sent_at = CURRENT_TIMESTAMP WHERE seller_id = ? AND year_month = ?`
    ).run(sellerId, yearMonth);
  }

  public getGlobalProviderStats(yearMonth: string): Record<string, { calls: number; costUsd: number }> {
    const rows = this.db.prepare(`
      SELECT provider, COUNT(*) as calls, SUM(cost_usd) as cost_usd
      FROM llm_usage_logs
      WHERE strftime('%Y-%m', created_at) = ?
      GROUP BY provider
    `).all(yearMonth) as any[];
    const result: Record<string, { calls: number; costUsd: number }> = {};
    for (const r of rows) {
      result[r.provider] = { calls: r.calls, costUsd: r.cost_usd ?? 0 };
    }
    return result;
  }
}
```

- [ ] **Step 3.5: Run tests to verify they pass**

```
npx vitest run src/tests/SqliteLLMUsageRepository.test.ts
```
Expected: PASS (7 tests)

- [ ] **Step 3.6: Commit**

```bash
git add src/application/interfaces/ILLMUsageRepository.ts src/infrastructure/persistence/sqlite/SqliteLLMUsageRepository.ts src/tests/SqliteLLMUsageRepository.test.ts
git commit -m "feat: add ILLMUsageRepository and SqliteLLMUsageRepository"
```

---

## Task 4: Capture usage in LangChainLLMService + update call sites

**Files:**
- Modify: `src/application/interfaces/ILLMService.ts`
- Modify: `src/infrastructure/llm/LangChainLLMService.ts`
- Modify: `src/application/use-cases/ProcessQuestionUseCase.ts`
- Modify: `src/application/use-cases/ProcessOrderMessageUseCase.ts`
- Modify: `src/application/use-cases/SimulateQuestionUseCase.ts`
- Modify: `src/presentation/controllers/ProductsController.ts`

- [ ] **Step 4.1: Update ILLMService interface**

In `src/application/interfaces/ILLMService.ts`, add `usageContext` as an optional param to both method signatures:

```typescript
// Replace the classifyAndAnswer signature:
classifyAndAnswer(params: {
  questionText: string;
  item: Item;
  settings?: Partial<TenantSettings>;
  itemKnowledge?: ItemKnowledge | null;
  llmCredentials?: LLMCredentials | null;
  usageContext?: { sellerId: string; channel: string } | null;
}): Promise<LLMClassificationResult>;

// Replace the classifyOrderMessage signature:
classifyOrderMessage(params: {
  messageText: string;
  itemTitle?: string;
  buyerNickname?: string;
  settings?: Partial<TenantSettings>;
  orderContext?: string;
  llmCredentials?: LLMCredentials | null;
  usageContext?: { sellerId: string; channel: string } | null;
}): Promise<LLMOrderMessageResult>;
```

- [ ] **Step 4.2: Update LangChainLLMService constructor and add helpers**

Replace the class opening (constructor + cached fields) in `src/infrastructure/llm/LangChainLLMService.ts`:

```typescript
import { z } from "zod";
import { ILLMService, LLMClassificationResult, LLMOrderMessageResult } from "../../application/interfaces/ILLMService.js";
import { ILLMUsageRepository } from "../../application/interfaces/ILLMUsageRepository.js";
import { Item } from "../../domain/entities/Item.js";
import { ItemKnowledge } from "../../domain/entities/ItemKnowledge.js";
import { TenantSettings } from "../../domain/entities/Tenant.js";
import { calculateCost } from "../../domain/value-objects/LLMPricing.js";

// ... (keep existing schema definitions unchanged) ...

export class LangChainLLMService implements ILLMService {
  private cachedModel: any = null;
  private cachedProvider: string | null = null;
  private cachedOrderModel: any = null;
  private cachedOrderProvider: string | null = null;

  constructor(
    private readonly usageRepo?: ILLMUsageRepository | null,
    private readonly onLimitExceeded?: ((sellerId: string) => void) | null,
  ) {}

  private resolveProviderModel(override?: { provider: string; apiKey: string } | null): { provider: string; model: string } {
    const defaultProvider = process.env.LLM_PROVIDER ?? "groq";
    const provider = override?.provider ?? defaultProvider;
    const isOverride = Boolean(override?.provider && override.provider !== defaultProvider);
    const defaults: Record<string, string> = {
      groq: "openai/gpt-oss-120b",
      openai: "gpt-4o-mini",
      anthropic: "claude-3-5-sonnet-latest",
    };
    const model = (!isOverride && process.env.LLM_MODEL) || defaults[provider] || provider;
    return { provider, model };
  }

  private captureUsageCallbacks(): { callbacks: any[]; getTokens: () => { tokensIn: number; tokensOut: number; estimated: boolean } } {
    let tokensIn = 0;
    let tokensOut = 0;
    const callbacks = [{
      handleLLMEnd(output: any): void {
        const gen = output.generations?.[0]?.[0];
        const msgUsage = gen?.message?.usage_metadata;
        const llmUsage = output.llmOutput?.tokenUsage ?? output.llmOutput?.usage;
        if (msgUsage?.input_tokens) {
          tokensIn = msgUsage.input_tokens;
          tokensOut = msgUsage.output_tokens ?? 0;
        } else if (llmUsage?.promptTokens) {
          tokensIn = llmUsage.promptTokens;
          tokensOut = llmUsage.completionTokens ?? 0;
        } else if (llmUsage?.input_tokens) {
          tokensIn = llmUsage.input_tokens;
          tokensOut = llmUsage.output_tokens ?? 0;
        }
      },
    }];
    const getTokens = () => ({ tokensIn, tokensOut, estimated: !tokensIn });
    return { callbacks, getTokens };
  }

  private recordUsage(params: {
    usageContext: { sellerId: string; channel: string } | null | undefined;
    llmCredentials: { provider: string; apiKey: string } | null | undefined;
    tokensIn: number;
    tokensOut: number;
    estimated: boolean;
    promptText: string;
    resultText: string;
    latencyMs: number;
  }): void {
    if (!this.usageRepo || !params.usageContext) return;
    const { provider, model } = this.resolveProviderModel(params.llmCredentials);
    let { tokensIn, tokensOut, estimated } = params;
    if (!tokensIn) {
      tokensIn = Math.ceil(params.promptText.length / 4);
      tokensOut = Math.ceil(params.resultText.length / 4);
      estimated = true;
    }
    const costUsd = calculateCost(provider, model, tokensIn, tokensOut);
    const exceeded = this.usageRepo.log({
      sellerId: params.usageContext.sellerId,
      channel: params.usageContext.channel,
      provider,
      model,
      tokensIn,
      tokensOut,
      tokensEstimated: estimated,
      costUsd,
      latencyMs: params.latencyMs,
    });
    if (exceeded && this.onLimitExceeded) {
      this.onLimitExceeded(params.usageContext.sellerId);
    }
  }
```

- [ ] **Step 4.3: Update `classifyAndAnswer` to capture usage**

Replace the `classifyAndAnswer` method body in `LangChainLLMService`:

```typescript
public async classifyAndAnswer(params: {
  questionText: string;
  item: Item;
  settings?: Partial<TenantSettings>;
  itemKnowledge?: ItemKnowledge | null;
  llmCredentials?: { provider: string; apiKey: string } | null;
  usageContext?: { sellerId: string; channel: string } | null;
}): Promise<LLMClassificationResult> {
  const model = await this.getStructuredModel(params.llmCredentials);
  const systemPrompt = this.buildSystemPrompt(params.settings);
  const userPrompt = this.buildUserPrompt(params.questionText, params.item, params.itemKnowledge);

  const { callbacks, getTokens } = this.captureUsageCallbacks();
  const start = Date.now();
  const result = await model.invoke(
    [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
    { callbacks }
  );
  const latencyMs = Date.now() - start;

  const { tokensIn, tokensOut, estimated } = getTokens();
  this.recordUsage({
    usageContext: params.usageContext,
    llmCredentials: params.llmCredentials,
    tokensIn, tokensOut, estimated,
    promptText: systemPrompt + userPrompt,
    resultText: JSON.stringify(result),
    latencyMs,
  });

  return result as LLMClassificationResult;
}
```

- [ ] **Step 4.4: Update `classifyOrderMessage` to capture usage**

Replace the `classifyOrderMessage` method body in `LangChainLLMService`:

```typescript
public async classifyOrderMessage(params: {
  messageText: string;
  itemTitle?: string;
  buyerNickname?: string;
  settings?: Partial<TenantSettings>;
  orderContext?: string;
  llmCredentials?: { provider: string; apiKey: string } | null;
  usageContext?: { sellerId: string; channel: string } | null;
}): Promise<LLMOrderMessageResult> {
  const model = await this.getStructuredOrderModel(params.llmCredentials);
  const systemPrompt = this.buildOrderMessageSystemPrompt(params.settings);
  const userPrompt = `Contexto del Pedido Post-Venta:
Producto comprado: ${params.itemTitle || "Producto comprado en la tienda"}
Comprador: ${params.buyerNickname || "Comprador"}
${params.orderContext ? `Detalles adicionales: ${params.orderContext}\n` : ""}
Mensaje recibido del comprador:
"${params.messageText}"

Clasificá el mensaje post-venta y redactá la mejor respuesta según las políticas.`;

  const { callbacks, getTokens } = this.captureUsageCallbacks();
  const start = Date.now();
  const result = await model.invoke(
    [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
    { callbacks }
  );
  const latencyMs = Date.now() - start;

  const { tokensIn, tokensOut, estimated } = getTokens();
  this.recordUsage({
    usageContext: params.usageContext,
    llmCredentials: params.llmCredentials,
    tokensIn, tokensOut, estimated,
    promptText: systemPrompt + userPrompt,
    resultText: JSON.stringify(result),
    latencyMs,
  });

  return result as LLMOrderMessageResult;
}
```

- [ ] **Step 4.5: Update call sites to pass usageContext**

**`src/application/use-cases/ProcessQuestionUseCase.ts` — around line 125:**

```typescript
// Change from:
const classification = await this.llmService.classifyAndAnswer({
  questionText: question.text,
  item,
  settings,
  itemKnowledge,
  llmCredentials: tenant?.getLLMCredentials() ?? null,
});

// Change to:
const classification = await this.llmService.classifyAndAnswer({
  questionText: question.text,
  item,
  settings,
  itemKnowledge,
  llmCredentials: tenant?.getLLMCredentials() ?? null,
  usageContext: { sellerId, channel: "questions" },
});
```

**`src/application/use-cases/ProcessOrderMessageUseCase.ts` — around line 108:**

```typescript
// Change from:
const llmResult = await this.llmService.classifyOrderMessage({
  messageText,
  itemTitle,
  buyerNickname,
  settings: tenant?.settings,
  orderContext: `Orden #${orderId} - Pack #${packId}`,
  llmCredentials: tenant?.getLLMCredentials() ?? null,
});

// Change to:
const llmResult = await this.llmService.classifyOrderMessage({
  messageText,
  itemTitle,
  buyerNickname,
  settings: tenant?.settings,
  orderContext: `Orden #${orderId} - Pack #${packId}`,
  llmCredentials: tenant?.getLLMCredentials() ?? null,
  usageContext: { sellerId: params.sellerId, channel: "order_messages" },
});
```

**`src/application/use-cases/SimulateQuestionUseCase.ts` — around line 93:**

```typescript
// Change from:
const classification = await this.llmService.classifyAndAnswer({
  questionText: params.text,
  item: fakeItem,
  settings,
  llmCredentials: tenant?.getLLMCredentials() ?? null,
});

// Change to:
const classification = await this.llmService.classifyAndAnswer({
  questionText: params.text,
  item: fakeItem,
  settings,
  llmCredentials: tenant?.getLLMCredentials() ?? null,
  usageContext: { sellerId, channel: "questions" },
});
```

**`src/presentation/controllers/ProductsController.ts` — around line 178:**

```typescript
// Change from:
const result = await this.llmService.classifyAndAnswer({
  questionText: body.questionText,
  item,
  settings: tenant?.settings,
  itemKnowledge: effectiveKnowledge,
  llmCredentials: tenant?.getLLMCredentials() ?? null,
});

// Change to:
const result = await this.llmService.classifyAndAnswer({
  questionText: body.questionText,
  item,
  settings: tenant?.settings,
  itemKnowledge: effectiveKnowledge,
  llmCredentials: tenant?.getLLMCredentials() ?? null,
  usageContext: { sellerId, channel: "questions" },
});
```

- [ ] **Step 4.6: Run existing tests to make sure nothing broke**

```
npx vitest run
```
Expected: All existing tests pass.

- [ ] **Step 4.7: Commit**

```bash
git add src/application/interfaces/ILLMService.ts src/infrastructure/llm/LangChainLLMService.ts src/application/use-cases/ProcessQuestionUseCase.ts src/application/use-cases/ProcessOrderMessageUseCase.ts src/application/use-cases/SimulateQuestionUseCase.ts src/presentation/controllers/ProductsController.ts
git commit -m "feat: capture LLM token usage after every inference call"
```

---

## Task 5: Use cases + LLMUsageController

**Files:**
- Create: `src/application/use-cases/admin/GetLLMUsageStatsUseCase.ts`
- Create: `src/application/use-cases/tenant/GetTenantLLMUsageUseCase.ts`
- Create: `src/application/use-cases/tenant/SetLLMSpendingLimitUseCase.ts`
- Create: `src/presentation/controllers/LLMUsageController.ts`

- [ ] **Step 5.1: Create GetLLMUsageStatsUseCase**

```typescript
// src/application/use-cases/admin/GetLLMUsageStatsUseCase.ts
import { ILLMUsageRepository, TenantMonthlyStats } from "../../interfaces/ILLMUsageRepository.js";
import { ITenantRepository } from "../../interfaces/ITenantRepository.js";

export interface GlobalLLMUsageStats {
  yearMonth: string;
  totals: {
    totalCalls: number;
    totalTokens: number;
    totalCostUsd: number;
    byProvider: Record<string, { calls: number; costUsd: number }>;
  };
  tenants: Array<TenantMonthlyStats & { nickname?: string }>;
}

export class GetLLMUsageStatsUseCase {
  constructor(
    private readonly usageRepo: ILLMUsageRepository,
    private readonly tenantRepo: ITenantRepository,
  ) {}

  public async execute(yearMonth: string): Promise<GlobalLLMUsageStats> {
    const [tenantStats, byProvider, allTenants] = await Promise.all([
      Promise.resolve(this.usageRepo.getAllTenantsMonthlyStats(yearMonth)),
      Promise.resolve(this.usageRepo.getGlobalProviderStats(yearMonth)),
      this.tenantRepo.getAll(),
    ]);

    const nicknameMap = new Map(allTenants.map((t) => [t.sellerId, t.nickname]));
    const tenantsWithNames = tenantStats.map((t) => ({
      ...t,
      nickname: nicknameMap.get(t.sellerId),
    }));

    const totals = tenantStats.reduce(
      (acc, t) => ({
        totalCalls: acc.totalCalls + t.totalCalls,
        totalTokens: acc.totalTokens + t.totalTokens,
        totalCostUsd: acc.totalCostUsd + t.totalCostUsd,
      }),
      { totalCalls: 0, totalTokens: 0, totalCostUsd: 0 }
    );

    return { yearMonth, totals: { ...totals, byProvider }, tenants: tenantsWithNames };
  }
}
```

- [ ] **Step 5.2: Create GetTenantLLMUsageUseCase**

```typescript
// src/application/use-cases/tenant/GetTenantLLMUsageUseCase.ts
import { ILLMUsageRepository, MonthlyStats, LLMUsageLogEntry } from "../../interfaces/ILLMUsageRepository.js";

export interface TenantLLMUsageResult {
  monthly: MonthlyStats | null;
  recentLogs: (LLMUsageLogEntry & { createdAt: string })[];
  hasOwnKey: boolean;
}

export class GetTenantLLMUsageUseCase {
  constructor(private readonly usageRepo: ILLMUsageRepository) {}

  public execute(sellerId: string, yearMonth: string, hasOwnKey: boolean): TenantLLMUsageResult {
    return {
      monthly: this.usageRepo.getMonthlyStats(sellerId, yearMonth),
      recentLogs: this.usageRepo.getRecentLogs(sellerId, 20),
      hasOwnKey,
    };
  }
}
```

- [ ] **Step 5.3: Create SetLLMSpendingLimitUseCase**

```typescript
// src/application/use-cases/tenant/SetLLMSpendingLimitUseCase.ts
import { ILLMUsageRepository } from "../../interfaces/ILLMUsageRepository.js";

export class SetLLMSpendingLimitUseCase {
  constructor(private readonly usageRepo: ILLMUsageRepository) {}

  public execute(sellerId: string, limitUsd: number | null): void {
    if (limitUsd !== null && (limitUsd < 0 || !Number.isFinite(limitUsd))) {
      throw new Error("El límite debe ser un número positivo o null para eliminar.");
    }
    this.usageRepo.setSpendingLimit(sellerId, limitUsd);
  }
}
```

- [ ] **Step 5.4: Create LLMUsageController**

```typescript
// src/presentation/controllers/LLMUsageController.ts
import { FastifyRequest, FastifyReply } from "fastify";
import { GetLLMUsageStatsUseCase } from "../../application/use-cases/admin/GetLLMUsageStatsUseCase.js";
import { GetTenantLLMUsageUseCase } from "../../application/use-cases/tenant/GetTenantLLMUsageUseCase.js";
import { SetLLMSpendingLimitUseCase } from "../../application/use-cases/tenant/SetLLMSpendingLimitUseCase.js";
import { ITenantRepository } from "../../application/interfaces/ITenantRepository.js";

export class LLMUsageController {
  constructor(
    private readonly getStatsUseCase: GetLLMUsageStatsUseCase,
    private readonly getTenantUsageUseCase: GetTenantLLMUsageUseCase,
    private readonly setSpendingLimitUseCase: SetLLMSpendingLimitUseCase,
    private readonly tenantRepo: ITenantRepository,
  ) {}

  public getAdminStats = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { month } = request.query as { month?: string };
      const yearMonth = month ?? new Date().toISOString().slice(0, 7);
      const stats = await this.getStatsUseCase.execute(yearMonth);
      return reply.send(stats);
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  };

  public getTenantUsage = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = (request as any).user;
      const sellerId: string = user?.sellerId ?? "";
      const { month } = request.query as { month?: string };
      const yearMonth = month ?? new Date().toISOString().slice(0, 7);
      const tenant = sellerId ? await this.tenantRepo.findBySellerId(sellerId) : null;
      const hasOwnKey = Boolean(tenant?.settings.llmProvider && tenant?.settings.llmApiKey);
      const result = this.getTenantUsageUseCase.execute(sellerId, yearMonth, hasOwnKey);
      return reply.send(result);
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  };

  public setSpendingLimit = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = (request as any).user;
      const sellerId: string = user?.sellerId ?? "";
      const { limitUsd } = request.body as { limitUsd: number | null };
      this.setSpendingLimitUseCase.execute(sellerId, limitUsd ?? null);
      return reply.send({ ok: true });
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  };
}
```

- [ ] **Step 5.5: Commit**

```bash
git add src/application/use-cases/admin/GetLLMUsageStatsUseCase.ts src/application/use-cases/tenant/GetTenantLLMUsageUseCase.ts src/application/use-cases/tenant/SetLLMSpendingLimitUseCase.ts src/presentation/controllers/LLMUsageController.ts
git commit -m "feat: add LLM usage use cases and controller"
```

---

## Task 6: Wire everything in app.ts

**Files:**
- Modify: `src/app.ts`

- [ ] **Step 6.1: Add imports at the top of app.ts**

After the last existing import line in `src/app.ts`, add:

```typescript
import { SqliteLLMUsageRepository } from "./infrastructure/persistence/sqlite/SqliteLLMUsageRepository.js";
import { GetLLMUsageStatsUseCase } from "./application/use-cases/admin/GetLLMUsageStatsUseCase.js";
import { GetTenantLLMUsageUseCase } from "./application/use-cases/tenant/GetTenantLLMUsageUseCase.js";
import { SetLLMSpendingLimitUseCase } from "./application/use-cases/tenant/SetLLMSpendingLimitUseCase.js";
import { LLMUsageController } from "./presentation/controllers/LLMUsageController.js";
```

- [ ] **Step 6.2: Replace the LangChainLLMService instantiation and add llmUsageRepo**

In section "2. Persistencia y Seguridad" (around line 100), after `orderMessageRepo`, add:

```typescript
const llmUsageRepo = new SqliteLLMUsageRepository(db);
```

Then replace:
```typescript
const llmService = new LangChainLLMService();
```
With:
```typescript
const llmService = new LangChainLLMService(
  llmUsageRepo,
  (sellerId) => {
    tenantRepo.findBySellerId(sellerId).then((tenant) => {
      if (!tenant) return;
      const msg = `⚠️ Tu consumo de IA este mes superó el límite configurado.`;
      if (tenant.canSendTelegramAlert()) {
        telegramClient
          .sendMessage(tenant.settings.telegramAlertChatId!, msg, tenant.settings.telegramAlertBotToken)
          .catch(() => {});
      } else if (tenant.canSendEmailAlert()) {
        emailClient
          .sendGenericAlert({ to: tenant.getEmailAlertAddress()!, subject: "Límite de consumo IA alcanzado", body: msg })
          .catch(() => {});
      }
    }).catch(() => {});
  }
);
```

> Note: `emailClient.sendGenericAlert` may need to use the existing email client interface. Check `IEmailClient` methods and use the appropriate one; if none fits, use `emailClient.sendClaimAlert` or similar as a fallback, or skip email and only send telegram for now.

- [ ] **Step 6.3: Add LLM usage use cases and controller in section 6 (Admin)**

After `createTenantUseCase` in section 6:

```typescript
const getLLMUsageStatsUseCase = new GetLLMUsageStatsUseCase(llmUsageRepo, tenantRepo);
const getTenantLLMUsageUseCase = new GetTenantLLMUsageUseCase(llmUsageRepo);
const setLLMSpendingLimitUseCase = new SetLLMSpendingLimitUseCase(llmUsageRepo);
```

In section 9 (Controladores), add:

```typescript
const llmUsageCtrl = new LLMUsageController(
  getLLMUsageStatsUseCase,
  getTenantLLMUsageUseCase,
  setLLMSpendingLimitUseCase,
  tenantRepo,
);
```

- [ ] **Step 6.4: Register routes**

In section 10 (Rutas — Super Admin), add:

```typescript
app.get("/api/admin/llm-usage", { preHandler: requireSuperAdmin }, llmUsageCtrl.getAdminStats);
```

After the tenant routes block, add:

```typescript
// Rutas — LLM Usage
app.get("/api/tenant/llm-usage", { preHandler: authenticate }, llmUsageCtrl.getTenantUsage);
app.patch("/api/tenant/llm-usage/limit", { preHandler: authenticate }, llmUsageCtrl.setSpendingLimit);
```

- [ ] **Step 6.5: Start server and hit the endpoints to smoke test**

```
npx tsx src/server.ts
```

In another terminal (replace TOKEN with a valid super admin JWT from login):

```
curl -H "Authorization: Bearer TOKEN" "http://localhost:3000/api/admin/llm-usage?month=2026-09"
```

Expected: `{"yearMonth":"2026-09","totals":{"totalCalls":0,...},"tenants":[]}`

- [ ] **Step 6.6: Commit**

```bash
git add src/app.ts
git commit -m "feat: wire LLM usage repository and routes in app.ts"
```

---

## Task 7: AdminPage — "Consumo IA" section

**Files:**
- Modify: `client/src/pages/AdminPage.tsx`
- Modify: `client/src/pages/AdminPage.css`

- [ ] **Step 7.1: Add state and data fetch for LLM usage**

In `AdminPage.tsx`, add the following to the existing state declarations block:

```typescript
const [activeSection, setActiveSection] = useState<'tenants' | 'llm_usage'>('tenants')
const [llmStats, setLlmStats] = useState<any | null>(null)
const [llmMonth, setLlmMonth] = useState(() => new Date().toISOString().slice(0, 7))
const [loadingLlm, setLoadingLlm] = useState(false)
```

Add a fetch function:

```typescript
const fetchLlmStats = (month: string) => {
  setLoadingLlm(true)
  api.get<any>(`/admin/llm-usage?month=${month}`)
    .then(setLlmStats)
    .catch(console.error)
    .finally(() => setLoadingLlm(false))
}
```

Add a `useEffect` that fires when the section becomes active:

```typescript
useEffect(() => {
  if (activeSection === 'llm_usage') fetchLlmStats(llmMonth)
}, [activeSection, llmMonth])
```

- [ ] **Step 7.2: Add section tab switcher in the JSX**

Find the opening `<div>` of the admin page main content area (look for the element wrapping the tenant list and detail panels). Add a tab bar above it:

```tsx
<div className="admin-section-tabs">
  <button
    className={`admin-section-tab${activeSection === 'tenants' ? ' admin-section-tab--active' : ''}`}
    onClick={() => setActiveSection('tenants')}
  >
    Tenants
  </button>
  <button
    className={`admin-section-tab${activeSection === 'llm_usage' ? ' admin-section-tab--active' : ''}`}
    onClick={() => setActiveSection('llm_usage')}
  >
    Consumo IA
  </button>
</div>
```

Then wrap the existing tenant list + detail JSX with `{activeSection === 'tenants' && (...)}`.

- [ ] **Step 7.3: Add the LLM usage panel JSX**

After the tenants section, add:

```tsx
{activeSection === 'llm_usage' && (
  <div className="llm-usage-panel">
    <div className="llm-usage-header">
      <h3>Consumo de IA</h3>
      <input
        type="month"
        value={llmMonth}
        onChange={(e) => setLlmMonth(e.target.value)}
        className="llm-month-picker"
      />
    </div>

    {loadingLlm && <p className="llm-loading">Cargando...</p>}

    {!loadingLlm && llmStats && (
      <>
        <div className="llm-kpis">
          <div className="llm-kpi">
            <span className="llm-kpi-label">💵 Gasto total</span>
            <span className="llm-kpi-value">${llmStats.totals.totalCostUsd.toFixed(4)} USD</span>
          </div>
          <div className="llm-kpi">
            <span className="llm-kpi-label">🔢 Tokens</span>
            <span className="llm-kpi-value">{(llmStats.totals.totalTokens / 1000).toFixed(1)}K</span>
          </div>
          <div className="llm-kpi">
            <span className="llm-kpi-label">⚡ Llamadas</span>
            <span className="llm-kpi-value">{llmStats.totals.totalCalls}</span>
          </div>
          <div className="llm-kpi">
            <span className="llm-kpi-label">🤖 Providers</span>
            <span className="llm-kpi-value">
              {Object.entries(llmStats.totals.byProvider as Record<string, { calls: number; costUsd: number }>)
                .map(([p, s]) => `${p} (${s.calls})`)
                .join(' · ') || '—'}
            </span>
          </div>
        </div>

        <table className="llm-table">
          <thead>
            <tr>
              <th>Cliente</th>
              <th>Llamadas</th>
              <th>Tokens</th>
              <th>Costo USD</th>
              <th>Límite</th>
            </tr>
          </thead>
          <tbody>
            {llmStats.tenants.length === 0 && (
              <tr><td colSpan={5} className="llm-empty">Sin datos para este mes</td></tr>
            )}
            {llmStats.tenants.map((t: any) => (
              <tr key={t.sellerId}>
                <td>{t.nickname ?? t.sellerId}</td>
                <td>{t.totalCalls}</td>
                <td>{(t.totalTokens / 1000).toFixed(1)}K</td>
                <td>${t.totalCostUsd.toFixed(4)}</td>
                <td>{t.spendingLimitUsd != null ? `$${t.spendingLimitUsd}` : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </>
    )}
  </div>
)}
```

- [ ] **Step 7.4: Add CSS in AdminPage.css**

Append to the end of `client/src/pages/AdminPage.css`:

```css
.admin-section-tabs {
  display: flex;
  gap: 4px;
  margin-bottom: 20px;
  border-bottom: 1px solid var(--border);
  padding-bottom: 0;
}

.admin-section-tab {
  background: none;
  border: none;
  padding: 8px 16px;
  cursor: pointer;
  font-size: 0.875rem;
  color: var(--text-dim);
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
  transition: color 0.15s;
}

.admin-section-tab--active {
  color: var(--text);
  border-bottom-color: var(--accent);
  font-weight: 600;
}

.llm-usage-panel {
  padding: 0 4px;
}

.llm-usage-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.llm-usage-header h3 {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
}

.llm-month-picker {
  padding: 4px 8px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--surface);
  color: var(--text);
  font-size: 0.85rem;
}

.llm-kpis {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 12px;
  margin-bottom: 20px;
}

.llm-kpi {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.llm-kpi-label {
  font-size: 0.74rem;
  color: var(--text-dim);
}

.llm-kpi-value {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text);
}

.llm-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.85rem;
}

.llm-table th,
.llm-table td {
  padding: 8px 12px;
  text-align: left;
  border-bottom: 1px solid var(--border);
}

.llm-table th {
  color: var(--text-dim);
  font-weight: 500;
}

.llm-empty {
  text-align: center;
  color: var(--text-dim);
  padding: 24px;
}

.llm-loading {
  color: var(--text-dim);
  font-size: 0.875rem;
}
```

- [ ] **Step 7.5: Build the client and verify no TypeScript errors**

```
cd client && npm run build
```
Expected: Builds cleanly.

- [ ] **Step 7.6: Commit**

```bash
git add client/src/pages/AdminPage.tsx client/src/pages/AdminPage.css
git commit -m "feat: add Consumo IA section to admin panel"
```

---

## Task 8: TenantPage — "Consumo IA" tab + LLMUsageCard

**Files:**
- Create: `client/src/components/LLMUsageCard.tsx`
- Create: `client/src/components/LLMUsageCard.css`
- Modify: `client/src/pages/TenantPage.tsx`

- [ ] **Step 8.1: Create LLMUsageCard component**

```tsx
// client/src/components/LLMUsageCard.tsx
import { useState, useEffect } from 'react'
import { api } from '../api/client'
import './LLMUsageCard.css'

interface MonthlyStats {
  yearMonth: string
  totalCalls: number
  totalTokens: number
  totalCostUsd: number
  spendingLimitUsd: number | null
}

interface LogEntry {
  channel: string
  provider: string
  model: string
  tokensIn: number
  tokensOut: number
  tokensEstimated: boolean
  costUsd: number
  latencyMs: number
  createdAt: string
}

interface UsageData {
  monthly: MonthlyStats | null
  recentLogs: LogEntry[]
  hasOwnKey: boolean
}

export default function LLMUsageCard() {
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7))
  const [data, setData] = useState<UsageData | null>(null)
  const [loading, setLoading] = useState(true)
  const [limitInput, setLimitInput] = useState('')
  const [editingLimit, setEditingLimit] = useState(false)
  const [savingLimit, setSavingLimit] = useState(false)

  useEffect(() => {
    setLoading(true)
    api.get<UsageData>(`/tenant/llm-usage?month=${month}`)
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [month])

  const saveLimit = async () => {
    setSavingLimit(true)
    try {
      const limitUsd = limitInput === '' ? null : parseFloat(limitInput)
      await api.patch('/tenant/llm-usage/limit', { limitUsd })
      setEditingLimit(false)
      const refreshed = await api.get<UsageData>(`/tenant/llm-usage?month=${month}`)
      setData(refreshed)
    } catch (e) {
      console.error(e)
    } finally {
      setSavingLimit(false)
    }
  }

  if (!data && !loading) return null

  if (!data?.hasOwnKey) {
    return (
      <div className="llm-usage-card llm-usage-card--shared">
        <p className="llm-usage-shared-msg">
          Usás el modelo compartido de la plataforma — el costo no aplica a tu cuenta.
        </p>
      </div>
    )
  }

  const monthly = data.monthly
  const limit = monthly?.spendingLimitUsd ?? null
  const pct = monthly && limit ? Math.min((monthly.totalCostUsd / limit) * 100, 100) : null

  return (
    <div className="llm-usage-card">
      <div className="llm-usage-card-header">
        <h4>Consumo de IA</h4>
        <input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="llm-month-picker"
        />
      </div>

      {loading && <p className="llm-loading">Cargando...</p>}

      {!loading && monthly && (
        <>
          <div className="llm-stats-row">
            <span>{monthly.totalCalls} llamadas</span>
            <span>{(monthly.totalTokens / 1000).toFixed(1)}K tokens</span>
            <span className="llm-cost">${monthly.totalCostUsd.toFixed(4)} USD</span>
          </div>

          {pct !== null && (
            <div className="llm-progress-wrap">
              <div className="llm-progress-bar">
                <div className="llm-progress-fill" style={{ width: `${pct}%`, backgroundColor: pct > 85 ? '#ef4444' : 'var(--accent)' }} />
              </div>
              <span className="llm-progress-label">{pct.toFixed(0)}% de ${limit} USD</span>
            </div>
          )}

          {!editingLimit ? (
            <button
              className="llm-limit-btn"
              onClick={() => { setLimitInput(limit != null ? String(limit) : ''); setEditingLimit(true) }}
            >
              {limit != null ? `Límite de alerta: $${limit} USD` : 'Configurar límite de alerta'}
            </button>
          ) : (
            <div className="llm-limit-edit">
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="USD (vacío = sin límite)"
                value={limitInput}
                onChange={(e) => setLimitInput(e.target.value)}
                className="llm-limit-input"
              />
              <button onClick={saveLimit} disabled={savingLimit} className="llm-limit-save">
                {savingLimit ? 'Guardando...' : 'Guardar'}
              </button>
              <button onClick={() => setEditingLimit(false)} className="llm-limit-cancel">Cancelar</button>
            </div>
          )}
        </>
      )}

      {!loading && !monthly && (
        <p className="llm-no-data">Sin llamadas de IA registradas en {month}.</p>
      )}

      {!loading && data.recentLogs.length > 0 && (
        <details className="llm-logs">
          <summary>Últimas {data.recentLogs.length} llamadas</summary>
          <table className="llm-log-table">
            <thead>
              <tr><th>Canal</th><th>Modelo</th><th>Tokens</th><th>Costo</th><th>Fecha</th></tr>
            </thead>
            <tbody>
              {data.recentLogs.map((log, i) => (
                <tr key={i}>
                  <td>{log.channel}</td>
                  <td>{log.model}{log.tokensEstimated && <span className="llm-est" title="estimado">~</span>}</td>
                  <td>{log.tokensIn + log.tokensOut}</td>
                  <td>${log.costUsd.toFixed(6)}</td>
                  <td>{new Date(log.createdAt).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}
    </div>
  )
}
```

- [ ] **Step 8.2: Create LLMUsageCard.css**

```css
/* client/src/components/LLMUsageCard.css */
.llm-usage-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 16px 18px;
  margin-top: 16px;
}

.llm-usage-card--shared {
  padding: 12px 16px;
}

.llm-usage-shared-msg {
  margin: 0;
  color: var(--text-dim);
  font-size: 0.85rem;
}

.llm-usage-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.llm-usage-card-header h4 {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 600;
}

.llm-month-picker {
  padding: 3px 7px;
  border: 1px solid var(--border);
  border-radius: 5px;
  background: var(--bg);
  color: var(--text);
  font-size: 0.8rem;
}

.llm-stats-row {
  display: flex;
  gap: 16px;
  font-size: 0.875rem;
  margin-bottom: 10px;
  flex-wrap: wrap;
}

.llm-cost {
  font-weight: 600;
  color: var(--text);
}

.llm-progress-wrap {
  margin-bottom: 12px;
}

.llm-progress-bar {
  height: 6px;
  background: var(--border);
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 4px;
}

.llm-progress-fill {
  height: 100%;
  border-radius: 4px;
  transition: width 0.3s;
}

.llm-progress-label {
  font-size: 0.75rem;
  color: var(--text-dim);
}

.llm-limit-btn {
  background: none;
  border: 1px dashed var(--border);
  border-radius: 6px;
  padding: 6px 10px;
  font-size: 0.8rem;
  color: var(--text-dim);
  cursor: pointer;
  width: 100%;
  text-align: left;
  transition: border-color 0.15s;
}

.llm-limit-btn:hover {
  border-color: var(--accent);
  color: var(--text);
}

.llm-limit-edit {
  display: flex;
  gap: 6px;
  align-items: center;
  flex-wrap: wrap;
}

.llm-limit-input {
  flex: 1;
  min-width: 120px;
  padding: 5px 8px;
  border: 1px solid var(--border);
  border-radius: 5px;
  background: var(--bg);
  color: var(--text);
  font-size: 0.85rem;
}

.llm-limit-save {
  padding: 5px 12px;
  background: var(--accent);
  color: white;
  border: none;
  border-radius: 5px;
  font-size: 0.8rem;
  cursor: pointer;
}

.llm-limit-cancel {
  padding: 5px 10px;
  background: none;
  border: 1px solid var(--border);
  border-radius: 5px;
  font-size: 0.8rem;
  cursor: pointer;
  color: var(--text-dim);
}

.llm-no-data {
  font-size: 0.85rem;
  color: var(--text-dim);
  margin: 8px 0 0;
}

.llm-loading {
  font-size: 0.85rem;
  color: var(--text-dim);
}

.llm-logs {
  margin-top: 14px;
  font-size: 0.8rem;
}

.llm-logs summary {
  cursor: pointer;
  color: var(--text-dim);
  user-select: none;
  margin-bottom: 6px;
}

.llm-log-table {
  width: 100%;
  border-collapse: collapse;
}

.llm-log-table th,
.llm-log-table td {
  padding: 5px 8px;
  text-align: left;
  border-bottom: 1px solid var(--border);
}

.llm-log-table th {
  color: var(--text-dim);
  font-weight: 500;
}

.llm-est {
  margin-left: 3px;
  color: var(--text-dim);
  font-size: 0.75rem;
}
```

- [ ] **Step 8.3: Add "Consumo IA" tab to TenantPage**

In `client/src/pages/TenantPage.tsx`, find the tabs array (around line 108-113):

```typescript
// Change from:
const TABS = [
  { id: 'settings',   label: 'Configuración',       icon: <Settings size={15} /> },
  { id: 'channels',   label: 'Canales & Alertas',   icon: <Radio size={15} /> },
  { id: 'team',       label: 'Equipo & Vendedores',  icon: <Users size={15} /> },
  { id: 'connection', label: 'Conexión MELI',        icon: <RefreshCw size={15} /> },
]

// Change to:
const TABS = [
  { id: 'settings',   label: 'Configuración',       icon: <Settings size={15} /> },
  { id: 'channels',   label: 'Canales & Alertas',   icon: <Radio size={15} /> },
  { id: 'team',       label: 'Equipo & Vendedores',  icon: <Users size={15} /> },
  { id: 'connection', label: 'Conexión MELI',        icon: <RefreshCw size={15} /> },
  { id: 'ia_usage',   label: 'Consumo IA',           icon: <Sparkles size={15} /> },
]
```

Note: `Sparkles` is already imported in TenantPage. If it isn't, add `import { ..., Sparkles } from 'lucide-react'`.

- [ ] **Step 8.4: Add the tab content section in TenantPage JSX**

After the last existing `{activeTab === 'connection' && (...)}` block, add:

```tsx
{activeTab === 'ia_usage' && (
  <div className="config-section">
    <LLMUsageCard />
  </div>
)}
```

Add the import at the top of TenantPage.tsx:

```typescript
import LLMUsageCard from '../components/LLMUsageCard'
```

- [ ] **Step 8.5: Build client and verify no TypeScript errors**

```
cd client && npm run build
```
Expected: Builds cleanly.

- [ ] **Step 8.6: Run full test suite**

```
npx vitest run
```
Expected: All tests pass.

- [ ] **Step 8.7: Commit**

```bash
git add client/src/components/LLMUsageCard.tsx client/src/components/LLMUsageCard.css client/src/pages/TenantPage.tsx
git commit -m "feat: add Consumo IA tab to tenant panel with usage card"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Task |
|---|---|
| `llm_usage_logs` table | Task 2 |
| `llm_usage_monthly` table | Task 2 |
| LLM pricing table in code | Task 1 |
| Token capture via LangChain callbacks | Task 4 |
| Estimated tokens fallback (chars/4) | Task 4 — `recordUsage` |
| `tokensEstimated` flag in log | Task 3 + Task 4 |
| Cost calculation | Task 1 + Task 4 |
| Spending limit set by tenant | Task 5 (`SetLLMSpendingLimitUseCase`) |
| Alert on limit exceeded | Task 4 (`onLimitExceeded`) + Task 6 (callback in app.ts) |
| Alert only once per day | Task 3 (`log()` checks `alert_sent_at`) |
| Super Admin endpoint | Task 5 + Task 6 |
| Tenant endpoint | Task 5 + Task 6 |
| Super Admin KPIs + table | Task 7 |
| Tenant progress bar + limit edit | Task 8 |
| Platform shared model message | Task 8 (`hasOwnKey: false` branch) |
| Month selector on both views | Task 7 + Task 8 |
| Provider breakdown for admin | Task 3 (`getGlobalProviderStats`) + Task 5 |

All requirements covered. ✅
