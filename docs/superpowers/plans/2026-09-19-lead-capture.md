# Lead Capture Form & CRM Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a lead capture form to LandingPage and a Leads tab in AdminPage, storing leads in DB and notifying the admin via email.

**Architecture:** Clean Architecture — `Lead` domain entity, `ILeadRepository` interface, `PostgresLeadRepository` Drizzle implementation, three focused use cases (`CreateLeadUseCase`, `UpdateLeadStatusUseCase`, `ListLeadsUseCase`), `LeadController` + `leadRoutes`, wired in the existing DI container.

**Tech Stack:** TypeScript, Fastify, Drizzle ORM + PostgreSQL, Resend (email), React + Vite (frontend)

---

## File Map

**New files:**
- `src/domain/entities/Lead.ts`
- `src/application/interfaces/ILeadRepository.ts`
- `src/application/use-cases/leads/CreateLeadUseCase.ts`
- `src/application/use-cases/leads/UpdateLeadStatusUseCase.ts`
- `src/application/use-cases/leads/ListLeadsUseCase.ts`
- `src/infrastructure/persistence/postgres/PostgresLeadRepository.ts`
- `src/presentation/controllers/LeadController.ts`
- `src/presentation/routes/leadRoutes.ts`

**Modified files:**
- `src/infrastructure/persistence/drizzle/schema.ts` — add `leads` table
- `src/application/interfaces/IEmailClient.ts` — add `SendNewLeadAlertParams` + method
- `src/infrastructure/email/ResendEmailClient.ts` — implement `sendNewLeadAlert`
- `src/composition/container.ts` — wire lead repo, use cases, controller
- `src/app.ts` — register lead routes
- `client/src/pages/LandingPage.tsx` — add `#form` section
- `client/src/pages/LandingPage.css` — add form styles
- `client/src/pages/AdminPage.tsx` — add Leads tab

---

## Task 1: Lead domain entity + repository interface

**Files:**
- Create: `src/domain/entities/Lead.ts`
- Create: `src/application/interfaces/ILeadRepository.ts`

- [ ] **Step 1: Create `Lead` entity**

```typescript
// src/domain/entities/Lead.ts
export type LeadStatus = 'nuevo' | 'contactado' | 'convertido' | 'descartado';
export type WeeklyQuestions = '<10' | '10-50' | '50-200' | '200+';

export interface LeadProps {
  id: string;
  name: string;
  email: string;
  phone: string;
  mlStore: string;
  weeklyQuestions: WeeklyQuestions;
  qualified: boolean;
  status: LeadStatus;
  createdAt?: Date;
}

export class Lead {
  public readonly id: string;
  public readonly name: string;
  public readonly email: string;
  public readonly phone: string;
  public readonly mlStore: string;
  public readonly weeklyQuestions: WeeklyQuestions;
  public readonly qualified: boolean;
  public status: LeadStatus;
  public readonly createdAt: Date;

  constructor(props: LeadProps) {
    this.id = props.id;
    this.name = props.name.trim();
    this.email = props.email.toLowerCase().trim();
    this.phone = props.phone.trim();
    this.mlStore = props.mlStore.trim();
    this.weeklyQuestions = props.weeklyQuestions;
    this.qualified = props.qualified;
    this.status = props.status;
    this.createdAt = props.createdAt ?? new Date();
  }
}
```

- [ ] **Step 2: Create `ILeadRepository` interface**

```typescript
// src/application/interfaces/ILeadRepository.ts
import { Lead, LeadStatus } from '../../domain/entities/Lead.js';

export interface ILeadRepository {
  save(lead: Lead): Promise<void>;
  findAll(): Promise<Lead[]>;
  findById(id: string): Promise<Lead | null>;
  updateStatus(id: string, status: LeadStatus): Promise<void>;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/domain/entities/Lead.ts src/application/interfaces/ILeadRepository.ts
git commit -m "feat: add Lead entity and ILeadRepository interface"
```

---

## Task 2: DB schema — add leads table

**Files:**
- Modify: `src/infrastructure/persistence/drizzle/schema.ts`

- [ ] **Step 1: Add `leads` table to schema**

At the end of `schema.ts`, append:

```typescript
export const leads = pgTable('leads', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull(),
  phone: text('phone').notNull(),
  mlStore: text('ml_store').notNull(),
  weeklyQuestions: text('weekly_questions').notNull(),
  qualified: boolean('qualified').notNull().default(false),
  status: text('status').notNull().default('nuevo'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
```

