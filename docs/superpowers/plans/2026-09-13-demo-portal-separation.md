# Demo / Portal Separation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Separar completamente la experiencia de demo (herramienta de ventas con login propio) del portal real del tenant, introduciendo un rol `demo`, un usuario pre-seeded y páginas dedicadas sin mezcla de contenido.

**Architecture:** Se agrega el rol `"demo"` al dominio, se crea `SeedDemoUserUseCase` (análogo a `SeedSuperAdminUseCase`) que vincula el demo user al tenant de prueba. Se agregan dos páginas nuevas: `demo.html` (dashboard de presentación con login gate) y se limpia `tenant.html` (portal real). `index.html` queda como redirect a `/demo`. Un nuevo `DemoController` expone `POST /api/demo/seed` para pre-poblar preguntas y reclamos simulados antes de una presentación.

**Tech Stack:** TypeScript, Fastify, Vitest, SQLite (better-sqlite3), Vanilla JS/HTML/CSS

---

## File Map

| Acción | Archivo | Responsabilidad |
|---|---|---|
| Modify | `src/domain/value-objects/UserRole.ts` | Agregar `"demo"` al tipo y constante |
| Modify | `src/domain/entities/User.ts` | Agregar método `isDemo()` |
| Create | `src/application/use-cases/auth/SeedDemoUserUseCase.ts` | Seed demo user + tenant linkage |
| Modify | `src/app.ts` | Guard `requireDemo`, seed en startup, rutas DemoController |
| Create | `src/presentation/controllers/DemoController.ts` | `POST /api/demo/seed` |
| Create | `public/demo.html` | Login-gated demo dashboard |
| Create | `public/demo.js` | Lógica del demo (login + dashboard) |
| Create | `public/demo.css` | Estilos del demo |
| Modify | `public/index.html` | Redirect inmediato a `/demo` |
| Modify | `public/tenant.html` | Eliminar secciones de simulación del navbar |
| Modify | `.env.example` | Agregar DEMO_EMAIL, DEMO_PASSWORD, DEMO_SELLER_ID, DEMO_ACCESS_TOKEN |
| Create | `tests/auth/SeedDemoUserUseCase.test.ts` | Tests del seed |
| Modify | `docs/SETUP.md` | Agregar sección de credenciales demo |

---

## Task 1: Agregar rol `demo` al dominio

**Files:**
- Modify: `src/domain/value-objects/UserRole.ts`
- Modify: `src/domain/entities/User.ts`
- Test: `tests/auth/User.test.ts`

- [ ] **Step 1: Leer el archivo actual de UserRole.ts**

```bash
cat "src/domain/value-objects/UserRole.ts"
```

- [ ] **Step 2: Agregar el rol `demo`**

Reemplazar el contenido completo de `src/domain/value-objects/UserRole.ts`:

```typescript
export type UserRoleType = "super_admin" | "tenant" | "demo";
export const USER_ROLES = {
  SUPER_ADMIN: "super_admin",
  TENANT: "tenant",
  DEMO: "demo",
} as const;
```

- [ ] **Step 3: Agregar `isDemo()` a la entidad User**

En `src/domain/entities/User.ts`, agregar después del método `isSuperAdmin()`:

```typescript
public isDemo(): boolean {
  return this.role === "demo";
}
```

- [ ] **Step 4: Escribir el test que falla**

En `tests/auth/User.test.ts`, agregar dentro del describe existente:

```typescript
it("debe identificar un usuario demo correctamente", () => {
  const user = new User({
    id: "demo-id",
    email: "demo@melibot.com",
    passwordHash: "hash",
    name: "Demo User",
    role: "demo",
    sellerId: "3680586616",
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  expect(user.isDemo()).toBe(true);
  expect(user.isSuperAdmin()).toBe(false);
  expect(user.canAccessSeller("3680586616")).toBe(true);
  expect(user.canAccessSeller("9999999999")).toBe(false);
});
```

- [ ] **Step 5: Ejecutar el test y verificar que falla**

```bash
npx vitest run tests/auth/User.test.ts
```

Expected: FAIL — `user.isDemo is not a function`

