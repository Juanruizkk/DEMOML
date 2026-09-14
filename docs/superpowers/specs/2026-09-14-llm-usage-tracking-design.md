# LLM Usage Tracking — Design Spec

**Date:** 2026-09-14  
**Status:** Approved

## Context

Each tenant brings their own LLM API key (BYOK model). The platform supports groq, openai, and anthropic providers configured per-tenant in `settings.llmProvider` / `settings.llmApiKey`. Currently, no token usage or cost data is captured after LLM inference calls.

This feature adds per-call logging and monthly aggregation so that:
- The **Super Admin** can monitor global AI consumption and see a breakdown per tenant.
- Each **Tenant** can see their own monthly usage and set a personal spending alert limit.

## Database

Two new tables added to SQLite via `SqliteDatabase.initSchema()`.

### `llm_usage_logs`
One row per LLM inference call.

| Column | Type | Notes |
|---|---|---|
| id | INTEGER PK AUTOINCREMENT | |
| seller_id | TEXT NOT NULL | |
| channel | TEXT NOT NULL | `questions` \| `order_messages` \| `claims` \| `telegram` |
| provider | TEXT NOT NULL | `groq` \| `openai` \| `anthropic` |
| model | TEXT NOT NULL | e.g. `llama-3.3-70b-versatile` |
| tokens_in | INTEGER | |
| tokens_out | INTEGER | |
| tokens_estimated | INTEGER DEFAULT 0 | `1` if tokens were estimated (chars/4), `0` if real |
| cost_usd | REAL | |
| latency_ms | INTEGER | |
| created_at | DATETIME DEFAULT CURRENT_TIMESTAMP | |

Index: `idx_llm_usage_seller_date ON llm_usage_logs(seller_id, created_at)`

### `llm_usage_monthly`
One row per tenant per calendar month. Upserted on every call.

| Column | Type | Notes |
|---|---|---|
| id | INTEGER PK AUTOINCREMENT | |
| seller_id | TEXT NOT NULL | |
| year_month | TEXT NOT NULL | e.g. `2026-09` |
| total_calls | INTEGER DEFAULT 0 | |
| total_tokens | INTEGER DEFAULT 0 | |
| total_cost_usd | REAL DEFAULT 0.0 | |
| spending_limit_usd | REAL | NULL = no limit set |
| alert_sent_at | DATETIME | Prevents repeated alerts within same day |
| UNIQUE(seller_id, year_month) | | |

## Pricing Table

Maintained in code at `src/domain/value-objects/LLMPricing.ts`. Cost per million tokens (USD):

```typescript
export const LLM_PRICING: Record<string, { input: number; output: number }> = {
  "groq/llama-3.3-70b-versatile": { input: 0.59,  output: 0.79  },
  "groq/llama-3.1-8b-instant":    { input: 0.05,  output: 0.08  },
  "openai/gpt-4o-mini":           { input: 0.15,  output: 0.60  },
  "openai/gpt-4o":                { input: 2.50,  output: 10.00 },
  "anthropic/claude-3-5-sonnet":  { input: 3.00,  output: 15.00 },
  "anthropic/claude-3-haiku":     { input: 0.25,  output: 1.25  },
};
// Fallback for unknown models: { input: 0, output: 0 } — cost logged as 0
```

Token estimation fallback when `usage_metadata` is unavailable: `Math.ceil(text.length / 4)`.

## Backend Architecture

### New Interface: `ILLMUsageRepository`
Location: `src/application/interfaces/ILLMUsageRepository.ts`

```typescript
interface LLMUsageLogEntry {
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

interface MonthlyStats {
  yearMonth: string;
  totalCalls: number;
  totalTokens: number;
  totalCostUsd: number;
  spendingLimitUsd: number | null;
}

interface TenantMonthlyStats extends MonthlyStats {
  sellerId: string;
  nickname?: string;
  provider?: string;
}

interface ILLMUsageRepository {
  log(entry: LLMUsageLogEntry): void;
  getMonthlyStats(sellerId: string, yearMonth: string): MonthlyStats | null;
  getAllTenantsMonthlyStats(yearMonth: string): TenantMonthlyStats[];
  getRecentLogs(sellerId: string, limit: number): LLMUsageLogEntry[];
  setSpendingLimit(sellerId: string, limitUsd: number | null): void;
  getAlertSentAt(sellerId: string, yearMonth: string): Date | null;
  markAlertSent(sellerId: string, yearMonth: string): void;
}
```