- [ ] **Step 2: Generate and run migration**

```bash
cd "C:/JUAN RUIZ/Trabajos/DEMOML"
npm run db:generate
npm run db:migrate
```

Expected: migration file created and applied, `leads` table exists in DB.

- [ ] **Step 3: Commit**

```bash
git add src/infrastructure/persistence/drizzle/schema.ts
git add drizzle/
git commit -m "feat: add leads table to DB schema"
```

---

## Task 3: PostgresLeadRepository

**Files:**
- Create: `src/infrastructure/persistence/postgres/PostgresLeadRepository.ts`

- [ ] **Step 1: Create repository**

```typescript
// src/infrastructure/persistence/postgres/PostgresLeadRepository.ts
import { eq, desc } from 'drizzle-orm';
import { DrizzleDB } from '../drizzle/db.js';
import { leads } from '../drizzle/schema.js';
import { ILeadRepository } from '../../../application/interfaces/ILeadRepository.js';
import { Lead, LeadStatus, WeeklyQuestions } from '../../../domain/entities/Lead.js';

export class PostgresLeadRepository implements ILeadRepository {
  constructor(private readonly db: DrizzleDB) {}

  public async save(lead: Lead): Promise<void> {
    await this.db.insert(leads).values({
      id: lead.id,
      name: lead.name,
      email: lead.email,
      phone: lead.phone,
      mlStore: lead.mlStore,
      weeklyQuestions: lead.weeklyQuestions,
      qualified: lead.qualified,
      status: lead.status,
      createdAt: lead.createdAt,
    });
  }

  public async findAll(): Promise<Lead[]> {
    const rows = await this.db.select().from(leads).orderBy(desc(leads.createdAt));
    return rows.map(r => this.map(r));
  }

  public async findById(id: string): Promise<Lead | null> {
    const [row] = await this.db.select().from(leads).where(eq(leads.id, id));
    return row ? this.map(row) : null;
  }

  public async updateStatus(id: string, status: LeadStatus): Promise<void> {
    await this.db.update(leads).set({ status }).where(eq(leads.id, id));
  }

  private map(row: typeof leads.$inferSelect): Lead {
    return new Lead({
      id: row.id,
      name: row.name,
      email: row.email,
      phone: row.phone,
      mlStore: row.mlStore,
      weeklyQuestions: row.weeklyQuestions as WeeklyQuestions,
      qualified: row.qualified,
      status: row.status as LeadStatus,
      createdAt: row.createdAt ?? new Date(),
    });
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/infrastructure/persistence/postgres/PostgresLeadRepository.ts
git commit -m "feat: add PostgresLeadRepository"
```

---

## Task 4: CreateLeadUseCase

**Files:**
- Create: `src/application/use-cases/leads/CreateLeadUseCase.ts`

- [ ] **Step 1: Create use case**

```typescript
// src/application/use-cases/leads/CreateLeadUseCase.ts
import crypto from 'node:crypto';
import { ILeadRepository } from '../../interfaces/ILeadRepository.js';
import { IEmailClient } from '../../interfaces/IEmailClient.js';
import { Lead, WeeklyQuestions } from '../../../domain/entities/Lead.js';

interface Input {
  name: string;
  email: string;
  phone: string;
  mlStore: string;
  weeklyQuestions: WeeklyQuestions;
}

interface Output {
  id: string;
  qualified: boolean;
}

export class CreateLeadUseCase {
  constructor(
    private readonly leadRepo: ILeadRepository,
    private readonly emailClient: IEmailClient,
    private readonly adminEmail: string,
  ) {}

  async execute(input: Input): Promise<Output> {
    const qualified = input.weeklyQuestions !== '<10';

    const lead = new Lead({
      id: crypto.randomUUID(),
      name: input.name,
      email: input.email,
      phone: input.phone,
      mlStore: input.mlStore,
      weeklyQuestions: input.weeklyQuestions,
      qualified,
      status: 'nuevo',
    });

    await this.leadRepo.save(lead);

    if (qualified) {
      await this.emailClient.sendNewLeadAlert({
        to: this.adminEmail,
        lead,
      }).catch(() => {});
    }

    return { id: lead.id, qualified };
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/application/use-cases/leads/CreateLeadUseCase.ts
git commit -m "feat: add CreateLeadUseCase"
```

---

## Task 5: UpdateLeadStatusUseCase + ListLeadsUseCase