- [ ] **Step 6: Ejecutar tests nuevamente y verificar que pasan**

```bash
npx vitest run tests/auth/User.test.ts
```

Expected: PASS (todos los tests del archivo)

- [ ] **Step 7: Commit**

```bash
git add src/domain/value-objects/UserRole.ts src/domain/entities/User.ts tests/auth/User.test.ts
git commit -m "feat: add demo role to domain (UserRole + User.isDemo)"
```

---

## Task 2: SeedDemoUserUseCase

**Files:**
- Create: `src/application/use-cases/auth/SeedDemoUserUseCase.ts`
- Modify: `src/app.ts` (wiring del seed en startup)
- Create: `tests/auth/SeedDemoUserUseCase.test.ts`

- [ ] **Step 1: Leer SeedSuperAdminUseCase como referencia**

```bash
cat "src/application/use-cases/auth/SeedSuperAdminUseCase.ts"
```

- [ ] **Step 2: Crear SeedDemoUserUseCase**

Crear `src/application/use-cases/auth/SeedDemoUserUseCase.ts`:

```typescript
import { v4 as uuidv4 } from "uuid";
import { IUserRepository } from "../../interfaces/IUserRepository";
import { ITenantRepository } from "../../interfaces/ITenantRepository";
import { IPasswordHasher } from "../../interfaces/IPasswordHasher";
import { User } from "../../../domain/entities/User";
import { Tenant } from "../../../domain/entities/Tenant";

export class SeedDemoUserUseCase {
  constructor(
    private readonly userRepo: IUserRepository,
    private readonly tenantRepo: ITenantRepository,
    private readonly passwordHasher: IPasswordHasher
  ) {}

  async execute(): Promise<void> {
    const email = process.env.DEMO_EMAIL ?? "demo@melibot.com";
    const password = process.env.DEMO_PASSWORD ?? "Demo123456!";
    const name = process.env.DEMO_NAME ?? "Demo User";
    const sellerId = process.env.DEMO_SELLER_ID ?? "3680586616";
    const accessToken = process.env.DEMO_ACCESS_TOKEN ?? "";

    const existing = await this.userRepo.findByEmail(email);
    if (!existing) {
      const passwordHash = await this.passwordHasher.hash(password);
      const user = new User({
        id: uuidv4(),
        email,
        passwordHash,
        name,
        role: "demo",
        sellerId,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      await this.userRepo.save(user);
      console.log(`🎬 [Auth] Demo user creado: ${email}`);
    }

    // Ensure demo tenant exists (use createDefault to avoid manual settings boilerplate)
    const existingTenant = await this.tenantRepo.findBySellerId(sellerId);
    if (!existingTenant && accessToken) {
      const tenant = Tenant.createDefault({
        id: uuidv4(),
        sellerId,
        nickname: process.env.DEMO_SELLER_NICKNAME ?? "TESTUSER4327702539223624795",
        email: "test_user_demo@testuser.com",
        accessToken,
        refreshToken: "",
        expiresInSec: 21600,
      });
      await this.tenantRepo.save(tenant);
      console.log(`🎬 [Auth] Demo tenant creado: sellerId=${sellerId}`);
    }
  }
}
```

- [ ] **Step 3: Escribir el test que falla**

