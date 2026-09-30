# SaaS Plans & Quota Enforcement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the multi-tenant system into a SaaS product with 3 paid plans (Starter/Pro/Business), enforcing LLM response quotas, feature gating by plan, 80% warning notifications, and a 12-hour grace period before pausing the bot.

**Architecture:** Add `llmResponsesThisMonth`, `monthlyLLMLimit`, `llmQuotaExhaustedAt`, `billingStatus`, and `nextBillingDate` to the Tenant entity. A `PLAN_LIMITS` constant drives all quota and feature gating logic. Quota enforcement is applied in `ProcessQuestionUseCase` and `ProcessOrderMessageUseCase` before every LLM call. Admin gains a new `UpdateTenantPlanUseCase` and UI controls.

**Tech Stack:** TypeScript, Vitest, Fastify, Drizzle ORM (Postgres), React + TailwindCSS (AdminPage)

---

## Files Changed

| Action | Path | Responsibility |
|---|---|---|
| Modify | `src/domain/entities/Tenant.ts` | Add SaaS fields, PLAN_LIMITS, quota methods |
| Modify | `src/application/use-cases/questions/ProcessQuestionUseCase.ts` | Enforce LLM quota pre-sale |
| Modify | `src/application/use-cases/order-messages/ProcessOrderMessageUseCase.ts` | Enforce LLM quota post-sale |
| Modify | `src/application/use-cases/claims/IngestClaimWebhookUseCase.ts` | Gate claims by plan |
| Create | `src/application/use-cases/admin/UpdateTenantPlanUseCase.ts` | Admin: update plan + billing |
| Modify | `src/presentation/controllers/AdminController.ts` | Wire UpdateTenantPlanUseCase |
| Modify | `src/presentation/routes/adminRoutes.ts` | Add `PUT /admin/tenants/:sellerId/plan` |
| Modify | `src/infrastructure/persistence/drizzle/schema.ts` | Add billingStatus + nextBillingDate columns |
| Create | `src/infrastructure/persistence/drizzle/migrations/<timestamp>_saas_billing.sql` | DB migration |
| Modify | `client/src/pages/AdminPage.tsx` | Plan selector + billing status UI |
| Create | `tests/domain/Tenant.saas.test.ts` | Tests for new quota methods |
| Create | `tests/admin/UpdateTenantPlanUseCase.test.ts` | Tests for plan update use case |
| Modify | `tests/application/ProcessQuestionUseCase.test.ts` | Add quota enforcement tests |

---

## Task 1: Extend Tenant entity with SaaS fields and quota logic

**Files:**
- Modify: `src/domain/entities/Tenant.ts`
- Create: `tests/domain/Tenant.saas.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/domain/Tenant.saas.test.ts`:

```typescript
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
    const justNow = new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(); // 1h ago
    const tenant = makeTenant({
      llmResponsesThisMonth: 300,
      monthlyLLMLimit: 300,
      llmQuotaExhaustedAt: justNow,
    });
    expect(tenant.canAutoAnswer()).toBe(true);
  });

  it("returns false when quota exhausted for more than 12h", () => {
    const longAgo = new Date(Date.now() - 13 * 60 * 60 * 1000).toISOString(); // 13h ago
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
```

- [ ] **Step 2: Run tests to verify they fail**

```powershell
npm test -- --reporter=verbose tests/domain/Tenant.saas.test.ts
```

Expected: FAIL — `PLAN_LIMITS`, `incrementLLMResponses`, `isLLMQuotaAtWarning`, `canAutoAnswer`, `canAccessClaims`, `canAccessWhatsApp` not defined.

- [ ] **Step 3: Implement SaaS fields in Tenant.ts**

In `src/domain/entities/Tenant.ts`, make these changes:

**a) Add `PLAN_LIMITS` export before the interfaces:**

```typescript
export interface PlanFeatures {
  llmResponsesPerMonth: number;
  claimsEnabled: boolean;
  whatsappEnabled: boolean;
}

export const PLAN_LIMITS: Record<string, PlanFeatures> = {
  starter:    { llmResponsesPerMonth: 300,      claimsEnabled: false, whatsappEnabled: false },
  pro:        { llmResponsesPerMonth: 1_000,    claimsEnabled: true,  whatsappEnabled: false },
  business:   { llmResponsesPerMonth: 5_000,    claimsEnabled: true,  whatsappEnabled: true  },
  enterprise: { llmResponsesPerMonth: Infinity, claimsEnabled: true,  whatsappEnabled: true  },
};
```