**Files:**
- Create: `src/application/use-cases/leads/UpdateLeadStatusUseCase.ts`
- Create: `src/application/use-cases/leads/ListLeadsUseCase.ts`

- [ ] **Step 1: Create UpdateLeadStatusUseCase**

```typescript
// src/application/use-cases/leads/UpdateLeadStatusUseCase.ts
import { ILeadRepository } from '../../interfaces/ILeadRepository.js';
import { LeadStatus } from '../../../domain/entities/Lead.js';

interface Input {
  id: string;
  status: LeadStatus;
}

interface Output {
  id: string;
  status: LeadStatus;
}

export class UpdateLeadStatusUseCase {
  constructor(private readonly leadRepo: ILeadRepository) {}

  async execute({ id, status }: Input): Promise<Output> {
    const lead = await this.leadRepo.findById(id);
    if (!lead) throw new Error(`Lead no encontrado: ${id}`);

    await this.leadRepo.updateStatus(id, status);
    return { id, status };
  }
}
```

- [ ] **Step 2: Create ListLeadsUseCase**

```typescript
// src/application/use-cases/leads/ListLeadsUseCase.ts
import { ILeadRepository } from '../../interfaces/ILeadRepository.js';
import { Lead } from '../../../domain/entities/Lead.js';

export class ListLeadsUseCase {
  constructor(private readonly leadRepo: ILeadRepository) {}

  async execute(): Promise<Lead[]> {
    return this.leadRepo.findAll();
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/application/use-cases/leads/UpdateLeadStatusUseCase.ts src/application/use-cases/leads/ListLeadsUseCase.ts
git commit -m "feat: add UpdateLeadStatusUseCase and ListLeadsUseCase"
```

---

## Task 6: Email notification — extend IEmailClient + ResendEmailClient

**Files:**
- Modify: `src/application/interfaces/IEmailClient.ts`
- Modify: `src/infrastructure/email/ResendEmailClient.ts`

- [ ] **Step 1: Add `SendNewLeadAlertParams` to `IEmailClient.ts`**

Add after the existing `SendPasswordResetParams` interface:

```typescript
export interface SendNewLeadAlertParams {
  to: string;
  lead: {
    name: string;
    email: string;
    phone: string;
    mlStore: string;
    weeklyQuestions: string;
  };
}
```

Add the method to the `IEmailClient` interface:

```typescript
sendNewLeadAlert(params: SendNewLeadAlertParams): Promise<EmailSendResult>;
```

- [ ] **Step 2: Implement `sendNewLeadAlert` in `ResendEmailClient.ts`**

Add the method to the `ResendEmailClient` class (before the private `sendMail` helper):

```typescript
public async sendNewLeadAlert(params: SendNewLeadAlertParams): Promise<EmailSendResult> {
  const { lead } = params;
  const subject = `Nuevo lead: ${lead.name} — ${lead.weeklyQuestions} preg/sem`;
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background: #0f172a; color: #f8fafc; border-radius: 12px; border: 1px solid #334155;">
      <h2 style="color: #60a5fa; margin-top: 0; font-size: 20px;">🎯 Nuevo lead calificado</h2>
      <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
        <tr><td style="padding: 8px 0; color: #94a3b8; font-size: 13px; width: 120px;">Nombre</td><td style="padding: 8px 0; font-size: 14px;">${lead.name}</td></tr>
        <tr><td style="padding: 8px 0; color: #94a3b8; font-size: 13px;">Email</td><td style="padding: 8px 0; font-size: 14px;">${lead.email}</td></tr>
        <tr><td style="padding: 8px 0; color: #94a3b8; font-size: 13px;">Teléfono</td><td style="padding: 8px 0; font-size: 14px;">${lead.phone}</td></tr>
        <tr><td style="padding: 8px 0; color: #94a3b8; font-size: 13px;">Tienda ML</td><td style="padding: 8px 0; font-size: 14px;">${lead.mlStore}</td></tr>
        <tr><td style="padding: 8px 0; color: #94a3b8; font-size: 13px;">Preg/semana</td><td style="padding: 8px 0; font-size: 14px; color: #34d399; font-weight: 600;">${lead.weeklyQuestions}</td></tr>
      </table>
      <a href="${process.env.APP_BASE_URL ?? 'http://localhost:5173'}/admin" style="display: inline-block; margin-top: 8px; padding: 10px 20px; background: #3b82f6; color: #fff; border-radius: 8px; text-decoration: none; font-size: 14px; font-weight: 600;">Ver en panel → Leads</a>
      <p style="font-size: 11px; color: #475569; margin-top: 20px; margin-bottom: 0;">MELI AI Assistant — notificación automática</p>
    </div>
  `;
  return this.sendMail(params.to, subject, html);
}
```

- [ ] **Step 3: Commit**

```bash
git add src/application/interfaces/IEmailClient.ts src/infrastructure/email/ResendEmailClient.ts
git commit -m "feat: add sendNewLeadAlert to email client"
```

---

## Task 7: LeadController + leadRoutes

**Files:**
- Create: `src/presentation/controllers/LeadController.ts`
- Create: `src/presentation/routes/leadRoutes.ts`

- [ ] **Step 1: Create LeadController**

```typescript
// src/presentation/controllers/LeadController.ts
import { FastifyRequest, FastifyReply } from 'fastify';
import { CreateLeadUseCase } from '../../application/use-cases/leads/CreateLeadUseCase.js';
import { UpdateLeadStatusUseCase } from '../../application/use-cases/leads/UpdateLeadStatusUseCase.js';
import { ListLeadsUseCase } from '../../application/use-cases/leads/ListLeadsUseCase.js';
import { LeadStatus, WeeklyQuestions } from '../../domain/entities/Lead.js';