### New Implementation: `SqliteLLMUsageRepository`
Location: `src/infrastructure/persistence/sqlite/SqliteLLMUsageRepository.ts`

Implements `ILLMUsageRepository` using better-sqlite3 synchronous API (consistent with existing repositories). The `log()` method performs two operations in a single transaction:
1. `INSERT INTO llm_usage_logs`
2. `INSERT OR REPLACE INTO llm_usage_monthly ... ON CONFLICT DO UPDATE SET ...` (upsert)

### Changes to `LangChainLLMService`
Location: `src/infrastructure/llm/LangChainLLMService.ts`

- Constructor receives an optional `ILLMUsageRepository | null` and the `sellerId` for each call.
- After each `model.invoke()`, extract `result.usage_metadata` (LangChain standard field).
- If `usage_metadata` is absent or zero, estimate tokens from prompt + response text length.
- Calculate `cost_usd` using `LLM_PRICING`.
- Call `usageRepo.log(entry)` synchronously (better-sqlite3 is sync).
- Check if monthly total now exceeds `spending_limit_usd` and `alert_sent_at` is not today → fire alert via tenant's preferred channel.

The `channel` parameter is passed in from the call site (use case). Both `classifyAndAnswer` and `classifyOrderMessage` receive an additional optional `{ sellerId: string; channel: string }` param.

### `ILLMService` Interface Update
Add optional `usageContext?: { sellerId: string; channel: string }` to both method signatures. Existing callers without this param continue working — usage simply won't be logged for that call.

### Alert on Spending Limit
When `total_cost_usd >= spending_limit_usd` after an upsert:
1. Check `alert_sent_at` — if already sent today, skip.
2. Look up tenant's preferred alert channel (telegram, email, whatsapp).
3. Send message: "⚠️ Tu consumo de IA este mes superó el límite configurado de $X USD."
4. Call `markAlertSent()`.

The alert is fire-and-forget (no await chain blocking the LLM response).

### New REST Endpoints

**Super Admin:**
```
GET /api/admin/llm-usage?month=2026-09
→ { tenants: TenantMonthlyStats[], totals: { calls, tokens, costUsd, byProvider } }
```

**Tenant:**
```
GET /api/tenant/llm-usage?month=2026-09
→ { monthly: MonthlyStats, recentLogs: LLMUsageLogEntry[] }

PATCH /api/tenant/llm-usage/limit
Body: { limitUsd: number | null }
→ 200 OK
```

Both tenant endpoints are guarded by the existing JWT auth middleware. The tenant endpoint uses `req.user.sellerId` to scope the query — a tenant cannot query another tenant's data.

## Frontend

### Super Admin — new tab "Consumo IA" in `/admin`

Added as a new tab alongside existing tabs. Loaded lazily on tab focus.

**KPI row (top):**
- Total gastado este mes (USD)
- Total tokens procesados
- Costo promedio por llamada
- Distribución por proveedor (Groq X% · OpenAI Y% · Anthropic Z%)

**Table per tenant:**
| Cliente | Modelo | Llamadas | Tokens | Costo USD |
|---|---|---|---|---|
| Juan Ruiz | groq/llama | 1.240 | 890K | $0.62 |

Month selector (current month default, can go back to previous months).

### Tenant — new card "Mi consumo de IA"

Location: tenant settings panel, below the LLM integration section.

Shows:
- Month name, total calls, total tokens, total cost USD.
- Progress bar toward spending limit (if set): `████████░░ 62% de $1.00 USD`.
- "Cambiar límite de alerta" button → inline input to set/clear the limit.

If the tenant has no `llmProvider` configured (using platform shared model), the card shows: *"Usás el modelo compartido de la plataforma — el costo no aplica a tu cuenta."*

Month selector included (same as admin view).

## Out of Scope

- Per-item or per-question cost breakdown in the questions table.
- Hard spending caps that block inference (only soft alerts).
- CSV/export of logs.
- Retention policy for `llm_usage_logs` (keep all rows indefinitely for now).