Crear `tests/auth/SeedDemoUserUseCase.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { SeedDemoUserUseCase } from "../../src/application/use-cases/auth/SeedDemoUserUseCase";

describe("SeedDemoUserUseCase", () => {
  const mockUserRepo = {
    findByEmail: vi.fn(),
    save: vi.fn(),
    findById: vi.fn(),
    findBySellerId: vi.fn(),
    getAll: vi.fn(),
    count: vi.fn(),
  };
  const mockTenantRepo = {
    findBySellerId: vi.fn(),
    save: vi.fn(),
    findById: vi.fn(),
    getAll: vi.fn(),
  };
  const mockHasher = {
    hash: vi.fn().mockResolvedValue("hashed"),
    compare: vi.fn(),
  };

  beforeEach(() => vi.clearAllMocks());

  it("crea el usuario demo si no existe", async () => {
    mockUserRepo.findByEmail.mockResolvedValue(null);
    mockTenantRepo.findBySellerId.mockResolvedValue(null);
    process.env.DEMO_EMAIL = "demo@melibot.com";
    process.env.DEMO_PASSWORD = "Demo123456!";
    process.env.DEMO_SELLER_ID = "3680586616";
    process.env.DEMO_ACCESS_TOKEN = "";

    const useCase = new SeedDemoUserUseCase(mockUserRepo as any, mockTenantRepo as any, mockHasher as any);
    await useCase.execute();

    expect(mockUserRepo.save).toHaveBeenCalledOnce();
    const savedUser = mockUserRepo.save.mock.calls[0][0];
    expect(savedUser.role).toBe("demo");
    expect(savedUser.email).toBe("demo@melibot.com");
    expect(savedUser.sellerId).toBe("3680586616");
  });

  it("no duplica el usuario demo si ya existe", async () => {
    mockUserRepo.findByEmail.mockResolvedValue({ id: "existing", role: "demo" });
    mockTenantRepo.findBySellerId.mockResolvedValue({ sellerId: "3680586616" });

    const useCase = new SeedDemoUserUseCase(mockUserRepo as any, mockTenantRepo as any, mockHasher as any);
    await useCase.execute();

    expect(mockUserRepo.save).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 4: Ejecutar y verificar que falla**

```bash
npx vitest run tests/auth/SeedDemoUserUseCase.test.ts
```

Expected: FAIL — module not found

- [ ] **Step 5: Ejecutar y verificar que pasa**

```bash
npx vitest run tests/auth/SeedDemoUserUseCase.test.ts
```

Expected: PASS (2 tests)

- [ ] **Step 6: Wirear en app.ts**

En `src/app.ts`, después de la instanciación de `seedSuperAdminUseCase` (buscar la línea `seedSuperAdminUseCase.execute()`), agregar:

```typescript
// Import at top of file
import { SeedDemoUserUseCase } from "./application/use-cases/auth/SeedDemoUserUseCase";

// In buildApp(), after existing seed calls:
const seedDemoUserUseCase = new SeedDemoUserUseCase(userRepo, tenantRepo, passwordHasher);
seedDemoUserUseCase.execute().catch((err) =>
  console.error("Error seeding demo user:", err)
);
```

- [ ] **Step 7: Verificar que el servidor arranca sin errores**

```bash
npx tsx src/server.ts
```

Expected: servidor en puerto 3000, log `🎬 [Auth] Demo user creado: demo@melibot.com`

- [ ] **Step 8: Commit**

```bash
git add src/application/use-cases/auth/SeedDemoUserUseCase.ts src/app.ts tests/auth/SeedDemoUserUseCase.test.ts
git commit -m "feat: add SeedDemoUserUseCase and wire demo user on startup"
```

---

## Task 3: Guard `requireDemo` + DemoController

**Files:**
- Modify: `src/app.ts` (guard + rutas)
- Create: `src/presentation/controllers/DemoController.ts`

- [ ] **Step 1: Agregar guard `requireDemo` en app.ts**

En `src/app.ts`, después del guard `requireSuperAdmin`, agregar:

```typescript
const requireDemo = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    await authenticate(request, reply);
  } catch {
    return;
  }
  const user = (request as any).user;
  if (!user || (user.role !== "demo" && user.role !== "super_admin")) {
    return reply.status(403).send({ error: "Acceso denegado. Se requiere cuenta demo." });
  }
};
```

- [ ] **Step 2: Crear DemoController**

Crear `src/presentation/controllers/DemoController.ts`:

```typescript
import { FastifyRequest, FastifyReply } from "fastify";
import { v4 as uuidv4 } from "uuid";
import { SimulateQuestionUseCase } from "../../application/use-cases/SimulateQuestionUseCase";
import { IClaimRepository } from "../../application/interfaces/IClaimRepository";
import { IEventRepository } from "../../application/interfaces/IEventRepository";
import { IRealtimeNotifier } from "../../application/interfaces/IRealtimeNotifier";
import { Claim, ClaimType, ClaimAction } from "../../domain/entities/Claim";
import { EventLog } from "../../domain/entities/EventLog";