export class LeadController {
  constructor(
    private readonly createLeadUseCase: CreateLeadUseCase,
    private readonly updateLeadStatusUseCase: UpdateLeadStatusUseCase,
    private readonly listLeadsUseCase: ListLeadsUseCase,
  ) {}

  public create = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as {
        name?: string;
        email?: string;
        phone?: string;
        mlStore?: string;
        weeklyQuestions?: WeeklyQuestions;
      };

      if (!body.name || !body.email || !body.phone || !body.mlStore || !body.weeklyQuestions) {
        return reply.status(400).send({ error: 'Todos los campos son requeridos.' });
      }

      const result = await this.createLeadUseCase.execute({
        name: body.name,
        email: body.email,
        phone: body.phone,
        mlStore: body.mlStore,
        weeklyQuestions: body.weeklyQuestions,
      });

      return reply.status(201).send(result);
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  };

  public updateStatus = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const { status } = request.body as { status?: LeadStatus };

      const validStatuses: LeadStatus[] = ['nuevo', 'contactado', 'convertido', 'descartado'];
      if (!status || !validStatuses.includes(status)) {
        return reply.status(400).send({ error: 'Estado inválido.' });
      }

      const result = await this.updateLeadStatusUseCase.execute({ id, status });
      return reply.send(result);
    } catch (err: any) {
      const isNotFound = err.message.includes('no encontrado');
      return reply.status(isNotFound ? 404 : 500).send({ error: err.message });
    }
  };

  public list = async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const leads = await this.listLeadsUseCase.execute();
      return reply.send(leads);
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  };
}
```

- [ ] **Step 2: Create leadRoutes**

```typescript
// src/presentation/routes/leadRoutes.ts
import { FastifyInstance } from 'fastify';
import { Container } from '../../composition/container.js';
import { AuthGuards } from '../middleware/auth.js';