**b) Update `planId` union type in `TenantSettings`:**

```typescript
planId: "starter" | "pro" | "business" | "enterprise";
```

**c) Add new fields to `TenantSettings` interface (after existing `planId`/`monthlyAlertsLimit` block):**

```typescript
// LLM quota
monthlyLLMLimit: number;
llmResponsesThisMonth: number;
llmQuotaExhaustedAt: string | null;

// Billing
billingStatus: "active" | "overdue" | "cancelled";
nextBillingDate: string;
```

**d) Add new methods to the `Tenant` class (after `incrementAlertsSent`):**

```typescript
public incrementLLMResponses(): void {
  const newCount = this.settings.llmResponsesThisMonth + 1;
  const justExhausted =
    newCount >= this.settings.monthlyLLMLimit &&
    !this.settings.llmQuotaExhaustedAt;

  this.settings = {
    ...this.settings,
    llmResponsesThisMonth: newCount,
    llmQuotaExhaustedAt: justExhausted
      ? new Date().toISOString()
      : this.settings.llmQuotaExhaustedAt,
  };
  this.updatedAt = new Date();
}

public isLLMQuotaAtWarning(): boolean {
  if (this.settings.llmQuotaExhaustedAt) return false;
  return (
    this.settings.llmResponsesThisMonth / this.settings.monthlyLLMLimit >= 0.8
  );
}

public canAutoAnswer(): void {
  if (this.settings.billingStatus !== "active") return false;
  if (!this.settings.llmQuotaExhaustedAt) return true;

  const exhaustedAt = new Date(this.settings.llmQuotaExhaustedAt).getTime();
  const twelveHoursMs = 12 * 60 * 60 * 1000;
  return Date.now() - exhaustedAt < twelveHoursMs;
}

public canAccessClaims(): boolean {
  return PLAN_LIMITS[this.settings.planId]?.claimsEnabled ?? false;
}

public canAccessWhatsApp(): boolean {
  return PLAN_LIMITS[this.settings.planId]?.whatsappEnabled ?? false;
}
```

> Note: fix the return type of `canAutoAnswer` — it should be `boolean`, not `void`.

**e) Update `createDefault` — add new fields inside `settings`:**

```typescript
monthlyLLMLimit: PLAN_LIMITS["starter"].llmResponsesPerMonth,
llmResponsesThisMonth: 0,
llmQuotaExhaustedAt: null,
billingStatus: "active",
nextBillingDate: nextMonth.toISOString(),
```

- [ ] **Step 4: Run tests to verify they pass**

```powershell
npm test -- --reporter=verbose tests/domain/Tenant.saas.test.ts
```

Expected: All tests PASS.

- [ ] **Step 5: Run full test suite to check for regressions**

```powershell
npm test
```

Expected: All existing tests pass. If `tests/domain/Tenant.test.ts` fails because `createDefault` now requires new fields — the defaults are added in `createDefault`, so existing tests should pass without changes. Fix any TypeScript errors in test helpers that build `TenantSettings` manually by adding the new required fields.

- [ ] **Step 6: Commit**

```powershell
git add src/domain/entities/Tenant.ts tests/domain/Tenant.saas.test.ts
git commit -m "feat: add SaaS plan limits, LLM quota, and billing fields to Tenant entity"
```

---

## Task 2: Enforce LLM quota in ProcessQuestionUseCase (pre-sale)

**Files:**
- Modify: `src/application/use-cases/questions/ProcessQuestionUseCase.ts`
- Modify: `tests/application/ProcessQuestionUseCase.test.ts`

- [ ] **Step 1: Write failing tests**

Add the following describe block to `tests/application/ProcessQuestionUseCase.test.ts`. The `makeTenant` helper there uses `Tenant.createDefault` — update its mock tenant to include the new SaaS fields, then add:

```typescript
describe("LLM quota enforcement", () => {
  it("skips LLM call and marks requires_human when quota is exhausted and grace has expired", async () => {
    const longAgo = new Date(Date.now() - 13 * 60 * 60 * 1000).toISOString();
    const exhaustedTenant = Tenant.createDefault({
      id: "t-001", sellerId: "seller_123",
      accessToken: "tok", refreshToken: "ref", expiresInSec: 3600,
    });
    exhaustedTenant.updateSettings({
      llmResponsesThisMonth: 300,
      monthlyLLMLimit: 300,
      llmQuotaExhaustedAt: longAgo,
      billingStatus: "active",
      nextBillingDate: new Date().toISOString(),
    });

    mockTenantRepo.findBySellerId.mockResolvedValue(exhaustedTenant);

    const result = await useCase.execute({ questionId: "q-1", sellerId: "seller_123" });

    expect(mockLlmService.classifyAndAnswer).not.toHaveBeenCalled();
    expect(result?.appStatus).toBe("requires_human");
  });

  it("increments llmResponsesThisMonth after a successful auto-answer", async () => {
    const saveSpy = vi.fn().mockResolvedValue(undefined);
    mockTenantRepo.save = saveSpy;

    await useCase.execute({ questionId: "q-1", sellerId: "seller_123" });

    expect(saveSpy).toHaveBeenCalled();
    const savedTenant: Tenant = saveSpy.mock.calls[0][0];
    expect(savedTenant.settings.llmResponsesThisMonth).toBe(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```powershell
npm test -- --reporter=verbose tests/application/ProcessQuestionUseCase.test.ts
```

Expected: FAIL — quota check and increment not yet implemented.

- [ ] **Step 3: Implement quota enforcement in ProcessQuestionUseCase**

In `src/application/use-cases/questions/ProcessQuestionUseCase.ts`, locate step 5 (LLM classification, around line 119). Add the quota check **before** the LLM call and the increment **after**:

```typescript
// 5a. Check LLM quota before calling
if (tenant && !tenant.canAutoAnswer()) {
  question.requiresHuman = true;
  question.reason = "Cuota mensual de respuestas agotada";
  question.appStatus = "requires_human";
  await this.questionRepo.save(question);
  await this.eventRepo.log(
    new EventLog({
      sellerId,
      questionId,
      type: "quota_exceeded",
      message: `⛔ Cuota LLM agotada. Pregunta requiere revisión humana.`,
    })
  );
  this.realtimeNotifier.broadcastToSeller(sellerId, "question_updated", question);
  return question;
}