interface DemoControllerDeps {
  simulateQuestionUseCase: SimulateQuestionUseCase;
  claimRepo: IClaimRepository;
  eventRepo: IEventRepository;
  sseNotifier: IRealtimeNotifier;
  sellerId: string;
}

export class DemoController {
  private readonly simulateQuestion: SimulateQuestionUseCase;
  private readonly claimRepo: IClaimRepository;
  private readonly eventRepo: IEventRepository;
  private readonly sseNotifier: IRealtimeNotifier;
  private readonly sellerId: string;

  constructor(deps: DemoControllerDeps) {
    this.simulateQuestion = deps.simulateQuestionUseCase;
    this.claimRepo = deps.claimRepo;
    this.eventRepo = deps.eventRepo;
    this.sseNotifier = deps.sseNotifier;
    this.sellerId = deps.sellerId;
  }

  seed = async (_req: FastifyRequest, reply: FastifyReply) => {
    const questionPresets = [
      "Hola, ¿tienen stock disponible para enviar hoy a CABA?",
      "¿El producto viene con garantía oficial? ¿Cuánto tiempo?",
      "¿Cuál es el precio final con envío incluido a Rosario?",
      "¿Hacen factura A para empresa?",
      "¿Tiene manual en español?",
      "Pasame tu número de WhatsApp para coordinar la entrega",
    ];

    const claimPresets: Array<{ type: ClaimType; reason: string; hoursUntilDue: number }> = [
      { type: "med_pdd", reason: "Producto defectuoso — no enciende al conectar la corriente", hoursUntilDue: 8 },
      { type: "med_pnr", reason: "Paquete demorado — no recibí el envío después de 12 días", hoursUntilDue: 20 },
      { type: "return",  reason: "El producto llegó diferente al de la publicación",           hoursUntilDue: 48 },
    ];

    // Seed questions
    const seededQuestions: string[] = [];
    for (const text of questionPresets) {
      try {
        await this.simulateQuestion.execute({ text, seller_id: this.sellerId });
        seededQuestions.push(text);
      } catch (err) {
        console.error(`[DemoController] Error simulando pregunta: ${text}`, err);
      }
    }

    // Seed claims
    const seededClaims: string[] = [];
    const now = new Date();
    for (const preset of claimPresets) {
      try {
        const claimId = String(5100000000 + Math.floor(Math.random() * 90000000));
        const orderId = String(2000000000 + Math.floor(Math.random() * 900000000));
        const dueDate = new Date(now.getTime() + preset.hoursUntilDue * 60 * 60 * 1000);
        const actions: ClaimAction[] = [{ action: "respond_claim", dueDate, mandatory: true }];

        const claim = new Claim({
          id: claimId,
          sellerId: this.sellerId,
          orderId,
          type: preset.type,
          stage: "claim",
          status: "opened",
          reason: preset.reason,
          buyerId: "3677130936",
          actions,
          dueDate,
          createdAt: now,
          updatedAt: now,
        });

        await this.claimRepo.save(claim);
        await this.eventRepo.log(new EventLog({
          sellerId: this.sellerId,
          type: "claim_received",
          message: `🎬 [Demo] Reclamo #${claimId} — ${preset.type.toUpperCase()}, SLA: ${preset.hoursUntilDue}hs`,
        }));
        this.sseNotifier.broadcastToSeller(this.sellerId, "claim_received", {
          claim_id: claimId, order_id: orderId, type: claim.type,
          urgency: claim.getUrgency(now), remaining_hours: claim.getRemainingHours(now),
        });
        seededClaims.push(claimId);
      } catch (err) {
        console.error(`[DemoController] Error simulando reclamo:`, err);
      }
    }

    return reply.send({
      ok: true,
      message: `${seededQuestions.length} preguntas y ${seededClaims.length} reclamos demo generados`,
      questions: seededQuestions,
      claims: seededClaims,
    });
  };
}
```

- [ ] **Step 3: Registrar rutas en app.ts**

En `src/app.ts`, instanciar y registrar el controller. En la sección de instanciación de controllers:

```typescript
import { DemoController } from "./presentation/controllers/DemoController";