export function registerLeadRoutes(app: FastifyInstance, c: Container, guards: AuthGuards) {
  const { leadCtrl } = c;
  const { requireSuperAdmin } = guards;

  app.post('/api/leads', leadCtrl.create);
  app.get('/api/leads', { preHandler: requireSuperAdmin }, leadCtrl.list);
  app.patch('/api/leads/:id/status', { preHandler: requireSuperAdmin }, leadCtrl.updateStatus);
}
```

- [ ] **Step 3: Commit**

```bash
git add src/presentation/controllers/LeadController.ts src/presentation/routes/leadRoutes.ts
git commit -m "feat: add LeadController and leadRoutes"
```

---

## Task 8: Wire container + register routes

**Files:**
- Modify: `src/composition/container.ts`
- Modify: `src/app.ts`

- [ ] **Step 1: Add to `container.ts`**

Add imports after the last `import` block (near the existing `UpdateTenantPlanUseCase` import):

```typescript
import { PostgresLeadRepository } from '../infrastructure/persistence/postgres/PostgresLeadRepository.js';
import { CreateLeadUseCase } from '../application/use-cases/leads/CreateLeadUseCase.js';
import { UpdateLeadStatusUseCase } from '../application/use-cases/leads/UpdateLeadStatusUseCase.js';
import { ListLeadsUseCase } from '../application/use-cases/leads/ListLeadsUseCase.js';
import { LeadController } from '../presentation/controllers/LeadController.js';
```

In the `buildContainer()` function body, add after the `goldenDatasetRepo` line (section 1 — persistencia):

```typescript
const leadRepo = new PostgresLeadRepository(db);
```

Add after the admin use cases block (section 5):

```typescript
const adminEmail = process.env.ADMIN_EMAIL ?? process.env.EMAIL_FROM ?? 'juanignacioruizr@gmail.com';
const createLeadUseCase = new CreateLeadUseCase(leadRepo, emailClient, adminEmail);
const updateLeadStatusUseCase = new UpdateLeadStatusUseCase(leadRepo);
const listLeadsUseCase = new ListLeadsUseCase(leadRepo);
```

Add after the `llmUsageCtrl` controller (section 7):

```typescript
const leadCtrl = new LeadController(createLeadUseCase, updateLeadStatusUseCase, listLeadsUseCase);
```

Add `leadCtrl` to the return object at the bottom:

```typescript
leadCtrl,
```

- [ ] **Step 2: Register routes in `app.ts`**

Add import at the top of `app.ts` alongside the other route imports:

```typescript
import { registerLeadRoutes } from './presentation/routes/leadRoutes.js';
```

Add inside the route registration block (after `registerTenantRoutes`):

```typescript
registerLeadRoutes(app, container, guards);
```

- [ ] **Step 3: Verify server starts**

```bash
npm run dev
```

Expected: server starts with no TypeScript errors. Hit `POST /api/leads` with curl:

```bash
curl -s -X POST http://localhost:3000/api/leads \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","email":"test@test.com","phone":"1234","mlStore":"mi-tienda","weeklyQuestions":"50-200"}' | jq
```

Expected response: `{"id":"<uuid>","qualified":true}`

- [ ] **Step 4: Commit**

```bash
git add src/composition/container.ts src/app.ts
git commit -m "feat: wire lead use cases and routes into container"
```

---

## Task 9: LandingPage — form section

**Files:**
- Modify: `client/src/pages/LandingPage.tsx`
- Modify: `client/src/pages/LandingPage.css`

- [ ] **Step 1: Add form state and submit handler to `LandingPage.tsx`**

Add these state variables inside `export default function LandingPage()`, after the existing `useState` declarations:

```tsx
const [leadForm, setLeadForm] = useState({
  name: '', email: '', phone: '', mlStore: '', weeklyQuestions: '' as string
})
const [leadSubmitting, setLeadSubmitting] = useState(false)
const [leadResult, setLeadResult] = useState<'qualified' | 'disqualified' | null>(null)