// 5b. [existing LLM call]
t0 = Date.now();
const classification = await this.llmService.classifyAndAnswer({ ... });
const classifyMs = Date.now() - t0;
```

Then **after** the LLM call completes and `classification` is available, add:

```typescript
// 5c. Increment LLM usage counter
if (tenant) {
  const wasAtWarning = tenant.isLLMQuotaAtWarning();
  tenant.incrementLLMResponses();
  await this.tenantRepo.save(tenant);

  if (!wasAtWarning && tenant.isLLMQuotaAtWarning()) {
    await this.eventRepo.log(
      new EventLog({
        sellerId,
        questionId,
        type: "quota_warning",
        message: `⚠️ Usaste el 80% de tus respuestas mensuales (${tenant.settings.llmResponsesThisMonth}/${tenant.settings.monthlyLLMLimit}).`,
      })
    );
  }

  if (tenant.settings.llmQuotaExhaustedAt) {
    await this.eventRepo.log(
      new EventLog({
        sellerId,
        questionId,
        type: "quota_exhausted",
        message: `🚨 Límite mensual alcanzado (${tenant.settings.monthlyLLMLimit} respuestas). El bot pausará automáticamente en 12 horas.`,
      })
    );
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```powershell
npm test -- --reporter=verbose tests/application/ProcessQuestionUseCase.test.ts
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/application/use-cases/questions/ProcessQuestionUseCase.ts tests/application/ProcessQuestionUseCase.test.ts
git commit -m "feat: enforce LLM quota in ProcessQuestionUseCase with 12h grace period"
```

---

## Task 3: Enforce LLM quota in ProcessOrderMessageUseCase (post-sale)

**Files:**
- Modify: `src/application/use-cases/order-messages/ProcessOrderMessageUseCase.ts`

- [ ] **Step 1: Locate the LLM call**

Open `src/application/use-cases/order-messages/ProcessOrderMessageUseCase.ts`. Find where `this.llmService.classifyOrderMessage(...)` is called (around line 105).

- [ ] **Step 2: Add quota check before the LLM call**

Apply the same pattern as Task 2 Step 3. Before `this.llmService.classifyOrderMessage(...)`:

```typescript
if (tenant && !tenant.canAutoAnswer()) {
  // mark message as requires_human and return early
  orderMessage.requiresHuman = true;
  orderMessage.appStatus = "requires_human";
  await this.orderMessageRepo.save(orderMessage);
  await this.eventRepo.log(
    new EventLog({
      sellerId,
      type: "quota_exceeded",
      message: `⛔ Cuota LLM agotada. Mensaje post-venta requiere revisión humana.`,
    })
  );
  this.realtimeNotifier.broadcastToSeller(sellerId, "order_message_updated", orderMessage);
  return orderMessage;
}
```

- [ ] **Step 3: Add increment after the LLM call**

After `classifyOrderMessage` completes, mirror the same counter + warning logic from Task 2 Step 3 (same code block, copy verbatim replacing `questionId` context with the order message equivalent).

- [ ] **Step 4: Run full test suite**

```powershell
npm test
```

Expected: All tests pass. Fix any TypeScript errors about `orderMessage.requiresHuman` or `appStatus` not existing — check the `OrderMessage` entity for the correct field names.

- [ ] **Step 5: Commit**

```powershell
git add src/application/use-cases/order-messages/ProcessOrderMessageUseCase.ts
git commit -m "feat: enforce LLM quota in ProcessOrderMessageUseCase"
```

---

## Task 4: Gate claims access by plan

**Files:**
- Modify: `src/application/use-cases/claims/IngestClaimWebhookUseCase.ts`

- [ ] **Step 1: Find where tenant is loaded in IngestClaimWebhookUseCase**

Open `src/application/use-cases/claims/IngestClaimWebhookUseCase.ts`. Find where the tenant is fetched (look for `tenantRepo.findBySellerId`).

- [ ] **Step 2: Add plan gate after tenant load**

After retrieving the tenant, add:

```typescript
if (tenant && !tenant.canAccessClaims()) {
  await this.eventRepo.log(
    new EventLog({
      sellerId,
      type: "claims_plan_blocked",
      message: `⛔ Reclamo recibido pero el plan "${tenant.settings.planId}" no incluye gestión de reclamos.`,
    })
  );
  return; // silently drop — don't error, the webhook will retry otherwise
}
```

- [ ] **Step 3: Run full test suite**

```powershell
npm test
```

Expected: All tests pass.

- [ ] **Step 4: Commit**

```powershell
git add src/application/use-cases/claims/IngestClaimWebhookUseCase.ts
git commit -m "feat: gate claims ingestion by plan (Pro+ only)"
```

---

## Task 5: UpdateTenantPlanUseCase

**Files:**
- Create: `src/application/use-cases/admin/UpdateTenantPlanUseCase.ts`
- Create: `tests/admin/UpdateTenantPlanUseCase.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/admin/UpdateTenantPlanUseCase.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run tests to verify they fail**

```powershell
npm test -- --reporter=verbose tests/admin/UpdateTenantPlanUseCase.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement UpdateTenantPlanUseCase**

Create `src/application/use-cases/admin/UpdateTenantPlanUseCase.ts`:

```typescript
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
      // Clear quota block when upgrading so the bot resumes immediately
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
```

- [ ] **Step 4: Run tests to verify they pass**

```powershell
npm test -- --reporter=verbose tests/admin/UpdateTenantPlanUseCase.test.ts
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/application/use-cases/admin/UpdateTenantPlanUseCase.ts tests/admin/UpdateTenantPlanUseCase.test.ts
git commit -m "feat: add UpdateTenantPlanUseCase for admin plan management"
```

---

## Task 6: Wire plan endpoint into AdminController and routes

**Files:**
- Modify: `src/presentation/controllers/AdminController.ts`
- Modify: `src/presentation/routes/adminRoutes.ts`
- Modify: `src/server.ts` (to inject the new use case)

- [ ] **Step 1: Add `updateTenantPlan` handler to AdminController**

In `src/presentation/controllers/AdminController.ts`:

**a) Import the new use case** (add with the other imports):
```typescript
import { UpdateTenantPlanUseCase } from "../../application/use-cases/admin/UpdateTenantPlanUseCase.js";
```

**b) Add to constructor** (after `updateTenantIntegrationsUseCase`):
```typescript
private readonly updateTenantPlanUseCase: UpdateTenantPlanUseCase,
```