const demoCtrl = new DemoController({
  simulateQuestionUseCase,
  claimRepo,
  eventRepo,
  sseNotifier,
  sellerId: process.env.DEMO_SELLER_ID ?? "3680586616",
});
```

En la sección de registro de rutas:

```typescript
app.post("/api/demo/seed", { preHandler: requireDemo }, demoCtrl.seed);
```

- [ ] **Step 4: Verificar que el endpoint responde**

```bash
npx tsx src/server.ts
```

En otra terminal (con la app corriendo y habiendo iniciado sesión con demo@melibot.com):

```bash
# Primero hacer login para obtener token
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"demo@melibot.com","password":"Demo123456!"}'

# Usar el token obtenido
curl -X POST http://localhost:3000/api/demo/seed \
  -H "Authorization: Bearer <TOKEN>"
```

Expected: `{ "ok": true, "message": "6 preguntas demo generadas", "questions": [...] }`

- [ ] **Step 5: Commit**

```bash
git add src/app.ts src/presentation/controllers/DemoController.ts
git commit -m "feat: add requireDemo guard and DemoController with seed endpoint"
```

---

## Task 4: Actualizar .env.example y SETUP.md

**Files:**
- Modify: `.env.example`
- Modify: `docs/SETUP.md`

- [ ] **Step 1: Leer .env.example actual**

```bash
cat .env.example
```

- [ ] **Step 2: Agregar variables demo a .env.example**

Agregar al final del archivo `.env.example`:

```ini
# Usuario Demo (presentaciones de ventas)
DEMO_EMAIL=demo@melibot.com
DEMO_PASSWORD=Demo123456!
DEMO_NAME=Demo User
DEMO_SELLER_ID=3680586616
DEMO_SELLER_NICKNAME=TESTUSER4327702539223624795
DEMO_ACCESS_TOKEN=APP_USR-...token_del_vendedor_test...
```

- [ ] **Step 3: Agregar sección en SETUP.md**

En `docs/SETUP.md`, en la sección `## 5. Credenciales del Sistema`, agregar después de `### 5.3 Tarjetas de Crédito de Prueba`:

```markdown
### 5.4 Usuario Demo (Presentaciones)

Usuario pre-seeded para usar en reuniones con clientes potenciales. Accede a `/demo` y tiene visibilidad del tenant de prueba.

* **URL:** `http://localhost:3000/demo`
* **Email:** `demo@melibot.com`
* **Contraseña:** `Demo123456!`
* **Seller vinculado:** `TESTUSER4327702539223624795` (sellerId: `3680586616`)

> Antes de una presentación, loguear y hacer clic en "Preparar Demo" para poblar preguntas y reclamos ficticios en el panel.
```

- [ ] **Step 4: Commit**

```bash
git add .env.example docs/SETUP.md
git commit -m "docs: add demo user env vars and SETUP.md section"
```

---

## Task 5: demo.html — Login gate + dashboard de presentación

**Files:**
- Create: `public/demo.html`
- Create: `public/demo.css`
- Create: `public/demo.js`

- [ ] **Step 1: Leer la estructura de index.html para extraer el contenido del dashboard**

```bash
cat "public/index.html"
```

- [ ] **Step 2: Crear demo.css**

Crear `public/demo.css`:

```css
/* demo.css — reutiliza variables del design system de styles.css */
@import url('./styles.css');

/* Login screen */
#demo-login-screen {
  position: fixed;
  inset: 0;
  background: #0a0a0f;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.demo-login-card {
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 16px;
  padding: 40px;
  width: 360px;
  backdrop-filter: blur(12px);
}

.demo-login-card h1 {
  font-size: 1.4rem;
  color: #e2e8f0;
  margin-bottom: 4px;
  font-weight: 600;
}

.demo-login-card p {
  color: #64748b;
  font-size: 0.85rem;
  margin-bottom: 28px;
}

.demo-login-card input {
  width: 100%;
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 8px;
  padding: 10px 14px;
  color: #e2e8f0;
  font-size: 0.9rem;
  margin-bottom: 12px;
  box-sizing: border-box;
}