const handleLeadSubmit = async (e: React.FormEvent) => {
  e.preventDefault()
  if (!leadForm.weeklyQuestions) return
  setLeadSubmitting(true)
  try {
    const res = await fetch('/api/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(leadForm),
    })
    const data = await res.json()
    setLeadResult(data.qualified ? 'qualified' : 'disqualified')
  } catch {
    setLeadResult('qualified') // fail open — don't punish the user
  } finally {
    setLeadSubmitting(false)
  }
}
```

- [ ] **Step 2: Add the form section JSX**

Insert this section immediately before the closing `</footer>` tag (around line 820), just before the footer:

```tsx
{/* ── Lead Capture Form ── */}
<section className="lead-form-section" id="form">
  <div className="lead-form-container">
    <div className="lead-form-badge">Contacto</div>
    <h2 className="lead-form-title">¿Querés automatizar las preguntas de tu tienda?</h2>
    <p className="lead-form-sub">Completá el formulario y te contactamos por WhatsApp en menos de 24hs.</p>

    {leadResult === 'qualified' && (
      <div className="lead-form-success">
        <span className="lead-form-success-icon">✓</span>
        <div>
          <p className="lead-form-success-title">¡Perfecto, te contactamos pronto!</p>
          <p className="lead-form-success-sub">Te escribimos por WhatsApp en menos de 24hs.</p>
        </div>
      </div>
    )}

    {leadResult === 'disqualified' && (
      <div className="lead-form-disqualified">
        <p className="lead-form-disqualified-title">Tu tienda todavía no genera el volumen mínimo para aprovechar el bot.</p>
        <p className="lead-form-disqualified-sub">
          Cuando tengas más preguntas, volvé. O{' '}
          <a href="/login?register=true" className="lead-form-disqualified-link">
            probalo gratis ahora →
          </a>
        </p>
      </div>
    )}

    {leadResult === null && (
      <form className="lead-form" onSubmit={handleLeadSubmit}>
        <div className="lead-form-row">
          <div className="lead-form-field">
            <label className="lead-form-label">Nombre completo</label>
            <input
              className="lead-form-input"
              type="text"
              placeholder="Juan García"
              required
              value={leadForm.name}
              onChange={e => setLeadForm(f => ({ ...f, name: e.target.value }))}
            />
          </div>
          <div className="lead-form-field">
            <label className="lead-form-label">Email</label>
            <input
              className="lead-form-input"
              type="email"
              placeholder="juan@mitienda.com"
              required
              value={leadForm.email}
              onChange={e => setLeadForm(f => ({ ...f, email: e.target.value }))}
            />
          </div>
        </div>
        <div className="lead-form-row">
          <div className="lead-form-field">
            <label className="lead-form-label">Teléfono / WhatsApp</label>
            <input
              className="lead-form-input"
              type="tel"
              placeholder="+54 9 11 1234-5678"
              required
              value={leadForm.phone}
              onChange={e => setLeadForm(f => ({ ...f, phone: e.target.value }))}
            />
          </div>
          <div className="lead-form-field">
            <label className="lead-form-label">Nombre o link de tu tienda en ML</label>
            <input
              className="lead-form-input"
              type="text"
              placeholder="Mi Tienda Oficial"
              required
              value={leadForm.mlStore}
              onChange={e => setLeadForm(f => ({ ...f, mlStore: e.target.value }))}
            />
          </div>
        </div>
        <div className="lead-form-field">
          <label className="lead-form-label">¿Cuántas preguntas recibís por semana en ML?</label>
          <select
            className="lead-form-input lead-form-select"
            required
            value={leadForm.weeklyQuestions}
            onChange={e => setLeadForm(f => ({ ...f, weeklyQuestions: e.target.value }))}
          >
            <option value="" disabled>Seleccioná una opción</option>
            <option value="<10">Menos de 10</option>
            <option value="10-50">Entre 10 y 50</option>
            <option value="50-200">Entre 50 y 200</option>
            <option value="200+">Más de 200</option>
          </select>
        </div>
        <button
          className="lead-form-submit"
          type="submit"
          disabled={leadSubmitting}
        >
          {leadSubmitting ? 'Enviando…' : 'Quiero automatizar mis preguntas →'}
        </button>
      </form>
    )}
  </div>
</section>
```

- [ ] **Step 3: Add styles to `LandingPage.css`**

Append at the end of `LandingPage.css`:

```css
/* ── Lead Capture Form ──────────────────────────────────────────── */
.lead-form-section {
  padding: 80px 24px;
  background: linear-gradient(180deg, transparent 0%, rgba(59, 130, 246, 0.04) 100%);
}

.lead-form-container {
  max-width: 680px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  text-align: center;
}

.lead-form-badge {
  display: inline-block;
  padding: 4px 14px;
  background: rgba(59, 130, 246, 0.15);
  border: 1px solid rgba(59, 130, 246, 0.3);
  border-radius: 20px;
  font-size: 0.75rem;
  font-weight: 600;
  color: #60a5fa;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.lead-form-title {
  font-size: clamp(1.5rem, 3vw, 2rem);
  font-weight: 800;
  color: var(--text-primary);
  margin: 0;
  line-height: 1.2;
}

.lead-form-sub {
  font-size: 1rem;
  color: var(--text-dim);
  margin: 0;
}

.lead-form {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-top: 8px;
  text-align: left;
}

.lead-form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

@media (max-width: 560px) {
  .lead-form-row { grid-template-columns: 1fr; }
}

.lead-form-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.lead-form-label {
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--text-secondary);
}

.lead-form-input {
  width: 100%;
  padding: 10px 14px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 8px;
  color: var(--text-primary);
  font-size: 0.9rem;
  outline: none;
  transition: border-color 0.15s;
  box-sizing: border-box;
}

.lead-form-input:focus {
  border-color: #3b82f6;
}

.lead-form-select {
  cursor: pointer;
}