**c) Add handler method** (at the end of the class, before the closing `}`):
```typescript
public updateTenantPlan = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const { sellerId } = request.params as { sellerId: string };
    const { planId, billingStatus, nextBillingDate } = request.body as {
      planId: "starter" | "pro" | "business" | "enterprise";
      billingStatus: "active" | "overdue" | "cancelled";
      nextBillingDate: string;
    };
    const result = await this.updateTenantPlanUseCase.execute({
      sellerId,
      planId,
      billingStatus,
      nextBillingDate,
    });
    return reply.send(result);
  } catch (err: any) {
    if (err.message.includes("not found")) return reply.status(404).send({ error: err.message });
    return reply.status(500).send({ error: err.message });
  }
};
```

- [ ] **Step 2: Register the route in adminRoutes.ts**

In `src/presentation/routes/adminRoutes.ts`, add alongside the other admin routes:

```typescript
fastify.put("/admin/tenants/:sellerId/plan", { onRequest: [fastify.authenticate] }, adminController.updateTenantPlan);
```

- [ ] **Step 3: Inject UpdateTenantPlanUseCase in server.ts**

In `src/server.ts`, find where `AdminController` is instantiated. Add the new use case:

```typescript
import { UpdateTenantPlanUseCase } from "./application/use-cases/admin/UpdateTenantPlanUseCase.js";

// near other admin use case instantiations:
const updateTenantPlanUseCase = new UpdateTenantPlanUseCase(tenantRepo);

// pass it to AdminController constructor (add as last or second-to-last arg):
const adminController = new AdminController(
  // ... existing args ...,
  updateTenantPlanUseCase,
);
```

- [ ] **Step 4: Run full test suite and TypeScript build**

```powershell
npm test
npm run build
```

Expected: All tests pass, build succeeds.

- [ ] **Step 5: Commit**

```powershell
git add src/presentation/controllers/AdminController.ts src/presentation/routes/adminRoutes.ts src/server.ts
git commit -m "feat: add PUT /admin/tenants/:sellerId/plan endpoint"
```

---

## Task 7: Add billingStatus and nextBillingDate as DB columns

The settings are stored as `settingsJson` (JSON text), so `billingStatus` and `nextBillingDate` survive without a migration. However, adding them as proper columns enables future SQL filtering (e.g. "show all overdue tenants"). This task adds them as nullable columns alongside `settingsJson`.

**Files:**
- Modify: `src/infrastructure/persistence/drizzle/schema.ts`
- Modify: `src/infrastructure/persistence/postgres/PostgresTenantRepository.ts`

- [ ] **Step 1: Add columns to schema**

In `src/infrastructure/persistence/drizzle/schema.ts`, add to the `tenants` table definition:

```typescript
billingStatus: text('billing_status').default('active'),
nextBillingDate: timestamp('next_billing_date'),
```

- [ ] **Step 2: Generate the migration**

```powershell
npm run db:generate
```

Expected: A new migration file created under `src/infrastructure/persistence/drizzle/migrations/`.

- [ ] **Step 3: Apply the migration locally**

```powershell
npm run db:migrate
```

Expected: `Migrations applied successfully.`

- [ ] **Step 4: Update PostgresTenantRepository to sync columns on save**

Open `src/infrastructure/persistence/postgres/PostgresTenantRepository.ts`. Find the `save` method. Add the new columns to the upsert:

```typescript
billingStatus: tenant.settings.billingStatus ?? "active",
nextBillingDate: tenant.settings.nextBillingDate
  ? new Date(tenant.settings.nextBillingDate)
  : null,
```

- [ ] **Step 5: Run full test suite**

```powershell
npm test
```

Expected: All tests pass.

- [ ] **Step 6: Commit**

```powershell
git add src/infrastructure/persistence/drizzle/schema.ts src/infrastructure/persistence/postgres/PostgresTenantRepository.ts src/infrastructure/persistence/drizzle/migrations/
git commit -m "feat: add billingStatus and nextBillingDate columns to tenants table"
```

---

## Task 8: Admin UI — plan and billing management

**Files:**
- Modify: `client/src/pages/AdminPage.tsx`
- Modify: `client/src/pages/AdminPage.css` (if needed for layout)

- [ ] **Step 1: Add plan management section to tenant detail view**

In `client/src/pages/AdminPage.tsx`, find the tenant detail panel/modal (where permissions and integrations are shown). Add a new "Plan & Billing" section:

```tsx
{/* Plan & Billing */}
<div className="admin-section">
  <h3>Plan & Facturación</h3>

  <label>Plan</label>
  <select
    value={selectedTenant.settings.planId}
    onChange={(e) => handleUpdatePlan({ planId: e.target.value as any })}
  >
    <option value="starter">Starter — 300 respuestas/mes</option>
    <option value="pro">Pro — 1.000 respuestas/mes</option>
    <option value="business">Business — 5.000 respuestas/mes</option>
    <option value="enterprise">Enterprise — Ilimitado</option>
  </select>

  <label>Estado de facturación</label>
  <select
    value={selectedTenant.settings.billingStatus}
    onChange={(e) => handleUpdatePlan({ billingStatus: e.target.value as any })}
  >
    <option value="active">Activo</option>
    <option value="overdue">Vencido</option>
    <option value="cancelled">Cancelado</option>
  </select>

  <label>Próximo vencimiento</label>
  <input
    type="date"
    value={selectedTenant.settings.nextBillingDate?.slice(0, 10) ?? ""}
    onChange={(e) => handleUpdatePlan({ nextBillingDate: new Date(e.target.value).toISOString() })}
  />

  <div className="quota-info">
    <span>Respuestas IA este mes: {selectedTenant.settings.llmResponsesThisMonth ?? 0} / {selectedTenant.settings.monthlyLLMLimit ?? "-"}</span>
  </div>
</div>
```

- [ ] **Step 2: Add `handleUpdatePlan` function**

In the same component, add:

```typescript
const handleUpdatePlan = async (partial: {
  planId?: string;
  billingStatus?: string;
  nextBillingDate?: string;
}) => {
  if (!selectedTenant) return;
  const payload = {
    planId: partial.planId ?? selectedTenant.settings.planId,
    billingStatus: partial.billingStatus ?? selectedTenant.settings.billingStatus,
    nextBillingDate: partial.nextBillingDate ?? selectedTenant.settings.nextBillingDate,
  };
  const res = await fetch(`/api/admin/tenants/${selectedTenant.sellerId}/plan`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
  if (res.ok) {
    const updated = await res.json();
    setSelectedTenant((prev: any) => ({
      ...prev,
      settings: { ...prev.settings, ...updated },
    }));
  }
};
```

- [ ] **Step 3: Start dev server and verify the UI**

```powershell
npm run dev:full
```

Open the AdminPage, select a tenant, and verify:
- Plan dropdown shows correct current plan
- Changing plan calls the API and updates the displayed quota limit
- Billing status dropdown works
- LLM usage counter displays correctly

- [ ] **Step 4: Commit**

```powershell
git add client/src/pages/AdminPage.tsx client/src/pages/AdminPage.css
git commit -m "feat: add plan and billing management to AdminPage"
```

---

## Self-Review

### Spec Coverage

| Requirement | Covered by |
|---|---|
| 3 plans: Starter/Pro/Business | Task 1 — PLAN_LIMITS constant |
| LLM response limits (300/1000/5000) | Task 1 — PLAN_LIMITS + monthlyLLMLimit |
| 80% quota warning notification | Task 2 — event log + TenantNotificationService |
| 12h grace period before pausing | Task 1 — canAutoAnswer(), Task 2 enforcement |
| Claims gated to Pro+ | Task 1 — canAccessClaims(), Task 4 gate |
| WhatsApp gated to Business+ | Task 1 — canAccessWhatsApp() |
| Two separate counters (LLM vs WA) | Task 1 — llmResponsesThisMonth vs alertsSentThisMonth |
| billingStatus field for manual admin | Task 1 entity, Task 5 use case, Task 7 DB column |
| Admin can update plan + billing | Task 5 use case, Task 6 endpoint, Task 8 UI |
| Upgrade clears quota block | Task 5 — isUpgrade check clears llmQuotaExhaustedAt |
| canAutoAnswer blocks overdue/cancelled | Task 1 — billingStatus check in canAutoAnswer |
| Post-sale LLM quota enforcement | Task 3 |

### No regressions expected
- `alertsSentThisMonth` / `canSendWhatsAppAlert` unchanged — WA quota logic untouched
- `shouldAutoAnswer` logic unchanged — quota is a separate gate applied in use cases
- All existing Tenant tests still compile — new fields have defaults in `createDefault`