.demo-login-card button {
  width: 100%;
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  color: white;
  border: none;
  border-radius: 8px;
  padding: 11px;
  font-weight: 600;
  cursor: pointer;
  font-size: 0.9rem;
  margin-top: 4px;
}

.demo-login-error {
  color: #f87171;
  font-size: 0.82rem;
  text-align: center;
  margin-top: 8px;
  min-height: 18px;
}

/* Demo badge in navbar */
.demo-badge {
  font-size: 0.65rem;
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  color: white;
  padding: 2px 8px;
  border-radius: 20px;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  vertical-align: middle;
  margin-left: 6px;
}

/* Seed button */
.btn-seed-demo {
  background: rgba(99,102,241,0.15);
  border: 1px solid rgba(99,102,241,0.4);
  color: #818cf8;
  border-radius: 8px;
  padding: 6px 14px;
  font-size: 0.82rem;
  cursor: pointer;
  font-weight: 500;
  transition: all 0.2s;
}

.btn-seed-demo:hover {
  background: rgba(99,102,241,0.25);
  color: #a5b4fc;
}
```

- [ ] **Step 3: Crear demo.js**

Crear `public/demo.js`:

```javascript
// demo.js — Login gate + demo dashboard logic

const DEMO_TOKEN_KEY = "demo_token";
const DEMO_USER_KEY = "demo_user";

// ── Login ──────────────────────────────────────────────────────────────────

async function demoLogin(email, password) {
  const res = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error("Credenciales inválidas");
  const data = await res.json();
  if (data.user.role !== "demo" && data.user.role !== "super_admin") {
    throw new Error("Esta cuenta no tiene acceso demo");
  }
  localStorage.setItem(DEMO_TOKEN_KEY, data.token);
  localStorage.setItem(DEMO_USER_KEY, JSON.stringify(data.user));
  return data;
}

function demoLogout() {
  localStorage.removeItem(DEMO_TOKEN_KEY);
  localStorage.removeItem(DEMO_USER_KEY);
  window.location.reload();
}

function getDemoToken() {
  return localStorage.getItem(DEMO_TOKEN_KEY);
}

function getDemoUser() {
  const raw = localStorage.getItem(DEMO_USER_KEY);
  return raw ? JSON.parse(raw) : null;
}

// ── Auth check on load ─────────────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", () => {
  const loginScreen = document.getElementById("demo-login-screen");
  const dashboard = document.getElementById("demo-dashboard");
  const token = getDemoToken();

  if (token) {
    loginScreen.style.display = "none";
    dashboard.style.display = "block";
    initDemoDashboard();
  } else {
    loginScreen.style.display = "flex";
    dashboard.style.display = "none";
  }

  // Login form handler
  const form = document.getElementById("demo-login-form");
  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = document.getElementById("demo-email").value;
      const password = document.getElementById("demo-password").value;
      const errorEl = document.getElementById("demo-login-error");
      try {
        await demoLogin(email, password);
        loginScreen.style.display = "none";
        dashboard.style.display = "block";
        initDemoDashboard();
      } catch (err) {
        errorEl.textContent = err.message;
      }
    });
  }

  // Logout button
  const logoutBtn = document.getElementById("demo-logout-btn");
  if (logoutBtn) logoutBtn.addEventListener("click", demoLogout);

  // Seed button
  const seedBtn = document.getElementById("demo-seed-btn");
  if (seedBtn) {
    seedBtn.addEventListener("click", async () => {
      seedBtn.disabled = true;
      seedBtn.textContent = "Preparando...";
      try {
        const res = await fetch("/api/demo/seed", {
          method: "POST",
          headers: { Authorization: `Bearer ${getDemoToken()}` },
        });
        const data = await res.json();
        seedBtn.textContent = `✓ ${data.message}`;
        setTimeout(() => {
          seedBtn.textContent = "Preparar Demo";
          seedBtn.disabled = false;
        }, 3000);
      } catch {
        seedBtn.textContent = "Error al preparar";
        seedBtn.disabled = false;
      }
    });
  }
});