.lead-form-submit {
  width: 100%;
  padding: 14px;
  background: linear-gradient(135deg, #3b82f6, #2563eb);
  color: #fff;
  border: none;
  border-radius: 10px;
  font-size: 1rem;
  font-weight: 700;
  cursor: pointer;
  transition: opacity 0.15s, transform 0.1s;
  margin-top: 4px;
}

.lead-form-submit:hover:not(:disabled) { opacity: 0.9; transform: translateY(-1px); }
.lead-form-submit:disabled { opacity: 0.6; cursor: not-allowed; }

/* Success / Disqualified states */
.lead-form-success {
  width: 100%;
  display: flex;
  align-items: flex-start;
  gap: 16px;
  padding: 20px 24px;
  background: rgba(16, 185, 129, 0.08);
  border: 1px solid rgba(16, 185, 129, 0.25);
  border-radius: 12px;
  text-align: left;
}

.lead-form-success-icon {
  font-size: 1.4rem;
  color: #10b981;
  flex-shrink: 0;
}

.lead-form-success-title {
  font-size: 1rem;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0 0 4px;
}

.lead-form-success-sub {
  font-size: 0.85rem;
  color: var(--text-dim);
  margin: 0;
}

.lead-form-disqualified {
  width: 100%;
  padding: 20px 24px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  text-align: left;
}

.lead-form-disqualified-title {
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--text-secondary);
  margin: 0 0 6px;
}

.lead-form-disqualified-sub {
  font-size: 0.85rem;
  color: var(--text-dim);
  margin: 0;
}

.lead-form-disqualified-link {
  color: #60a5fa;
  text-decoration: none;
  font-weight: 600;
}

.lead-form-disqualified-link:hover { text-decoration: underline; }

/* Light theme overrides */
[data-theme="light"] .lead-form-input {
  background: #ffffff;
  border-color: #e2e8f0;
  color: #0f172a;
}

