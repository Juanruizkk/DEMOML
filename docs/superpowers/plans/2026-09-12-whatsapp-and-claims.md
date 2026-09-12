# WhatsApp Real (Meta Cloud API) & Claims Module Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire Meta Cloud API for real WhatsApp notifications and add a claims (reclamos) ingestion module that alerts sellers via WhatsApp when MercadoLibre opens a post-sale claim.

**Architecture:** Extend the existing Clean Architecture. A new `Claim` domain entity and `IWhatsAppClient` port are added. `MetaWhatsAppClient` implements the port against Meta Graph API v21.0. `ProcessClaimUseCase` fetches claim data from ML, persists it, and sends a WhatsApp alert. `HandleWhatsAppReplyUseCase` routes button replies from Meta's incoming webhook to existing `ApproveAnswerUseCase` / `RejectAnswerUseCase`. `ProcessQuestionUseCase` gains a required `IWhatsAppClient` dependency to send real notifications on human-review. The ML webhook (`/webhook/ml`) bifurcates: `questions` → existing queue; `post_purchase` → `ProcessClaimUseCase` directly (no queue, fire-and-forget after 200).

**Tech Stack:** TypeScript, Fastify, better-sqlite3, vitest, Meta Graph API v21.0, MercadoLibre REST API (`/post-purchase/v1/claims/{id}`)

---

## File Map

**New files:**
| File | Responsibility |
|------|---------------|
| `src/domain/entities/Claim.ts` | Domain entity with urgency/SLA logic |
| `src/application/interfaces/IWhatsAppClient.ts` | Port: sendTextMessage, sendInteractiveButtons, sendTemplate |
| `src/application/interfaces/IClaimRepository.ts` | Port: save, findById, listBySellerId |
| `src/infrastructure/whatsapp/MetaWhatsAppClient.ts` | Meta Graph API v21.0 adapter |
| `src/infrastructure/persistence/sqlite/SqliteClaimRepository.ts` | SQLite implementation of IClaimRepository |
| `src/application/use-cases/IngestClaimWebhookUseCase.ts` | Thin: parses ML webhook, triggers ProcessClaimUseCase |
| `src/application/use-cases/ProcessClaimUseCase.ts` | Fetches claim from ML, persists, sends WA alert |
| `src/application/use-cases/HandleWhatsAppReplyUseCase.ts` | Routes Meta button replies to approve/reject/ack |
| `src/presentation/controllers/WhatsAppWebhookController.ts` | GET (Meta challenge) + POST (incoming messages) |
| `src/tests/Claim.test.ts` | Unit tests for Claim entity |
| `src/tests/ProcessClaimUseCase.test.ts` | Unit tests for ProcessClaimUseCase |
| `src/tests/HandleWhatsAppReplyUseCase.test.ts` | Unit tests for HandleWhatsAppReplyUseCase |

**Modified files:**
| File | Change |
|------|--------|
| `src/application/interfaces/IMeliClient.ts` | Add `getClaim(sellerId, claimId)` |
| `src/infrastructure/meli/MeliApiClient.ts` | Implement `getClaim()` |
| `src/infrastructure/persistence/sqlite/SqliteDatabase.ts` | Add `claims` table + indexes |
| `src/application/use-cases/ProcessQuestionUseCase.ts` | Inject `IWhatsAppClient`, send real WA on human-review |
| `src/presentation/controllers/WebhookController.ts` | Accept claim use case, bifurcate by topic |
| `src/app.ts` | Instantiate and wire all new components |

---

## Task 1: Domain Entity `Claim`

**Files:**
- Create: `src/domain/entities/Claim.ts`
- Create: `src/tests/Claim.test.ts`

- [ ] **Step 1: Create the entity file**

```typescript
// src/domain/entities/Claim.ts
export type ClaimType = "med_pnr" | "med_pdd" | "return" | "cancel_purchase" | "other";
export type ClaimStage = "claim" | "dispute" | "closed";
export type ClaimStatus = "opened" | "closed";
export type ClaimUrgency = "critical" | "high" | "normal";

export interface ClaimAction {
  action: string;
  dueDate: Date | null;
  mandatory: boolean;
}

export interface ClaimProps {
  id: string;
  sellerId: string;
  orderId: string;
  type: ClaimType;
  stage: ClaimStage;
  status: ClaimStatus;
  reason: string;
  buyerId?: string;
  actions: ClaimAction[];
  dueDate: Date;
  notifiedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export class Claim {
  public readonly id: string;
  public readonly sellerId: string;
  public readonly orderId: string;
  public readonly type: ClaimType;
  public stage: ClaimStage;
  public status: ClaimStatus;
  public readonly reason: string;
  public readonly buyerId?: string;
  public actions: ClaimAction[];
  public dueDate: Date;
  public notifiedAt?: Date;
  public readonly createdAt: Date;
  public updatedAt: Date;

  constructor(props: ClaimProps) {
    this.id = props.id;
    this.sellerId = props.sellerId;
    this.orderId = props.orderId;
    this.type = props.type;
    this.stage = props.stage;
    this.status = props.status;
    this.reason = props.reason;
    this.buyerId = props.buyerId;
    this.actions = props.actions;
    this.dueDate = props.dueDate;
    this.notifiedAt = props.notifiedAt;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  public getUrgency(now: Date = new Date()): ClaimUrgency {
    const hours = this.getRemainingHours(now);
    if (hours <= 12) return "critical";
    if (hours <= 24) return "high";
    return "normal";
  }

  public getRemainingHours(now: Date = new Date()): number {
    return Math.max(0, Math.round((this.dueDate.getTime() - now.getTime()) / (1000 * 60 * 60)));
  }

  public markNotified(): void {
    this.notifiedAt = new Date();
    this.updatedAt = new Date();
  }
}
```

- [ ] **Step 2: Write the failing tests**

```typescript
// src/tests/Claim.test.ts
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
```

- [ ] **Step 3: Run tests — expect FAIL (file not found)**

```
npm test
```

Expected: `Cannot find module '../domain/entities/Claim.js'` or similar.

- [ ] **Step 4: Run tests — expect PASS after entity creation**

The entity file was created in Step 1, so running:
```
npm test
```
Expected: all 4 `Claim` tests pass.

- [ ] **Step 5: Commit**

```
git add src/domain/entities/Claim.ts src/tests/Claim.test.ts
git commit -m "feat: add Claim domain entity with urgency/SLA logic"
```

---

## Task 2: Interfaces — IWhatsAppClient, IClaimRepository, extend IMeliClient

**Files:**
- Create: `src/application/interfaces/IWhatsAppClient.ts`
- Create: `src/application/interfaces/IClaimRepository.ts`
- Modify: `src/application/interfaces/IMeliClient.ts`

- [ ] **Step 1: Create IWhatsAppClient**

```typescript
// src/application/interfaces/IWhatsAppClient.ts
export interface SendWhatsAppTextDTO {
  to: string; // E.164, e.g. "+5491112345678"
  text: string;
}

export interface SendWhatsAppButtonsDTO {
  to: string;
  bodyText: string;
  buttons: Array<{ id: string; title: string }>; // title max 20 chars
}

export interface SendWhatsAppTemplateDTO {
  to: string;
  templateName: string;
  languageCode: string;
  parameters: string[];
}

export interface IWhatsAppClient {
  sendTextMessage(dto: SendWhatsAppTextDTO): Promise<void>;
  sendInteractiveButtons(dto: SendWhatsAppButtonsDTO): Promise<void>;
  sendTemplate(dto: SendWhatsAppTemplateDTO): Promise<void>;
}
```

- [ ] **Step 2: Create IClaimRepository**

```typescript
// src/application/interfaces/IClaimRepository.ts
import { Claim, ClaimStatus } from "../../domain/entities/Claim.js";

export interface IClaimRepository {
  save(claim: Claim): Promise<void>;
  findById(id: string): Promise<Claim | null>;
  listBySellerId(sellerId: string, status?: ClaimStatus): Promise<Claim[]>;
}
```

- [ ] **Step 3: Extend IMeliClient with getClaim**

Add to the bottom of `src/application/interfaces/IMeliClient.ts`, inside the `IMeliClient` interface:

```typescript
  getClaim(sellerId: string, claimId: string): Promise<MeliClaimDTO>;
```

And add the DTO type above the interface:

```typescript
export interface MeliClaimPlayerAction {
  action: string;
  due_date: string | null;
  mandatory: boolean;
}

export interface MeliClaimPlayer {
  role: "complainant" | "respondent" | "mediator";
  type: "buyer" | "seller" | "internal";
  user_id: number;
  available_actions: MeliClaimPlayerAction[];
}

export interface MeliClaimDTO {
  id: number;
  resource_id: number;   // order_id
  status: "opened" | "closed";
  type: string;
  stage: "claim" | "dispute" | "closed";
  reason_id: string;     // e.g. "PNR3430" or "PDD9549"
  players: MeliClaimPlayer[];
  date_created: string;
  last_updated: string;
}
```

The full updated `src/application/interfaces/IMeliClient.ts`:

```typescript
// src/application/interfaces/IMeliClient.ts
import { Item } from "../../domain/entities/Item.js";

export interface MeliQuestionDTO {
  id: number;
  seller_id: number;
  item_id: string;
  from: { id: number };
  text: string;
  status: "UNANSWERED" | "ANSWERED" | "CLOSED_UNANSWERED" | "UNDER_REVIEW";
  date_created: string;
}

export interface MeliClaimPlayerAction {
  action: string;
  due_date: string | null;
  mandatory: boolean;
}

export interface MeliClaimPlayer {
  role: "complainant" | "respondent" | "mediator";
  type: "buyer" | "seller" | "internal";
  user_id: number;
  available_actions: MeliClaimPlayerAction[];
}

export interface MeliClaimDTO {
  id: number;
  resource_id: number;
  status: "opened" | "closed";
  type: string;
  stage: "claim" | "dispute" | "closed";
  reason_id: string;
  players: MeliClaimPlayer[];
  date_created: string;
  last_updated: string;
}

export interface IMeliClient {
  getQuestion(sellerId: string, questionId: string): Promise<MeliQuestionDTO>;
  getItem(sellerId: string, itemId: string): Promise<Item>;
  postAnswer(sellerId: string, questionId: string, text: string): Promise<void>;
  getReceivedQuestions(sellerId: string): Promise<MeliQuestionDTO[]>;
  getClaim(sellerId: string, claimId: string): Promise<MeliClaimDTO>;
  getSellerProfile(sellerId: string, accessToken?: string): Promise<{
    id: number;
    nickname: string;
    email?: string;
    permalink?: string;
  }>;
  exchangeCodeForTokens(code: string): Promise<{
    access_token: string;
    refresh_token: string;
    expires_in: number;
    user_id: number;
  }>;
  refreshTokens(refreshToken: string): Promise<{
    access_token: string;
    refresh_token: string;
    expires_in: number;
    user_id: number;
  }>;
}
```

- [ ] **Step 4: Verify build passes**

```
npm run build
```

Expected: TypeScript errors because `MeliApiClient` doesn't implement `getClaim` yet. That's expected — will be fixed in Task 5.

- [ ] **Step 5: Commit**

```
git add src/application/interfaces/IWhatsAppClient.ts src/application/interfaces/IClaimRepository.ts src/application/interfaces/IMeliClient.ts
git commit -m "feat: add IWhatsAppClient, IClaimRepository interfaces; extend IMeliClient with getClaim"
```

---

## Task 3: MetaWhatsAppClient

**Files:**
- Create: `src/infrastructure/whatsapp/MetaWhatsAppClient.ts`

- [ ] **Step 1: Create the adapter**

```typescript
// src/infrastructure/whatsapp/MetaWhatsAppClient.ts
import {
  IWhatsAppClient,
  SendWhatsAppTextDTO,
  SendWhatsAppButtonsDTO,
  SendWhatsAppTemplateDTO,
} from "../../application/interfaces/IWhatsAppClient.js";

export class MetaWhatsAppClient implements IWhatsAppClient {
  private readonly apiUrl: string;
  private readonly token: string;

  constructor() {
    const phoneNumberId = process.env.META_WA_PHONE_NUMBER_ID || "";
    this.apiUrl = `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`;
    this.token = process.env.META_WA_ACCESS_TOKEN || "";
  }

  private isConfigured(): boolean {
    return Boolean(this.token && process.env.META_WA_PHONE_NUMBER_ID);
  }

  private formatPhone(phone: string): string {
    return phone.replace(/\D/g, "");
  }

  private async post(body: unknown): Promise<void> {
    const res = await fetch(this.apiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error(`[MetaWhatsAppClient] Error ${res.status}: ${err}`);
    }
  }

  public async sendTextMessage(dto: SendWhatsAppTextDTO): Promise<void> {
    if (!this.isConfigured()) {
      console.warn("[MetaWhatsAppClient] No configurado. Mensaje de texto omitido.");
      return;
    }
    await this.post({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: this.formatPhone(dto.to),
      type: "text",
      text: { body: dto.text },
    });
  }

  public async sendInteractiveButtons(dto: SendWhatsAppButtonsDTO): Promise<void> {
    if (!this.isConfigured()) {
      console.warn("[MetaWhatsAppClient] No configurado. Mensaje con botones omitido.");
      return;
    }
    await this.post({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: this.formatPhone(dto.to),
      type: "interactive",
      interactive: {
        type: "button",
        body: { text: dto.bodyText },
        action: {
          buttons: dto.buttons.map((b) => ({
            type: "reply",
            reply: { id: b.id, title: b.title.slice(0, 20) },
          })),
        },
      },
    });
  }

  public async sendTemplate(dto: SendWhatsAppTemplateDTO): Promise<void> {
    if (!this.isConfigured()) {
      console.warn("[MetaWhatsAppClient] No configurado. Template omitido.");
      return;
    }
    await this.post({
      messaging_product: "whatsapp",
      to: this.formatPhone(dto.to),
      type: "template",
      template: {
        name: dto.templateName,
        language: { code: dto.languageCode },
        components: dto.parameters.length
          ? [
              {
                type: "body",
                parameters: dto.parameters.map((p) => ({ type: "text", text: p })),
              },
            ]
          : [],
      },
    });
  }
}
```

- [ ] **Step 2: Commit**

```
git add src/infrastructure/whatsapp/MetaWhatsAppClient.ts
git commit -m "feat: implement MetaWhatsAppClient adapter for Meta Graph API v21.0"
```

---

## Task 4: SqliteClaimRepository + DB schema

**Files:**
- Modify: `src/infrastructure/persistence/sqlite/SqliteDatabase.ts`
- Create: `src/infrastructure/persistence/sqlite/SqliteClaimRepository.ts`

- [ ] **Step 1: Add `claims` table to SqliteDatabase.ts**

In `src/infrastructure/persistence/sqlite/SqliteDatabase.ts`, append after the `app_config` table creation (before the closing backtick of `db.exec`):

```typescript
      CREATE TABLE IF NOT EXISTS claims (
        id TEXT PRIMARY KEY,
        seller_id TEXT NOT NULL,
        order_id TEXT NOT NULL,
        type TEXT NOT NULL,
        stage TEXT NOT NULL,
        status TEXT NOT NULL,
        reason TEXT NOT NULL,
        buyer_id TEXT,
        actions_json TEXT NOT NULL DEFAULT '[]',
        due_date DATETIME NOT NULL,
        notified_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_claims_seller ON claims(seller_id);
      CREATE INDEX IF NOT EXISTS idx_claims_due_date ON claims(due_date);
```

The full updated `initSchema` block:

```typescript
  private static initSchema(db: DatabaseType): void {
    db.exec(`
      CREATE TABLE IF NOT EXISTS tenants (
        id TEXT PRIMARY KEY,
        seller_id TEXT UNIQUE NOT NULL,
        nickname TEXT,
        email TEXT,
        access_token TEXT NOT NULL,
        refresh_token TEXT NOT NULL,
        expires_at INTEGER NOT NULL,
        settings_json TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS questions (
        question_id TEXT PRIMARY KEY,
        seller_id TEXT NOT NULL,
        item_id TEXT NOT NULL,
        buyer_id TEXT,
        text TEXT NOT NULL,
        ml_status TEXT,
        intent TEXT,
        confidence REAL,
        requires_human INTEGER DEFAULT 0,
        reason TEXT,
        suggested_answer TEXT,
        final_answer TEXT,
        app_status TEXT NOT NULL,
        received_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        answered_at DATETIME,
        latency_ms INTEGER,
        ml_error TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_questions_seller ON questions(seller_id);
      CREATE INDEX IF NOT EXISTS idx_questions_status ON questions(app_status);

      CREATE TABLE IF NOT EXISTS items_cache (
        item_id TEXT PRIMARY KEY,
        seller_id TEXT,
        payload_json TEXT NOT NULL,
        cached_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        seller_id TEXT,
        question_id TEXT,
        type TEXT NOT NULL,
        message TEXT NOT NULL,
        duration_ms INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_events_seller ON events(seller_id);

      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        name TEXT NOT NULL,
        role TEXT NOT NULL,
        seller_id TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      CREATE INDEX IF NOT EXISTS idx_users_seller ON users(seller_id);

      CREATE TABLE IF NOT EXISTS app_config (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS claims (
        id TEXT PRIMARY KEY,
        seller_id TEXT NOT NULL,
        order_id TEXT NOT NULL,
        type TEXT NOT NULL,
        stage TEXT NOT NULL,
        status TEXT NOT NULL,
        reason TEXT NOT NULL,
        buyer_id TEXT,
        actions_json TEXT NOT NULL DEFAULT '[]',
        due_date DATETIME NOT NULL,
        notified_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_claims_seller ON claims(seller_id);
      CREATE INDEX IF NOT EXISTS idx_claims_due_date ON claims(due_date);
    `);
  }
```

- [ ] **Step 2: Create SqliteClaimRepository**

```typescript
// src/infrastructure/persistence/sqlite/SqliteClaimRepository.ts
import { Database as DatabaseType } from "better-sqlite3";
import { IClaimRepository } from "../../../application/interfaces/IClaimRepository.js";
import { Claim, ClaimAction, ClaimStage, ClaimStatus, ClaimType } from "../../../domain/entities/Claim.js";

export class SqliteClaimRepository implements IClaimRepository {
  constructor(private readonly db: DatabaseType) {}

  public async save(claim: Claim): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO claims (
        id, seller_id, order_id, type, stage, status, reason,
        buyer_id, actions_json, due_date, notified_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(id) DO UPDATE SET
        stage = excluded.stage,
        status = excluded.status,
        actions_json = excluded.actions_json,
        due_date = excluded.due_date,
        notified_at = excluded.notified_at,
        updated_at = CURRENT_TIMESTAMP
    `);

    stmt.run(
      claim.id,
      claim.sellerId,
      claim.orderId,
      claim.type,
      claim.stage,
      claim.status,
      claim.reason,
      claim.buyerId ?? null,
      JSON.stringify(claim.actions),
      claim.dueDate.toISOString(),
      claim.notifiedAt ? claim.notifiedAt.toISOString() : null,
    );
  }

  public async findById(id: string): Promise<Claim | null> {
    const row = this.db.prepare("SELECT * FROM claims WHERE id = ?").get(id) as any;
    if (!row) return null;
    return this.mapToDomain(row);
  }

  public async listBySellerId(sellerId: string, status?: ClaimStatus): Promise<Claim[]> {
    const rows = status
      ? (this.db.prepare("SELECT * FROM claims WHERE seller_id = ? AND status = ? ORDER BY due_date ASC").all(sellerId, status) as any[])
      : (this.db.prepare("SELECT * FROM claims WHERE seller_id = ? ORDER BY due_date ASC").all(sellerId) as any[]);
    return rows.map((r) => this.mapToDomain(r));
  }

  private mapToDomain(row: any): Claim {
    return new Claim({
      id: row.id,
      sellerId: row.seller_id,
      orderId: row.order_id,
      type: row.type as ClaimType,
      stage: row.stage as ClaimStage,
      status: row.status as ClaimStatus,
      reason: row.reason,
      buyerId: row.buyer_id ?? undefined,
      actions: JSON.parse(row.actions_json || "[]") as ClaimAction[],
      dueDate: new Date(row.due_date),
      notifiedAt: row.notified_at ? new Date(row.notified_at) : undefined,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    });
  }
}
```

- [ ] **Step 3: Verify build passes**

```
npm run build
```

Expected: still TypeScript errors about missing `getClaim` in `MeliApiClient`. That's fine — resolved in Task 5.

- [ ] **Step 4: Commit**

```
git add src/infrastructure/persistence/sqlite/SqliteDatabase.ts src/infrastructure/persistence/sqlite/SqliteClaimRepository.ts
git commit -m "feat: add claims table schema and SqliteClaimRepository"
```

---

## Task 5: getClaim in MeliApiClient

**Files:**
- Modify: `src/infrastructure/meli/MeliApiClient.ts`

- [ ] **Step 1: Add `getClaim` method**

In `src/infrastructure/meli/MeliApiClient.ts`, add the import for `MeliClaimDTO` and add the method before the last closing brace:

```typescript
import { IMeliClient, MeliQuestionDTO, MeliClaimDTO } from "../../application/interfaces/IMeliClient.js";
```

Add this method inside the class:

```typescript
  public async getClaim(sellerId: string, claimId: string): Promise<MeliClaimDTO> {
    return this.meliFetch<MeliClaimDTO>(sellerId, `/post-purchase/v1/claims/${claimId}`);
  }
```

- [ ] **Step 2: Verify build passes with no errors**

```
npm run build
```

Expected: **0 TypeScript errors**.

- [ ] **Step 3: Commit**

```
git add src/infrastructure/meli/MeliApiClient.ts
git commit -m "feat: implement getClaim in MeliApiClient"
```

---

## Task 6: IngestClaimWebhookUseCase + ProcessClaimUseCase

**Files:**
- Create: `src/application/use-cases/IngestClaimWebhookUseCase.ts`
- Create: `src/application/use-cases/ProcessClaimUseCase.ts`
- Create: `src/tests/ProcessClaimUseCase.test.ts`

- [ ] **Step 1: Create IngestClaimWebhookUseCase**

```typescript
// src/application/use-cases/IngestClaimWebhookUseCase.ts
import { IEventRepository } from "../interfaces/IEventRepository.js";
import { EventLog } from "../../domain/entities/EventLog.js";
import { ProcessClaimUseCase } from "./ProcessClaimUseCase.js";
import { WebhookPayload } from "./IngestWebhookUseCase.js";

export class IngestClaimWebhookUseCase {
  constructor(
    private readonly processClaimUseCase: ProcessClaimUseCase,
    private readonly eventRepo: IEventRepository
  ) {}

  public async execute(payload: WebhookPayload): Promise<{ queued: boolean; claimId?: string }> {
    const { topic, resource, user_id, actions } = payload as any;

    const isClaim =
      (topic === "post_purchase" && Array.isArray(actions) && actions.includes("claims")) ||
      topic === "claims";

    if (!isClaim || !resource) {
      return { queued: false };
    }

    // resource format: "post-purchase/v1/claims/5108684499"
    const match = /claims\/(\d+)/.exec(resource);
    if (!match) {
      return { queued: false };
    }

    const claimId = match[1];
    const sellerId = String(user_id || process.env.ML_SELLER_ID || "");

    await this.eventRepo.log(
      new EventLog({
        sellerId,
        type: "webhook_received",
        message: `📥 Webhook reclamo recibido (claim_id: ${claimId}, seller_id: ${sellerId})`,
      })
    );

    // Fire-and-forget after responding 200 to ML
    this.processClaimUseCase.execute({ claimId, sellerId }).catch((err) => {
      console.error("[IngestClaimWebhookUseCase] Error procesando reclamo:", err);
    });

    return { queued: true, claimId };
  }
}
```

- [ ] **Step 2: Create ProcessClaimUseCase**

The `reason_id` prefix determines `ClaimType`:
- Starts with `"PNR"` → `"med_pnr"`
- Starts with `"PDD"` → `"med_pdd"`
- Otherwise → `"other"`

The `dueDate` is the earliest non-null `due_date` from the seller's `available_actions`. Fallback: 48 hours from now.

```typescript
// src/application/use-cases/ProcessClaimUseCase.ts
import { IClaimRepository } from "../interfaces/IClaimRepository.js";
import { ITenantRepository } from "../interfaces/ITenantRepository.js";
import { IEventRepository } from "../interfaces/IEventRepository.js";
import { IMeliClient } from "../interfaces/IMeliClient.js";
import { IWhatsAppClient } from "../interfaces/IWhatsAppClient.js";
import { IRealtimeNotifier } from "../interfaces/IRealtimeNotifier.js";
import { Claim, ClaimAction, ClaimType } from "../../domain/entities/Claim.js";
import { EventLog } from "../../domain/entities/EventLog.js";

export class ProcessClaimUseCase {
  constructor(
    private readonly claimRepo: IClaimRepository,
    private readonly tenantRepo: ITenantRepository,
    private readonly eventRepo: IEventRepository,
    private readonly meliClient: IMeliClient,
    private readonly whatsAppClient: IWhatsAppClient,
    private readonly sseNotifier: IRealtimeNotifier
  ) {}

  public async execute(params: { claimId: string; sellerId: string }): Promise<Claim | null> {
    const { claimId, sellerId } = params;

    try {
      // 1. Fetch claim from ML
      const raw = await this.meliClient.getClaim(sellerId, claimId);

      // 2. Map to domain
      const sellerPlayer = raw.players.find((p) => p.role === "respondent");
      const buyerPlayer = raw.players.find((p) => p.role === "complainant");

      const actions: ClaimAction[] = (sellerPlayer?.available_actions || []).map((a) => ({
        action: a.action,
        dueDate: a.due_date ? new Date(a.due_date) : null,
        mandatory: a.mandatory,
      }));

      const dueDates = actions
        .filter((a) => a.dueDate !== null)
        .map((a) => a.dueDate as Date);

      const dueDate =
        dueDates.length > 0
          ? new Date(Math.min(...dueDates.map((d) => d.getTime())))
          : new Date(Date.now() + 48 * 60 * 60 * 1000);

      const type = this.mapClaimType(raw.reason_id);
      const now = new Date();

      const claim = new Claim({
        id: String(raw.id),
        sellerId,
        orderId: String(raw.resource_id),
        type,
        stage: raw.stage,
        status: raw.status,
        reason: raw.reason_id,
        buyerId: buyerPlayer ? String(buyerPlayer.user_id) : undefined,
        actions,
        dueDate,
        createdAt: new Date(raw.date_created),
        updatedAt: now,
      });

      // 3. Persist
      await this.claimRepo.save(claim);

      await this.eventRepo.log(
        new EventLog({
          sellerId,
          type: "claim_received",
          message: `⚖️ Reclamo ${claimId} procesado — tipo: ${type}, urgencia: ${claim.getUrgency()}, horas restantes: ${claim.getRemainingHours()}`,
        })
      );

      // 4. Send WhatsApp alert
      const tenant = await this.tenantRepo.findBySellerId(sellerId);
      const phone = tenant?.settings?.whatsappAlertPhone;

      if (phone) {
        const urgencyEmoji = claim.getUrgency() === "critical" ? "🔴" : claim.getUrgency() === "high" ? "🟠" : "🟡";
        const typeLabel = type === "med_pnr" ? "Paquete no recibido (PNR)" : type === "med_pdd" ? "Producto defectuoso (PDD)" : "Reclamo";

        const bodyText =
          `${urgencyEmoji} *NUEVO RECLAMO en Mercado Libre*\n\n` +
          `📦 Orden: #${claim.orderId}\n` +
          `🔖 Tipo: ${typeLabel}\n` +
          `⏳ Tiempo restante: ${claim.getRemainingHours()} horas\n` +
          `🆔 Reclamo: ${claimId}\n\n` +
          `Respondé a tiempo para evitar penalización automática.`;

        await this.whatsAppClient.sendInteractiveButtons({
          to: phone,
          bodyText,
          buttons: [{ id: `claim_ack_${claimId}`, title: "✅ Enterado" }],
        });

        claim.markNotified();
        await this.claimRepo.save(claim);

        await this.eventRepo.log(
          new EventLog({
            sellerId,
            type: "claim_notified",
            message: `📲 Alerta WhatsApp enviada para reclamo ${claimId}`,
          })
        );
      }

      // 5. SSE broadcast
      this.sseNotifier.broadcastToSeller(sellerId, "claim_received", {
        claim_id: claimId,
        order_id: claim.orderId,
        type: claim.type,
        urgency: claim.getUrgency(),
        remaining_hours: claim.getRemainingHours(),
      });

      return claim;
    } catch (err: any) {
      await this.eventRepo.log(
        new EventLog({
          sellerId,
          type: "error",
          message: `❌ Error procesando reclamo ${claimId}: ${err.message}`,
        })
      );
      return null;
    }
  }

  private mapClaimType(reasonId: string): ClaimType {
    if (reasonId.startsWith("PNR")) return "med_pnr";
    if (reasonId.startsWith("PDD")) return "med_pdd";
    return "other";
  }
}
```

- [ ] **Step 3: Write the failing tests**

```typescript
// src/tests/ProcessClaimUseCase.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ProcessClaimUseCase } from "../application/use-cases/ProcessClaimUseCase.js";
import { IClaimRepository } from "../application/interfaces/IClaimRepository.js";
import { ITenantRepository } from "../application/interfaces/ITenantRepository.js";
import { IEventRepository } from "../application/interfaces/IEventRepository.js";
import { IMeliClient, MeliClaimDTO } from "../application/interfaces/IMeliClient.js";
import { IWhatsAppClient } from "../application/interfaces/IWhatsAppClient.js";
import { IRealtimeNotifier } from "../application/interfaces/IRealtimeNotifier.js";
import { Tenant } from "../domain/entities/Tenant.js";

function makeMockClaim(): MeliClaimDTO {
  return {
    id: 5000000001,
    resource_id: 2000000001,
    status: "opened",
    type: "mediations",
    stage: "claim",
    reason_id: "PNR3430",
    players: [
      {
        role: "complainant",
        type: "buyer",
        user_id: 9999,
        available_actions: [],
      },
      {
        role: "respondent",
        type: "seller",
        user_id: 1111,
        available_actions: [
          {
            action: "send_message_to_complainant",
            due_date: new Date(Date.now() + 30 * 60 * 60 * 1000).toISOString(),
            mandatory: true,
          },
        ],
      },
    ],
    date_created: new Date().toISOString(),
    last_updated: new Date().toISOString(),
  };
}

function makeUseCase() {
  const claimRepo: IClaimRepository = {
    save: vi.fn().mockResolvedValue(undefined),
    findById: vi.fn().mockResolvedValue(null),
    listBySellerId: vi.fn().mockResolvedValue([]),
  };

  const tenantRepo: ITenantRepository = {
    findBySellerId: vi.fn().mockResolvedValue(null),
    save: vi.fn().mockResolvedValue(undefined),
    findAll: vi.fn().mockResolvedValue([]),
    findById: vi.fn().mockResolvedValue(null),
    delete: vi.fn().mockResolvedValue(undefined),
  };

  const eventRepo: IEventRepository = {
    log: vi.fn().mockResolvedValue(undefined),
    listBySellerId: vi.fn().mockResolvedValue([]),
  };

  const meliClient = {
    getClaim: vi.fn().mockResolvedValue(makeMockClaim()),
    getQuestion: vi.fn(),
    getItem: vi.fn(),
    postAnswer: vi.fn(),
    getReceivedQuestions: vi.fn(),
    getSellerProfile: vi.fn(),
    exchangeCodeForTokens: vi.fn(),
    refreshTokens: vi.fn(),
  } as unknown as IMeliClient;

  const whatsAppClient: IWhatsAppClient = {
    sendTextMessage: vi.fn().mockResolvedValue(undefined),
    sendInteractiveButtons: vi.fn().mockResolvedValue(undefined),
    sendTemplate: vi.fn().mockResolvedValue(undefined),
  };

  const sseNotifier: IRealtimeNotifier = {
    broadcastToSeller: vi.fn(),
    registerClient: vi.fn(),
  };

  const useCase = new ProcessClaimUseCase(
    claimRepo,
    tenantRepo,
    eventRepo,
    meliClient,
    whatsAppClient,
    sseNotifier
  );

  return { useCase, claimRepo, tenantRepo, meliClient, whatsAppClient, sseNotifier, eventRepo };
}

describe("ProcessClaimUseCase", () => {
  it("fetches claim from ML and persists it", async () => {
    const { useCase, claimRepo, meliClient } = makeUseCase();
    const claim = await useCase.execute({ claimId: "5000000001", sellerId: "1111" });

    expect(meliClient.getClaim).toHaveBeenCalledWith("1111", "5000000001");
    expect(claimRepo.save).toHaveBeenCalled();
    expect(claim).not.toBeNull();
    expect(claim?.type).toBe("med_pnr");
    expect(claim?.orderId).toBe("2000000001");
  });

  it("does NOT send WhatsApp when tenant has no whatsappAlertPhone", async () => {
    const { useCase, tenantRepo, whatsAppClient } = makeUseCase();
    vi.mocked(tenantRepo.findBySellerId).mockResolvedValue(null);

    await useCase.execute({ claimId: "5000000001", sellerId: "1111" });

    expect(whatsAppClient.sendInteractiveButtons).not.toHaveBeenCalled();
  });

  it("sends WhatsApp when tenant has whatsappAlertPhone", async () => {
    const { useCase, tenantRepo, whatsAppClient } = makeUseCase();
    const mockTenant = {
      settings: { whatsappAlertPhone: "+5491112345678", autoAnswerEnabled: true, confidenceThreshold: 0.75, tone: "casual_rioplatense" },
    } as unknown as Tenant;
    vi.mocked(tenantRepo.findBySellerId).mockResolvedValue(mockTenant);

    await useCase.execute({ claimId: "5000000001", sellerId: "1111" });

    expect(whatsAppClient.sendInteractiveButtons).toHaveBeenCalledOnce();
    const callArg = vi.mocked(whatsAppClient.sendInteractiveButtons).mock.calls[0][0];
    expect(callArg.to).toBe("+5491112345678");
    expect(callArg.buttons[0].id).toBe("claim_ack_5000000001");
  });

  it("broadcasts SSE event", async () => {
    const { useCase, sseNotifier } = makeUseCase();
    await useCase.execute({ claimId: "5000000001", sellerId: "1111" });
    expect(sseNotifier.broadcastToSeller).toHaveBeenCalledWith("1111", "claim_received", expect.any(Object));
  });

  it("maps PDD reason_id to med_pdd type", async () => {
    const { useCase, meliClient } = makeUseCase();
    const pddClaim = { ...makeMockClaim(), reason_id: "PDD9549" };
    vi.mocked(meliClient.getClaim).mockResolvedValue(pddClaim);

    const claim = await useCase.execute({ claimId: "5000000001", sellerId: "1111" });
    expect(claim?.type).toBe("med_pdd");
  });
});
```

- [ ] **Step 4: Check which methods ITenantRepository actually has (to avoid mock mismatch)**

Run:
```
npm run build
```
If there are TypeScript errors about `ITenantRepository` mock shape, adjust the mock to match the actual interface. The mock only needs the methods called by the use case: `findBySellerId`.

- [ ] **Step 5: Run tests**

```
npm test
```

Expected: `ProcessClaimUseCase` suite passes (5 tests), `Claim` suite still passes (4 tests).

- [ ] **Step 6: Commit**

```
git add src/application/use-cases/IngestClaimWebhookUseCase.ts src/application/use-cases/ProcessClaimUseCase.ts src/tests/ProcessClaimUseCase.test.ts
git commit -m "feat: add IngestClaimWebhookUseCase and ProcessClaimUseCase with WA alerts"
```

---

## Task 7: HandleWhatsAppReplyUseCase

**Files:**
- Create: `src/application/use-cases/HandleWhatsAppReplyUseCase.ts`
- Create: `src/tests/HandleWhatsAppReplyUseCase.test.ts`

- [ ] **Step 1: Create HandleWhatsAppReplyUseCase**

This use case receives the parsed body from Meta's incoming webhook and routes button clicks or text replies:
- `approve_<questionId>` → `ApproveAnswerUseCase`
- `reject_<questionId>` → `RejectAnswerUseCase`
- `claim_ack_<claimId>` → log acknowledgment
- free text → treat as custom approval text for the most recent pending question of this sender (best-effort)

```typescript
// src/application/use-cases/HandleWhatsAppReplyUseCase.ts
import { IWhatsAppClient } from "../interfaces/IWhatsAppClient.js";
import { IEventRepository } from "../interfaces/IEventRepository.js";
import { ApproveAnswerUseCase } from "./ApproveAnswerUseCase.js";
import { RejectAnswerUseCase } from "./RejectAnswerUseCase.js";
import { EventLog } from "../../domain/entities/EventLog.js";

export interface IncomingWhatsAppMessage {
  from: string;       // phone number E.164
  buttonReplyId?: string;  // set when a quick-reply button was clicked
  text?: string;           // set when a free-text message was sent
}

export class HandleWhatsAppReplyUseCase {
  constructor(
    private readonly approveUseCase: ApproveAnswerUseCase,
    private readonly rejectUseCase: RejectAnswerUseCase,
    private readonly eventRepo: IEventRepository,
    private readonly whatsAppClient: IWhatsAppClient
  ) {}

  public async execute(msg: IncomingWhatsAppMessage): Promise<void> {
    const payload = msg.buttonReplyId || msg.text || "";

    if (payload.startsWith("approve_")) {
      const questionId = payload.replace("approve_", "");
      await this.approveUseCase.execute({ questionId, isViaWhatsapp: true });
      await this.whatsAppClient.sendTextMessage({
        to: msg.from,
        text: "✅ Respuesta publicada en Mercado Libre.",
      });
      return;
    }

    if (payload.startsWith("reject_")) {
      const questionId = payload.replace("reject_", "");
      await this.rejectUseCase.execute(questionId);
      await this.whatsAppClient.sendTextMessage({
        to: msg.from,
        text: "🗑️ Respuesta descartada.",
      });
      return;
    }

    if (payload.startsWith("claim_ack_")) {
      const claimId = payload.replace("claim_ack_", "");
      await this.eventRepo.log(
        new EventLog({
          sellerId: msg.from,
          type: "claim_ack",
          message: `📲 Vendedor acusó recibo del reclamo ${claimId} vía WhatsApp`,
        })
      );
      await this.whatsAppClient.sendTextMessage({
        to: msg.from,
        text: "✅ Recibido. Recordá responder el reclamo en Mercado Libre para evitar penalizaciones.",
      });
      return;
    }

    // Unrecognized payload — acknowledge receipt
    await this.whatsAppClient.sendTextMessage({
      to: msg.from,
      text: "Hola! Para gestionar preguntas y reclamos, usá los botones del mensaje anterior.",
    });
  }
}
```

- [ ] **Step 2: Write failing tests**

```typescript
// src/tests/HandleWhatsAppReplyUseCase.test.ts
import { describe, it, expect, vi } from "vitest";
import { HandleWhatsAppReplyUseCase } from "../application/use-cases/HandleWhatsAppReplyUseCase.js";
import { ApproveAnswerUseCase } from "../application/use-cases/ApproveAnswerUseCase.js";
import { RejectAnswerUseCase } from "../application/use-cases/RejectAnswerUseCase.js";
import { IEventRepository } from "../application/interfaces/IEventRepository.js";
import { IWhatsAppClient } from "../application/interfaces/IWhatsAppClient.js";

function makeUseCase() {
  const approveUseCase = {
    execute: vi.fn().mockResolvedValue({ id: "123", sellerId: "seller1" }),
  } as unknown as ApproveAnswerUseCase;

  const rejectUseCase = {
    execute: vi.fn().mockResolvedValue({ id: "123" }),
  } as unknown as RejectAnswerUseCase;

  const eventRepo: IEventRepository = {
    log: vi.fn().mockResolvedValue(undefined),
    listBySellerId: vi.fn().mockResolvedValue([]),
  };

  const whatsAppClient: IWhatsAppClient = {
    sendTextMessage: vi.fn().mockResolvedValue(undefined),
    sendInteractiveButtons: vi.fn().mockResolvedValue(undefined),
    sendTemplate: vi.fn().mockResolvedValue(undefined),
  };

  const useCase = new HandleWhatsAppReplyUseCase(approveUseCase, rejectUseCase, eventRepo, whatsAppClient);
  return { useCase, approveUseCase, rejectUseCase, eventRepo, whatsAppClient };
}

describe("HandleWhatsAppReplyUseCase", () => {
  it("routes approve_ button to ApproveAnswerUseCase", async () => {
    const { useCase, approveUseCase, whatsAppClient } = makeUseCase();
    await useCase.execute({ from: "+5491112345678", buttonReplyId: "approve_9001" });

    expect(approveUseCase.execute).toHaveBeenCalledWith({ questionId: "9001", isViaWhatsapp: true });
    expect(whatsAppClient.sendTextMessage).toHaveBeenCalledWith(
      expect.objectContaining({ to: "+5491112345678", text: expect.stringContaining("publicada") })
    );
  });

  it("routes reject_ button to RejectAnswerUseCase", async () => {
    const { useCase, rejectUseCase, whatsAppClient } = makeUseCase();
    await useCase.execute({ from: "+5491112345678", buttonReplyId: "reject_9002" });

    expect(rejectUseCase.execute).toHaveBeenCalledWith("9002");
    expect(whatsAppClient.sendTextMessage).toHaveBeenCalledWith(
      expect.objectContaining({ to: "+5491112345678", text: expect.stringContaining("descartada") })
    );
  });

  it("logs claim_ack and sends confirmation", async () => {
    const { useCase, eventRepo, whatsAppClient } = makeUseCase();
    await useCase.execute({ from: "+5491112345678", buttonReplyId: "claim_ack_5000000001" });

    expect(eventRepo.log).toHaveBeenCalledWith(
      expect.objectContaining({ type: "claim_ack" })
    );
    expect(whatsAppClient.sendTextMessage).toHaveBeenCalledWith(
      expect.objectContaining({ to: "+5491112345678", text: expect.stringContaining("reclamo") })
    );
  });

  it("sends fallback message for unrecognized payload", async () => {
    const { useCase, approveUseCase, rejectUseCase, whatsAppClient } = makeUseCase();
    await useCase.execute({ from: "+5491112345678", text: "hola que tal" });

    expect(approveUseCase.execute).not.toHaveBeenCalled();
    expect(rejectUseCase.execute).not.toHaveBeenCalled();
    expect(whatsAppClient.sendTextMessage).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 3: Run tests**

```
npm test
```

Expected: all `HandleWhatsAppReplyUseCase` tests pass. Total: ~13 tests passing.

- [ ] **Step 4: Commit**

```
git add src/application/use-cases/HandleWhatsAppReplyUseCase.ts src/tests/HandleWhatsAppReplyUseCase.test.ts
git commit -m "feat: add HandleWhatsAppReplyUseCase for routing WA button replies"
```

---

## Task 8: Wire real WhatsApp into ProcessQuestionUseCase

**Files:**
- Modify: `src/application/use-cases/ProcessQuestionUseCase.ts`

- [ ] **Step 1: Add IWhatsAppClient as constructor parameter**

In `ProcessQuestionUseCase.ts`, add `IWhatsAppClient` import and inject it:

```typescript
import { IWhatsAppClient } from "../interfaces/IWhatsAppClient.js";
```

Update the constructor signature (add `whatsAppClient` as the last parameter):

```typescript
  constructor(
    private readonly questionRepo: IQuestionRepository,
    private readonly itemCacheRepo: IItemCacheRepository,
    private readonly tenantRepo: ITenantRepository,
    private readonly eventRepo: IEventRepository,
    private readonly meliClient: IMeliClient,
    private readonly llmService: ILLMService,
    private readonly realtimeNotifier: IRealtimeNotifier,
    private readonly whatsAppClient: IWhatsAppClient
  ) {}
```

- [ ] **Step 2: Send real WhatsApp when requiresHuman**

Find the `else` block where `question.markAsPendingReview(reviewReason)` is called (around line 189-220 of the original). After `this.realtimeNotifier.broadcastToSeller(sellerId, "whatsapp_notification", {...})`, add:

```typescript
        // Send real WhatsApp notification if tenant has a phone configured
        const tenantForWa = await this.tenantRepo.findBySellerId(sellerId);
        const waPhone = tenantForWa?.settings?.whatsappAlertPhone;
        if (waPhone) {
          await this.whatsAppClient.sendInteractiveButtons({
            to: waPhone,
            bodyText:
              `🤔 *Pregunta requiere revisión*\n\n` +
              `📦 Ítem: ${item.title}\n` +
              `💬 "${question.text}"\n\n` +
              `💡 Sugerencia: "${(classification.answer || "").slice(0, 100)}${classification.answer?.length > 100 ? "…" : ""}"\n\n` +
              `Motivo: ${reviewReason}`,
            buttons: [
              { id: `approve_${questionId}`, title: "✅ Aprobar" },
              { id: `reject_${questionId}`, title: "❌ Rechazar" },
            ],
          }).catch((err) => console.error("[ProcessQuestionUseCase] Error WA:", err));
        }
```

The full updated `else` block (lines ~189–221):

```typescript
      } else {
        const reviewReason = moderation.blocked
          ? moderation.reason!
          : !autoAnswerOn
          ? "Respuesta automática desactivada"
          : requiresHuman
          ? reason || "Requiere intervención humana"
          : `Confianza insuficiente (${classification.confidence.toFixed(2)})`;

        question.markAsPendingReview(reviewReason);
        await this.questionRepo.save(question);

        await this.eventRepo.log(
          new EventLog({
            sellerId,
            questionId,
            type: "pending_review",
            message: `👤 Enviado a revisión humana: ${reviewReason}`,
          })
        );

        this.realtimeNotifier.broadcastToSeller(sellerId, "whatsapp_notification", {
          question_id: questionId,
          seller_id: sellerId,
          item_title: item.title,
          item_price: item.price,
          question_text: question.text,
          reason: reviewReason,
          suggested_answer: classification.answer,
          intent: classification.intent,
          timestamp: new Date().toISOString(),
        });

        // Send real WhatsApp notification if tenant has a phone configured
        const tenantForWa = await this.tenantRepo.findBySellerId(sellerId);
        const waPhone = tenantForWa?.settings?.whatsappAlertPhone;
        if (waPhone) {
          await this.whatsAppClient.sendInteractiveButtons({
            to: waPhone,
            bodyText:
              `🤔 *Pregunta requiere revisión*\n\n` +
              `📦 Ítem: ${item.title}\n` +
              `💬 "${question.text}"\n\n` +
              `💡 Sugerencia: "${(classification.answer || "").slice(0, 100)}${(classification.answer || "").length > 100 ? "…" : ""}"\n\n` +
              `Motivo: ${reviewReason}`,
            buttons: [
              { id: `approve_${questionId}`, title: "✅ Aprobar" },
              { id: `reject_${questionId}`, title: "❌ Rechazar" },
            ],
          }).catch((err) => console.error("[ProcessQuestionUseCase] Error WA:", err));
        }
      }
```

- [ ] **Step 3: Verify build**

```
npm run build
```

Expected: TypeScript error in `app.ts` because `ProcessQuestionUseCase` constructor now requires a new argument. Fixed in Task 10.

- [ ] **Step 4: Commit (build error OK at this point)**

```
git add src/application/use-cases/ProcessQuestionUseCase.ts
git commit -m "feat: wire IWhatsAppClient into ProcessQuestionUseCase for real WA alerts on human review"
```

---

## Task 9: WhatsAppWebhookController

**Files:**
- Create: `src/presentation/controllers/WhatsAppWebhookController.ts`

- [ ] **Step 1: Create the controller**

```typescript
// src/presentation/controllers/WhatsAppWebhookController.ts
import { FastifyRequest, FastifyReply } from "fastify";
import { HandleWhatsAppReplyUseCase } from "../../application/use-cases/HandleWhatsAppReplyUseCase.js";

export class WhatsAppWebhookController {
  constructor(private readonly handleReplyUseCase: HandleWhatsAppReplyUseCase) {}

  // GET /webhook/whatsapp — Meta challenge verification
  public verify = async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as any;
    const mode = query["hub.mode"];
    const token = query["hub.verify_token"];
    const challenge = query["hub.challenge"];

    if (mode === "subscribe" && token === process.env.META_WA_VERIFY_TOKEN) {
      return reply.status(200).send(challenge);
    }
    return reply.status(403).send("Forbidden");
  };

  // POST /webhook/whatsapp — incoming messages from Meta
  public receive = async (request: FastifyRequest, reply: FastifyReply) => {
    // Always respond 200 immediately to Meta
    reply.status(200).send({ ok: true });

    try {
      const body = request.body as any;
      const entry = body?.entry?.[0];
      const changes = entry?.changes?.[0];
      const value = changes?.value;
      const messages = value?.messages;

      if (!Array.isArray(messages) || messages.length === 0) return;

      for (const msg of messages) {
        const from: string = msg.from || "";

        if (msg.type === "interactive" && msg.interactive?.type === "button_reply") {
          const buttonReplyId: string = msg.interactive.button_reply.id;
          await this.handleReplyUseCase.execute({ from, buttonReplyId });
        } else if (msg.type === "text" && msg.text?.body) {
          await this.handleReplyUseCase.execute({ from, text: msg.text.body });
        }
      }
    } catch (err) {
      console.error("[WhatsAppWebhookController] Error procesando mensaje:", err);
    }
  };
}
```

- [ ] **Step 2: Commit**

```
git add src/presentation/controllers/WhatsAppWebhookController.ts
git commit -m "feat: add WhatsAppWebhookController (Meta challenge + message receiver)"
```

---

## Task 10: Wire everything in WebhookController + app.ts

**Files:**
- Modify: `src/presentation/controllers/WebhookController.ts`
- Modify: `src/app.ts`

- [ ] **Step 1: Update WebhookController to bifurcate by topic**

```typescript
// src/presentation/controllers/WebhookController.ts
import { FastifyRequest, FastifyReply } from "fastify";
import { IngestWebhookUseCase, WebhookPayload } from "../../application/use-cases/IngestWebhookUseCase.js";
import { IngestClaimWebhookUseCase } from "../../application/use-cases/IngestClaimWebhookUseCase.js";

export class WebhookController {
  constructor(
    private readonly ingestQuestionUseCase: IngestWebhookUseCase,
    private readonly ingestClaimUseCase: IngestClaimWebhookUseCase
  ) {}

  public handle = async (request: FastifyRequest<{ Body: WebhookPayload }>, reply: FastifyReply) => {
    reply.status(200).send({ received: true });

    const body = request.body || {};
    const topic = (body as any).topic as string | undefined;

    try {
      if (topic === "post_purchase" || topic === "claims") {
        await this.ingestClaimUseCase.execute(body);
      } else {
        await this.ingestQuestionUseCase.execute(body);
      }
    } catch (err) {
      request.log.error({ err }, "Error procesando webhook");
    }
  };
}
```

- [ ] **Step 2: Update app.ts to wire all new components**

Replace the full `app.ts` with the updated version. The key additions are:
1. Import all new classes
2. Instantiate `MetaWhatsAppClient`, `SqliteClaimRepository`
3. Instantiate `ProcessClaimUseCase`, `IngestClaimWebhookUseCase`, `HandleWhatsAppReplyUseCase`
4. Update `WebhookController` constructor call (add `ingestClaimUseCase`)
5. Update `ProcessQuestionUseCase` constructor call (add `whatsAppClient`)
6. Add `WhatsAppWebhookController`
7. Register routes `GET /webhook/whatsapp` and `POST /webhook/whatsapp`

```typescript
// src/app.ts
import fastify, { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import cors from "@fastify/cors";
import fastifyStatic from "@fastify/static";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { SqliteDatabase } from "./infrastructure/persistence/sqlite/SqliteDatabase.js";
import { SqliteTenantRepository } from "./infrastructure/persistence/sqlite/SqliteTenantRepository.js";
import { SqliteQuestionRepository } from "./infrastructure/persistence/sqlite/SqliteQuestionRepository.js";
import { SqliteItemCacheRepository } from "./infrastructure/persistence/sqlite/SqliteItemCacheRepository.js";
import { SqliteEventRepository } from "./infrastructure/persistence/sqlite/SqliteEventRepository.js";
import { SqliteUserRepository } from "./infrastructure/persistence/sqlite/SqliteUserRepository.js";
import { SqliteClaimRepository } from "./infrastructure/persistence/sqlite/SqliteClaimRepository.js";

import { CryptoPasswordHasher } from "./infrastructure/security/CryptoPasswordHasher.js";
import { JwtTokenService } from "./infrastructure/security/JwtTokenService.js";

import { MeliApiClient } from "./infrastructure/meli/MeliApiClient.js";
import { LangChainLLMService } from "./infrastructure/llm/LangChainLLMService.js";
import { InMemoryQueueBroker } from "./infrastructure/queue/InMemoryQueueBroker.js";
import { FastifySseNotifier } from "./infrastructure/realtime/FastifySseNotifier.js";
import { MetaWhatsAppClient } from "./infrastructure/whatsapp/MetaWhatsAppClient.js";

import { IngestWebhookUseCase } from "./application/use-cases/IngestWebhookUseCase.js";
import { IngestClaimWebhookUseCase } from "./application/use-cases/IngestClaimWebhookUseCase.js";
import { ProcessQuestionUseCase } from "./application/use-cases/ProcessQuestionUseCase.js";
import { ProcessClaimUseCase } from "./application/use-cases/ProcessClaimUseCase.js";
import { ApproveAnswerUseCase } from "./application/use-cases/ApproveAnswerUseCase.js";
import { RejectAnswerUseCase } from "./application/use-cases/RejectAnswerUseCase.js";
import { SimulateQuestionUseCase } from "./application/use-cases/SimulateQuestionUseCase.js";
import { HandleWhatsAppReplyUseCase } from "./application/use-cases/HandleWhatsAppReplyUseCase.js";

import { RegisterUserUseCase } from "./application/use-cases/auth/RegisterUserUseCase.js";
import { LoginUserUseCase } from "./application/use-cases/auth/LoginUserUseCase.js";
import { GetCurrentUserUseCase } from "./application/use-cases/auth/GetCurrentUserUseCase.js";
import { SeedSuperAdminUseCase } from "./application/use-cases/auth/SeedSuperAdminUseCase.js";
import { ConnectMeliAccountUseCase } from "./application/use-cases/auth/ConnectMeliAccountUseCase.js";
import { GetOnboardingStatusUseCase } from "./application/use-cases/auth/GetOnboardingStatusUseCase.js";

import { GetGlobalMetricsUseCase } from "./application/use-cases/admin/GetGlobalMetricsUseCase.js";
import { ListTenantsOverviewUseCase } from "./application/use-cases/admin/ListTenantsOverviewUseCase.js";
import { GetTenantDetailUseCase } from "./application/use-cases/admin/GetTenantDetailUseCase.js";
import { ToggleTenantAutoAnswerUseCase } from "./application/use-cases/admin/ToggleTenantAutoAnswerUseCase.js";
import { ForceTokenRefreshUseCase } from "./application/use-cases/admin/ForceTokenRefreshUseCase.js";

import { WebhookController } from "./presentation/controllers/WebhookController.js";
import { QuestionsController } from "./presentation/controllers/QuestionsController.js";
import { AuthController } from "./presentation/controllers/AuthController.js";
import { SimulatorController } from "./presentation/controllers/SimulatorController.js";
import { TenantController } from "./presentation/controllers/TenantController.js";
import { AdminController } from "./presentation/controllers/AdminController.js";
import { WhatsAppWebhookController } from "./presentation/controllers/WhatsAppWebhookController.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function buildApp(): FastifyInstance {
  const app = fastify({ logger: true });

  app.register(cors, { origin: "*" });
  app.register(fastifyStatic, {
    root: path.join(__dirname, "../public"),
    prefix: "/",
  });

  // Persistencia y Seguridad
  const db = SqliteDatabase.getInstance();
  const tenantRepo = new SqliteTenantRepository(db);
  const questionRepo = new SqliteQuestionRepository(db);
  const itemCacheRepo = new SqliteItemCacheRepository(db);
  const eventRepo = new SqliteEventRepository(db);
  const userRepo = new SqliteUserRepository(db);
  const claimRepo = new SqliteClaimRepository(db);

  const passwordHasher = new CryptoPasswordHasher();
  const tokenService = new JwtTokenService();

  // Adaptadores
  const meliClient = new MeliApiClient(tenantRepo);
  const llmService = new LangChainLLMService();
  const queueBroker = new InMemoryQueueBroker(5);
  const sseNotifier = new FastifySseNotifier();
  const whatsAppClient = new MetaWhatsAppClient();

  // Casos de Uso Auth
  const registerUserUseCase = new RegisterUserUseCase(userRepo, passwordHasher, tokenService);
  const loginUserUseCase = new LoginUserUseCase(userRepo, passwordHasher, tokenService);
  const getCurrentUserUseCase = new GetCurrentUserUseCase(userRepo);
  const seedSuperAdminUseCase = new SeedSuperAdminUseCase(userRepo, passwordHasher);
  const connectMeliAccountUseCase = new ConnectMeliAccountUseCase(
    meliClient, tenantRepo, userRepo, eventRepo, tokenService
  );
  const getOnboardingStatusUseCase = new GetOnboardingStatusUseCase(userRepo, tenantRepo);

  seedSuperAdminUseCase.execute().catch((err) => console.error("Error seeding super admin:", err));

  // Casos de Uso Core
  const approveAnswerUseCase = new ApproveAnswerUseCase(questionRepo, meliClient, eventRepo, sseNotifier);
  const rejectAnswerUseCase = new RejectAnswerUseCase(questionRepo, eventRepo, sseNotifier);

  const ingestWebhookUseCase = new IngestWebhookUseCase(queueBroker, eventRepo);

  const processClaimUseCase = new ProcessClaimUseCase(
    claimRepo, tenantRepo, eventRepo, meliClient, whatsAppClient, sseNotifier
  );
  const ingestClaimUseCase = new IngestClaimWebhookUseCase(processClaimUseCase, eventRepo);

  const processQuestionUseCase = new ProcessQuestionUseCase(
    questionRepo, itemCacheRepo, tenantRepo, eventRepo, meliClient, llmService, sseNotifier, whatsAppClient
  );

  const simulateQuestionUseCase = new SimulateQuestionUseCase(
    questionRepo, tenantRepo, eventRepo, llmService, sseNotifier
  );

  const handleWhatsAppReplyUseCase = new HandleWhatsAppReplyUseCase(
    approveAnswerUseCase, rejectAnswerUseCase, eventRepo, whatsAppClient
  );

  // Casos de Uso Admin
  const getGlobalMetricsUseCase = new GetGlobalMetricsUseCase(questionRepo, tenantRepo);
  const listTenantsOverviewUseCase = new ListTenantsOverviewUseCase(tenantRepo, questionRepo);
  const getTenantDetailUseCase = new GetTenantDetailUseCase(tenantRepo, questionRepo, eventRepo);
  const toggleTenantAutoAnswerUseCase = new ToggleTenantAutoAnswerUseCase(tenantRepo, eventRepo);
  const forceTokenRefreshUseCase = new ForceTokenRefreshUseCase(tenantRepo, meliClient, eventRepo);

  // Workers
  queueBroker.registerProcessor(async (job) => {
    await processQuestionUseCase.execute(job);
  });

  // Auth guards
  const authenticate = async (request: FastifyRequest, reply: FastifyReply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return reply.status(401).send({ error: "Token de autorización requerido." });
    }
    const token = authHeader.substring(7);
    try {
      const payload = tokenService.verifyToken(token);
      (request as any).user = payload;
    } catch (err: any) {
      return reply.status(401).send({ error: `Token inválido: ${err.message}` });
    }
  };

  const requireSuperAdmin = async (request: FastifyRequest, reply: FastifyReply) => {
    await authenticate(request, reply);
    if (reply.sent) return;
    const user = (request as any).user;
    if (!user || user.role !== "super_admin") {
      return reply.status(403).send({ error: "Acceso denegado: se requieren permisos de Super Administrador." });
    }
  };

  const optionalAuthenticate = async (request: FastifyRequest) => {
    const authHeader = request.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.substring(7);
      try {
        const payload = tokenService.verifyToken(token);
        (request as any).user = payload;
      } catch (err) {
        // ignore
      }
    }
  };

  // Controladores
  const webhookCtrl = new WebhookController(ingestWebhookUseCase, ingestClaimUseCase);
  const questionsCtrl = new QuestionsController(questionRepo, approveAnswerUseCase, rejectAnswerUseCase);
  const authCtrl = new AuthController(
    registerUserUseCase, loginUserUseCase, getCurrentUserUseCase,
    connectMeliAccountUseCase, getOnboardingStatusUseCase, tokenService
  );
  const simulatorCtrl = new SimulatorController(simulateQuestionUseCase);
  const tenantCtrl = new TenantController(tenantRepo, eventRepo, llmService);
  const adminCtrl = new AdminController(
    getGlobalMetricsUseCase, listTenantsOverviewUseCase, getTenantDetailUseCase,
    toggleTenantAutoAnswerUseCase, forceTokenRefreshUseCase
  );
  const waWebhookCtrl = new WhatsAppWebhookController(handleWhatsAppReplyUseCase);

  // Rutas — Auth
  app.post("/api/auth/register", authCtrl.register);
  app.post("/api/auth/login", authCtrl.login);
  app.get("/api/auth/me", { preHandler: authenticate }, authCtrl.getMe);
  app.get("/api/auth/onboarding-status", { preHandler: authenticate }, authCtrl.getOnboardingStatus);
  app.get("/api/auth/meli-auth-url", { preHandler: optionalAuthenticate }, authCtrl.getMeliAuthUrl);

  // Rutas — Super Admin
  app.get("/api/admin/metrics", { preHandler: requireSuperAdmin }, adminCtrl.getMetrics);
  app.get("/api/admin/tenants", { preHandler: requireSuperAdmin }, adminCtrl.getTenants);
  app.get("/api/admin/tenants/:sellerId", { preHandler: requireSuperAdmin }, adminCtrl.getTenantDetail);
  app.post("/api/admin/tenants/:sellerId/toggle", { preHandler: requireSuperAdmin }, adminCtrl.toggleAutoAnswer);
  app.post("/api/admin/tenants/:sellerId/refresh-token", { preHandler: requireSuperAdmin }, adminCtrl.refreshToken);

  // Rutas — Webhooks & OAuth
  app.post("/webhook/ml", webhookCtrl.handle);
  app.get("/webhook/whatsapp", waWebhookCtrl.verify);
  app.post("/webhook/whatsapp", waWebhookCtrl.receive);
  app.get("/oauth/login", { preHandler: optionalAuthenticate }, authCtrl.meliOAuthLogin);
  app.get("/oauth/callback", authCtrl.meliOAuthCallback);

  // Rutas — SSE
  app.get("/api/events/stream", (request, reply) => {
    const sellerId = (request.query as any)?.seller_id;
    sseNotifier.registerClient(reply, sellerId);
  });

  // Rutas — Questions & Actions
  app.get("/api/questions", { preHandler: optionalAuthenticate }, questionsCtrl.getQuestions);
  app.post("/api/questions/:id/approve", { preHandler: optionalAuthenticate }, questionsCtrl.approve);
  app.post("/api/questions/:id/reject", { preHandler: optionalAuthenticate }, questionsCtrl.reject);
  app.post("/api/whatsapp/reply", questionsCtrl.replyViaWhatsapp);

  // Rutas — Simulator & Health
  app.post("/api/simulate-question", simulatorCtrl.simulate);
  app.get("/api/health", tenantCtrl.getHealth);
  app.get("/api/events", { preHandler: optionalAuthenticate }, tenantCtrl.getEvents);
  app.post("/api/config/auto-answer", { preHandler: optionalAuthenticate }, tenantCtrl.updateSettings);

  return app;
}
```

- [ ] **Step 3: Verify build passes with 0 errors**

```
npm run build
```

Expected: **0 TypeScript errors**.

- [ ] **Step 4: Run all tests**

```
npm test
```

Expected: all tests pass (~13 tests across 3 test files).

- [ ] **Step 5: Start the server and verify it boots**

```
npm run dev
```

Expected: server starts without errors. Check log output — no `SqliteError`, no TypeScript runtime errors.

- [ ] **Step 6: Commit**

```
git add src/presentation/controllers/WebhookController.ts src/app.ts
git commit -m "feat: wire WhatsApp + Claims into WebhookController and app.ts — integration complete"
```

---

## Post-Implementation Checklist

After all tasks are done:

- [ ] **Add env vars to `.env`** (create from `.env.example` if it exists):
  ```ini
  META_WA_PHONE_NUMBER_ID=your_phone_number_id
  META_WA_ACCESS_TOKEN=your_permanent_token
  META_WA_VERIFY_TOKEN=meli_bot_webhook_secret_token_123456
  ```

- [ ] **Configure ML app** in `developers.mercadolibre.com.ar` to send `post_purchase` webhook topic to your `/webhook/ml` URL.

- [ ] **Configure Meta app** in `developers.facebook.com` to send webhook to `/webhook/whatsapp` with the `META_WA_VERIFY_TOKEN` value.

- [ ] **Add `whatsappAlertPhone`** to a test tenant's settings via the admin API or directly in SQLite to test end-to-end.