// ── Dashboard init ─────────────────────────────────────────────────────────
// This function is called after successful login.
// The actual dashboard logic is handled by app.js (questions, SSE, etc.)
// We just set the seller context and trigger a refresh.

function initDemoDashboard() {
  const user = getDemoUser();
  const sellerIdEl = document.getElementById("demo-seller-id-display");
  if (sellerIdEl && user) sellerIdEl.textContent = user.sellerId || "";

  // Override the token used by app.js for API calls
  window.DEMO_AUTH_TOKEN = getDemoToken();
  window.DEMO_SELLER_ID = user?.sellerId;

  // Trigger dashboard data load if app.js exposes an init function
  if (typeof window.initAppDashboard === "function") {
    window.initAppDashboard(getDemoToken(), user?.sellerId);
  }
}
```

- [ ] **Step 4: Crear demo.html**

Crear `public/demo.html` con la siguiente estructura base (el contenido del dashboard es el mismo que `index.html`, envuelto en el gate de login):

```html
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>MELI AI Assistant — Demo</title>
  <link rel="stylesheet" href="styles.css" />
  <link rel="stylesheet" href="demo.css" />
</head>
<body>

<!-- ── Login Gate ──────────────────────────────────────────────────────── -->
<div id="demo-login-screen">
  <div class="demo-login-card">
    <h1>MELI AI Assistant <span class="demo-badge">DEMO</span></h1>
    <p>Acceso exclusivo para presentaciones</p>
    <form id="demo-login-form">
      <input id="demo-email" type="email" placeholder="Email" value="demo@melibot.com" required />
      <input id="demo-password" type="password" placeholder="Contraseña" required />
      <button type="submit">Ingresar al Demo</button>
      <div id="demo-login-error" class="demo-login-error"></div>
    </form>
  </div>
</div>

<!-- ── Demo Dashboard (hidden until login) ────────────────────────────── -->
<div id="demo-dashboard" style="display:none">

  <!-- Navbar -->
  <nav class="navbar">
    <div class="nav-brand">
      MELI AI Assistant <span class="demo-badge">DEMO</span>
    </div>
    <div class="nav-links">
      <a href="#" class="nav-link active" data-view="split">Vista Dividida</a>
      <a href="#" class="nav-link" data-view="panel">Panel ML</a>
      <a href="#" class="nav-link" data-view="whatsapp">WhatsApp</a>
      <a href="#" class="nav-link" data-view="sim-pregunta">Simular Pregunta</a>
      <a href="#" class="nav-link" data-view="sim-reclamo">Simular Reclamo</a>
    </div>
    <div class="nav-actions">
      <button id="demo-seed-btn" class="btn-seed-demo">Preparar Demo</button>
      <span id="demo-seller-id-display" style="color:#64748b;font-size:0.8rem;margin:0 12px"></span>
      <button id="demo-logout-btn" class="btn-icon" title="Salir">↩</button>
    </div>
  </nav>

  <!-- Main content: same dashboard content as index.html -->
  <!-- IMPORTANT: Copy the <main> content block from index.html here -->
  <!-- This is the split-view, questions panel, claims panel, simulators, etc. -->
  <main id="demo-main-content">
    <!-- Placeholder: paste the entire <main> block from index.html here in Task 6 -->
  </main>

</div>

<script src="app.js"></script>
<script src="demo.js"></script>
</body>
</html>
```

> **Nota:** El `<main>` se completa en Task 6 copiando el contenido de `index.html`.

- [ ] **Step 5: Commit parcial**

```bash
git add public/demo.css public/demo.js public/demo.html
git commit -m "feat: add demo.html login gate, demo.css and demo.js skeleton"
```

---

## Task 6: Migrar contenido de index.html a demo.html + redirect

**Files:**
- Modify: `public/demo.html` (completar el `<main>`)
- Modify: `public/index.html` (convertir en redirect)

- [ ] **Step 1: Copiar el bloque `<main>` de index.html a demo.html**

Leer `public/index.html`, identificar el bloque `<main>...</main>` y copiarlo reemplazando el placeholder `<!-- Placeholder: ... -->` en `public/demo.html`.

- [ ] **Step 2: Reemplazar index.html con redirect**

Reemplazar el contenido completo de `public/index.html`:

```html
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="refresh" content="0;url=/demo" />
  <title>MELI AI Assistant</title>