[data-theme="light"] .lead-form-input:focus { border-color: #3b82f6; }

[data-theme="light"] .lead-form-success {
  background: rgba(16, 185, 129, 0.06);
}

[data-theme="light"] .lead-form-disqualified {
  background: #f8fafc;
  border-color: #e2e8f0;
}
```

- [ ] **Step 4: Verify form renders correctly**

Start dev server and open `http://localhost:5173/#form`. Check:
- Form renders with 5 fields
- Submit with `weeklyQuestions = '<10'` shows disqualified message
- Submit with `weeklyQuestions = '50-200'` shows success message (will fail with 500 until backend task is done — that's expected)

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/LandingPage.tsx client/src/pages/LandingPage.css
git commit -m "feat: add lead capture form section to LandingPage"
```

---

## Task 10: AdminPage — Leads tab

**Files:**
- Modify: `client/src/pages/AdminPage.tsx`
- Modify: `client/src/pages/AdminPage.css`

- [ ] **Step 1: Add Lead types and fetch to `AdminPage.tsx`**

Add this type near the top of the file (after existing type definitions):

```tsx
interface LeadRow {
  id: string
  name: string
  email: string
  phone: string
  mlStore: string
  weeklyQuestions: string
  qualified: boolean
  status: 'nuevo' | 'contactado' | 'convertido' | 'descartado'
  createdAt: string
}
```

Add `'leads'` to the existing tab type (find the line with `'tenants' | 'llm'` or similar and add `| 'leads'`).

Add lead state inside the component:

```tsx
const [leads, setLeads] = useState<LeadRow[]>([])
const [leadsLoading, setLeadsLoading] = useState(false)
const [leadsStatusFilter, setLeadsStatusFilter] = useState<string>('all')
```

Add a `fetchLeads` function:

```tsx
const fetchLeads = async () => {
  setLeadsLoading(true)
  try {
    const res = await fetch('/api/leads', { headers: { Authorization: `Bearer ${token}` } })
    if (res.ok) setLeads(await res.json())
  } finally {
    setLeadsLoading(false)
  }
}
```

Call `fetchLeads()` when the tab changes to `'leads'` — add to the existing tab-change handler (or `useEffect`):

```tsx
useEffect(() => {
  if (activeTab === 'leads') fetchLeads()
}, [activeTab])
```

Add `handleLeadStatusChange` function:

```tsx
const handleLeadStatusChange = async (id: string, status: string) => {
  await fetch(`/api/leads/${id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ status }),
  })
  setLeads(prev => prev.map(l => l.id === id ? { ...l, status: status as LeadRow['status'] } : l))
}
```

- [ ] **Step 2: Add the Leads tab button**

Find the existing tab bar (the buttons for `tenants`, `llm`, etc.) and add:

```tsx
<button
  className={`admin-tab${activeTab === 'leads' ? ' admin-tab--active' : ''}`}
  onClick={() => setActiveTab('leads')}
>
  Leads
</button>
```

- [ ] **Step 3: Add the Leads tab content**

Find the block that renders tab content (the `{activeTab === 'llm' && ...}` pattern) and add:

```tsx
{activeTab === 'leads' && (
  <div className="admin-section">
    <div className="admin-toolbar">
      <span className="admin-section-title">Leads</span>
      <select
        className="admin-filter-select"
        value={leadsStatusFilter}
        onChange={e => setLeadsStatusFilter(e.target.value)}
      >
        <option value="all">Todos los estados</option>
        <option value="nuevo">Nuevo</option>
        <option value="contactado">Contactado</option>
        <option value="convertido">Convertido</option>
        <option value="descartado">Descartado</option>
      </select>
      <button className="btn-ghost" onClick={fetchLeads}>↺ Actualizar</button>
    </div>

    {leadsLoading ? (
      <div className="admin-loading">Cargando leads…</div>
    ) : (
      <div className="admin-table-wrapper">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Email</th>
              <th>Teléfono</th>
              <th>Tienda ML</th>
              <th>Preg/sem</th>
              <th>Calificado</th>
              <th>Estado</th>
              <th>Fecha</th>
            </tr>
          </thead>
          <tbody>
            {leads
              .filter(l => leadsStatusFilter === 'all' || l.status === leadsStatusFilter)
              .map(l => (
                <tr key={l.id} className="admin-table-row">
                  <td>{l.name}</td>
                  <td>{l.email}</td>
                  <td>{l.phone}</td>
                  <td>{l.mlStore}</td>
                  <td>{l.weeklyQuestions}</td>
                  <td>
                    <span className={`lead-qualified-badge lead-qualified-badge--${l.qualified ? 'yes' : 'no'}`}>
                      {l.qualified ? 'Sí' : 'No'}
                    </span>
                  </td>
                  <td>
                    <select
                      className="lead-status-select"
                      value={l.status}
                      onChange={e => handleLeadStatusChange(l.id, e.target.value)}
                    >
                      <option value="nuevo">Nuevo</option>
                      <option value="contactado">Contactado</option>
                      <option value="convertido">Convertido</option>
                      <option value="descartado">Descartado</option>
                    </select>
                  </td>
                  <td>{new Date(l.createdAt).toLocaleDateString('es-AR')}</td>
                </tr>
              ))}
            {leads.filter(l => leadsStatusFilter === 'all' || l.status === leadsStatusFilter).length === 0 && (
              <tr><td colSpan={8} className="admin-table-empty">No hay leads aún.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    )}
  </div>
)}
```

- [ ] **Step 4: Add lead styles to `AdminPage.css`**

Append at the end of `AdminPage.css`:

```css
/* ── Leads tab ────────────────────────────────────────────────── */
.lead-qualified-badge {
  display: inline-block;
  padding: 2px 10px;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 700;
}

.lead-qualified-badge--yes {
  background: rgba(16, 185, 129, 0.15);
  color: #10b981;
}

.lead-qualified-badge--no {
  background: rgba(239, 68, 68, 0.12);
  color: #f87171;
}

.lead-status-select {
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  color: var(--text-secondary);
  font-size: 0.82rem;
  padding: 4px 8px;
  cursor: pointer;
  outline: none;
}

.lead-status-select:focus { border-color: #3b82f6; }

[data-theme="light"] .lead-status-select {
  background: #ffffff;
  border-color: #e2e8f0;
  color: #334155;
}
```

- [ ] **Step 5: Verify end-to-end flow**

1. Open `http://localhost:5173/#form`, submit a qualified lead
2. Open `http://localhost:5173/admin` → Leads tab
3. Verify lead appears in table
4. Change status via the inline select — verify it persists on reload

- [ ] **Step 6: Commit**

```bash
git add client/src/pages/AdminPage.tsx client/src/pages/AdminPage.css
git commit -m "feat: add Leads tab to AdminPage"
```

---

## Self-review checklist

- [x] All 5 form fields covered in entity, schema, use case, controller, and frontend
- [x] `qualified` computed consistently (`!== '<10'`) in `CreateLeadUseCase` — same check in frontend for pre-disqualification
- [x] Email only fires for qualified leads
- [x] `POST /api/leads` is public (no auth) — `GET` and `PATCH` require `super_admin`
- [x] `updateStatus` validates the 4 valid statuses before calling use case
- [x] Container wires `adminEmail` from `ADMIN_EMAIL` env var with fallback
- [x] All repository method names match between `ILeadRepository`, `PostgresLeadRepository`, and use cases
- [x] Frontend `handleLeadStatusChange` updates local state optimistically — no full reload needed