</head>
<body>
  <script>window.location.replace('/demo');</script>
</body>
</html>
```

- [ ] **Step 3: Verificar que `/` redirige a `/demo` en el navegador**

```bash
npx tsx src/server.ts
```

Abrir `http://localhost:3000` — debe redirigir a `http://localhost:3000/demo` y mostrar el login.

- [ ] **Step 4: Verificar el flujo completo del demo**

1. Ingresar con `demo@melibot.com` / `Demo123456!`
2. Se muestra el dashboard con navbar: Vista Dividida · Panel ML · WhatsApp · Simular Pregunta · Simular Reclamo
3. Hacer clic en "Preparar Demo" → aparece confirmación de preguntas generadas
4. Las preguntas aparecen en el panel ML

- [ ] **Step 5: Commit**

```bash
git add public/demo.html public/index.html
git commit -m "feat: migrate dashboard to demo.html, redirect index to /demo"
```

---

## Task 7: Limpiar tenant.html (portal real sin elementos de demo)

**Files:**
- Modify: `public/tenant.html`

- [ ] **Step 1: Leer tenant.html**

```bash
cat "public/tenant.html"
```

- [ ] **Step 2: Eliminar elementos de simulación del portal**

En `public/tenant.html`:
1. Buscar cualquier referencia a "Simular Pregunta", "Simular Reclamo", "simulate", o modales de simulación.
2. Eliminar esos elementos del HTML.
3. Verificar que el navbar del tenant tenga exactamente: **Mis Preguntas · Reclamos · Configuración IA · Canales de Alerta · Conexión MELI**
4. Eliminar cualquier enlace al panel de demo o al split view.

- [ ] **Step 3: Agregar navegación hacia el portal en el resto del sistema**

Verificar que `admin.html` y `onboarding.html` tengan el link correcto al portal: `href="/tenant.html"` (o `/portal` si se renombra).

- [ ] **Step 4: Verificar portal limpio**

Abrir `http://localhost:3000/tenant.html`, loguearse con un tenant, confirmar que:
- No hay botones de simulación
- No hay referencia a la demo
- Las 5 pestañas del portal funcionan correctamente

- [ ] **Step 5: Commit**

```bash
git add public/tenant.html
git commit -m "refactor: remove demo/simulation elements from tenant portal"
```

---

## Task 8: Suite de tests completa + verificación

- [ ] **Step 1: Correr todos los tests**

```bash
npx vitest run
```

Expected: todos los tests pasan (0 failures)

- [ ] **Step 2: Verificar compilación TypeScript sin errores**

```bash
npx tsc --noEmit
```

Expected: sin errores de tipos

- [ ] **Step 3: Verificar flujos E2E manualmente**

| Flujo | URL | Verificación |
|---|---|---|
| Redirect raíz | `http://localhost:3000/` | Redirige a `/demo` |
| Login demo | `/demo` | Login con `demo@melibot.com` / `Demo123456!` funciona |
| Acceso demo sin token | `POST /api/demo/seed` sin auth | Retorna 403 |
| Acceso demo con token tenant | `POST /api/demo/seed` con token tenant | Retorna 403 |
| Portal limpio | `/tenant.html` | Sin botones de simulación |
| Super admin intacto | `/admin.html` | Funciona igual que antes |
| Onboarding intacto | `/onboarding.html` | Funciona igual que antes |

- [ ] **Step 4: Commit final**

```bash
git add -A
git commit -m "feat: complete demo/portal separation - demo role, login gate, clean portal"
```

---

## Resumen de Variables de Entorno Nuevas

```ini
DEMO_EMAIL=demo@melibot.com
DEMO_PASSWORD=Demo123456!
DEMO_NAME=Demo User
DEMO_SELLER_ID=3680586616
DEMO_SELLER_NICKNAME=TESTUSER4327702539223624795
DEMO_ACCESS_TOKEN=APP_USR-...   # Token del vendedor de prueba
```
