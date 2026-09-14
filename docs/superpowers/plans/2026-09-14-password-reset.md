# Password Reset Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar reset de contraseña con auto-servicio desde el login y disparo manual desde el panel de super admin.

**Architecture:** Token de reset embebido en el campo `activationToken` existente con formato `{hex}|{expiresAt}`, cero cambios en DB. Dos nuevos use cases de auth (`RequestPasswordResetUseCase`, `ResetPasswordUseCase`), dos handlers en `AuthController`, un handler en `AdminController`. Dos nuevas páginas públicas en React.

**Tech Stack:** TypeScript, Fastify, better-sqlite3, Resend SDK (ya configurado), React + React Router, Vitest.

---

## File Map

| Archivo | Acción |
|---------|--------|
| `src/domain/entities/User.ts` | Modificar — agregar `setResetToken()` |
| `src/application/use-cases/auth/RequestPasswordResetUseCase.ts` | Crear |
| `src/application/use-cases/auth/ResetPasswordUseCase.ts` | Crear |
| `src/tests/RequestPasswordResetUseCase.test.ts` | Crear |
| `src/tests/ResetPasswordUseCase.test.ts` | Crear |
| `src/presentation/controllers/AuthController.ts` | Modificar — agregar `forgotPassword`, `resetPassword` |
| `src/presentation/controllers/AdminController.ts` | Modificar — agregar `resetUserPassword` y nueva dep |
| `src/app.ts` | Modificar — instanciar use cases, registrar rutas |
| `client/src/pages/ForgotPasswordPage.tsx` | Crear |
| `client/src/pages/ResetPasswordPage.tsx` | Crear |
| `client/src/pages/LoginPage.tsx` | Modificar — agregar link "¿Olvidaste tu contraseña?" |
| `client/src/App.tsx` | Modificar — agregar rutas públicas |
| `client/src/pages/AdminPage.tsx` | Modificar — agregar botón "Resetear contraseña" |

---

## Task 1: User.setResetToken()

**Files:**
- Modify: `src/domain/entities/User.ts`
- Test: `src/tests/User.resetToken.test.ts`

- [ ] **Step 1: Escribir el test**

```typescript
// src/tests/User.resetToken.test.ts
import { describe, it, expect } from "vitest";
import { User } from "../domain/entities/User.js";

describe("User.setResetToken", () => {
  const makeUser = () =>
    new User({
      id: "u1",
      email: "test@test.com",
      passwordHash: "hash",
      name: "Test User",
      role: "tenant",
      status: "active",
      activationToken: null,
    });

  it("sets activationToken to the provided token string", () => {
    const user = makeUser();
    user.setResetToken("abc123|1999999999999");
    expect(user.activationToken).toBe("abc123|1999999999999");
  });

  it("updates updatedAt when token is set", () => {
    const user = makeUser();
    const before = user.updatedAt;
    user.setResetToken("abc|123");
    expect(user.updatedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

```powershell
npx vitest run src/tests/User.resetToken.test.ts
```

Esperado: FAIL — `user.setResetToken is not a function`

- [ ] **Step 3: Agregar el método en `User.ts`**

En `src/domain/entities/User.ts`, después del método `activate()` (línea 68), agregar:

```typescript
public setResetToken(token: string): void {
  this.activationToken = token;
  this.updatedAt = new Date();
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

```powershell
npx vitest run src/tests/User.resetToken.test.ts
```

Esperado: PASS (2 tests)

- [ ] **Step 5: Commit**

```powershell
git add src/domain/entities/User.ts src/tests/User.resetToken.test.ts
git commit -m "feat: add User.setResetToken() for password reset flow"
```

---

## Task 2: RequestPasswordResetUseCase

**Files:**
- Create: `src/application/use-cases/auth/RequestPasswordResetUseCase.ts`
- Create: `src/tests/RequestPasswordResetUseCase.test.ts`

- [ ] **Step 1: Escribir el test**

```typescript
// src/tests/RequestPasswordResetUseCase.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { RequestPasswordResetUseCase } from "../application/use-cases/auth/RequestPasswordResetUseCase.js";
import { IUserRepository } from "../application/interfaces/IUserRepository.js";
import { IEmailClient } from "../application/interfaces/IEmailClient.js";
import { User } from "../domain/entities/User.js";

const makeUser = () =>
  new User({
    id: "u1",
    email: "vendedor@test.com",
    passwordHash: "hash",
    name: "Vendedor Test",
    role: "tenant",
    status: "active",
    activationToken: null,
  });

describe("RequestPasswordResetUseCase", () => {
  let userRepo: IUserRepository;
  let emailClient: IEmailClient;
  let useCase: RequestPasswordResetUseCase;

  beforeEach(() => {
    userRepo = {
      findByEmail: vi.fn(),
      save: vi.fn(),
      findById: vi.fn(),
      findBySellerId: vi.fn(),
      findByActivationToken: vi.fn(),
      findPendingTenants: vi.fn(),
      getAll: vi.fn(),
      count: vi.fn(),
    };
    emailClient = {
      sendPasswordReset: vi.fn().mockResolvedValue({ success: true }),
      sendQuestionReviewAlert: vi.fn(),
      sendClaimSlaAlert: vi.fn(),
      sendTestEmail: vi.fn(),
      sendTenantInvitation: vi.fn(),
    };
    useCase = new RequestPasswordResetUseCase(userRepo, emailClient);
  });

  it("returns ok:true silently when email does not exist", async () => {
    vi.mocked(userRepo.findByEmail).mockResolvedValue(null);
    const result = await useCase.execute({ email: "noexiste@test.com" });
    expect(result).toEqual({ ok: true });
    expect(emailClient.sendPasswordReset).not.toHaveBeenCalled();
  });

  it("sets reset token on user and saves when email exists", async () => {
    const user = makeUser();
    vi.mocked(userRepo.findByEmail).mockResolvedValue(user);
    vi.mocked(userRepo.save).mockResolvedValue(undefined);

    await useCase.execute({ email: "vendedor@test.com" });

    expect(userRepo.save).toHaveBeenCalledWith(user);
    expect(user.activationToken).toMatch(/^[a-f0-9]+\|\d+$/);
  });

  it("sends reset email with correct params when email exists", async () => {
    const user = makeUser();
    vi.mocked(userRepo.findByEmail).mockResolvedValue(user);
    vi.mocked(userRepo.save).mockResolvedValue(undefined);

    await useCase.execute({ email: "vendedor@test.com", baseUrl: "https://app.com" });

    expect(emailClient.sendPasswordReset).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "vendedor@test.com",
        name: "Vendedor Test",
        resetUrl: expect.stringContaining("/reset-password/"),
        expiresInMinutes: 60,
      })
    );
  });

  it("returns ok:true even when user exists", async () => {
    const user = makeUser();
    vi.mocked(userRepo.findByEmail).mockResolvedValue(user);
    vi.mocked(userRepo.save).mockResolvedValue(undefined);

    const result = await useCase.execute({ email: "vendedor@test.com" });
    expect(result).toEqual({ ok: true });
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

```powershell
npx vitest run src/tests/RequestPasswordResetUseCase.test.ts
```

Esperado: FAIL — `Cannot find module`

- [ ] **Step 3: Crear el use case**

```typescript
// src/application/use-cases/auth/RequestPasswordResetUseCase.ts
import crypto from "crypto";
import { IUserRepository } from "../../interfaces/IUserRepository.js";
import { IEmailClient } from "../../interfaces/IEmailClient.js";

export interface RequestPasswordResetDTO {
  email: string;
  baseUrl?: string;
}

export class RequestPasswordResetUseCase {
  constructor(
    private readonly userRepo: IUserRepository,
    private readonly emailClient: IEmailClient
  ) {}

  public async execute(dto: RequestPasswordResetDTO): Promise<{ ok: true }> {
    const user = await this.userRepo.findByEmail(dto.email);

    if (!user) {
      return { ok: true };
    }

    const hex = crypto.randomBytes(32).toString("hex");
    const expiresAt = Date.now() + 60 * 60 * 1000; // 1 hora
    const token = `${hex}|${expiresAt}`;

    user.setResetToken(token);
    await this.userRepo.save(user);

    const baseUrl = dto.baseUrl || process.env.APP_BASE_URL || "http://localhost:5173";
    const resetUrl = `${baseUrl}/reset-password/${token}`;

    await this.emailClient
      .sendPasswordReset({
        to: user.email,
        name: user.name,
        resetUrl,
        expiresInMinutes: 60,
      })
      .catch((err) => console.error("[RequestPasswordResetUseCase] Error enviando email:", err));

    return { ok: true };
  }
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

```powershell
npx vitest run src/tests/RequestPasswordResetUseCase.test.ts
```

Esperado: PASS (4 tests)

- [ ] **Step 5: Commit**

```powershell
git add src/application/use-cases/auth/RequestPasswordResetUseCase.ts src/tests/RequestPasswordResetUseCase.test.ts
git commit -m "feat: add RequestPasswordResetUseCase"
```

---

## Task 3: ResetPasswordUseCase

**Files:**
- Create: `src/application/use-cases/auth/ResetPasswordUseCase.ts`
- Create: `src/tests/ResetPasswordUseCase.test.ts`

- [ ] **Step 1: Escribir el test**

```typescript
// src/tests/ResetPasswordUseCase.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ResetPasswordUseCase } from "../application/use-cases/auth/ResetPasswordUseCase.js";
import { IUserRepository } from "../application/interfaces/IUserRepository.js";
import { IPasswordHasher } from "../application/interfaces/IPasswordHasher.js";
import { ITokenService, UserTokenPayload } from "../application/interfaces/ITokenService.js";
import { User } from "../domain/entities/User.js";

const FUTURE = Date.now() + 60 * 60 * 1000;
const PAST = Date.now() - 1000;

const makeUser = (token: string) =>
  new User({
    id: "u1",
    email: "vendedor@test.com",
    passwordHash: "oldhash",
    name: "Vendedor Test",
    role: "tenant",
    status: "active",
    activationToken: token,
  });

describe("ResetPasswordUseCase", () => {
  let userRepo: IUserRepository;
  let passwordHasher: IPasswordHasher;
  let tokenService: ITokenService;
  let useCase: ResetPasswordUseCase;

  beforeEach(() => {
    userRepo = {
      findByActivationToken: vi.fn(),
      save: vi.fn(),
      findByEmail: vi.fn(),
      findById: vi.fn(),
      findBySellerId: vi.fn(),
      findPendingTenants: vi.fn(),
      getAll: vi.fn(),
      count: vi.fn(),
    };
    passwordHasher = {
      hash: vi.fn().mockResolvedValue("newhash"),
      compare: vi.fn(),
    };
    tokenService = {
      generateToken: vi.fn().mockReturnValue("jwt.token.here"),
      verifyToken: vi.fn(),
    };
    useCase = new ResetPasswordUseCase(userRepo, passwordHasher, tokenService);
  });

  it("throws when token is not found", async () => {
    vi.mocked(userRepo.findByActivationToken).mockResolvedValue(null);
    await expect(
      useCase.execute({ token: `abc|${FUTURE}`, password: "nueva123" })
    ).rejects.toThrow("Token inválido o expirado.");
  });

  it("throws when token is expired and clears it", async () => {
    const expiredToken = `abc|${PAST}`;
    const user = makeUser(expiredToken);
    vi.mocked(userRepo.findByActivationToken).mockResolvedValue(user);

    await expect(
      useCase.execute({ token: expiredToken, password: "nueva123" })
    ).rejects.toThrow("El link expiró. Solicitá uno nuevo.");

    expect(user.activationToken).toBeNull();
    expect(userRepo.save).toHaveBeenCalledWith(user);
  });

  it("throws when password is too short", async () => {
    const token = `abc|${FUTURE}`;
    const user = makeUser(token);
    vi.mocked(userRepo.findByActivationToken).mockResolvedValue(user);

    await expect(
      useCase.execute({ token, password: "123" })
    ).rejects.toThrow("La contraseña debe tener al menos 6 caracteres.");
  });

  it("resets password and returns JWT on valid token and password", async () => {
    const token = `abc|${FUTURE}`;
    const user = makeUser(token);
    vi.mocked(userRepo.findByActivationToken).mockResolvedValue(user);

    const result = await useCase.execute({ token, password: "nueva123" });

    expect(passwordHasher.hash).toHaveBeenCalledWith("nueva123");
    expect(user.passwordHash).toBe("newhash");
    expect(user.activationToken).toBeNull();
    expect(user.status).toBe("active");
    expect(result.token).toBe("jwt.token.here");
    expect(result.user.email).toBe("vendedor@test.com");
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

```powershell
npx vitest run src/tests/ResetPasswordUseCase.test.ts
```

Esperado: FAIL — `Cannot find module`

- [ ] **Step 3: Crear el use case**

```typescript
// src/application/use-cases/auth/ResetPasswordUseCase.ts
import { IUserRepository } from "../../interfaces/IUserRepository.js";
import { IPasswordHasher } from "../../interfaces/IPasswordHasher.js";
import { ITokenService, UserTokenPayload } from "../../interfaces/ITokenService.js";

export interface ResetPasswordDTO {
  token: string;
  password: string;
}

export interface ResetPasswordResponseDTO {
  token: string;
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
    status: string;
  };
}

export class ResetPasswordUseCase {
  constructor(
    private readonly userRepo: IUserRepository,
    private readonly passwordHasher: IPasswordHasher,
    private readonly tokenService: ITokenService
  ) {}

  public async execute(dto: ResetPasswordDTO): Promise<ResetPasswordResponseDTO> {
    const user = await this.userRepo.findByActivationToken(dto.token);

    if (!user) {
      throw new Error("Token inválido o expirado.");
    }

    const parts = dto.token.split("|");
    const expiresAt = parts.length === 2 ? Number(parts[1]) : 0;

    if (Date.now() > expiresAt) {
      user.activationToken = null;
      user.updatedAt = new Date();
      await this.userRepo.save(user);
      throw new Error("El link expiró. Solicitá uno nuevo.");
    }

    if (!dto.password || dto.password.length < 6) {
      throw new Error("La contraseña debe tener al menos 6 caracteres.");
    }

    const passwordHash = await this.passwordHasher.hash(dto.password);
    user.activate(passwordHash);
    await this.userRepo.save(user);

    const payload: UserTokenPayload = {
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      sellerId: user.sellerId,
    };
    const jwtToken = this.tokenService.generateToken(payload);

    return {
      token: jwtToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        status: user.status,
      },
    };
  }
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

```powershell
npx vitest run src/tests/ResetPasswordUseCase.test.ts
```

Esperado: PASS (4 tests)

- [ ] **Step 5: Commit**

```powershell
git add src/application/use-cases/auth/ResetPasswordUseCase.ts src/tests/ResetPasswordUseCase.test.ts
git commit -m "feat: add ResetPasswordUseCase"
```

---

## Task 4: Handlers en AuthController

**Files:**
- Modify: `src/presentation/controllers/AuthController.ts`

- [ ] **Step 1: Agregar imports y dependencias al constructor**

En `src/presentation/controllers/AuthController.ts`:

Agregar imports al inicio del archivo (después de los imports existentes):

```typescript
import { RequestPasswordResetUseCase } from "../../application/use-cases/auth/RequestPasswordResetUseCase.js";
import { ResetPasswordUseCase } from "../../application/use-cases/auth/ResetPasswordUseCase.js";
```

Cambiar el constructor de `AuthController` — agregar las dos nuevas dependencias al final:

```typescript
export class AuthController {
  constructor(
    private readonly registerUseCase: RegisterUserUseCase,
    private readonly loginUseCase: LoginUserUseCase,
    private readonly getCurrentUserUseCase: GetCurrentUserUseCase,
    private readonly connectMeliUseCase: ConnectMeliAccountUseCase,
    private readonly getOnboardingStatusUseCase: GetOnboardingStatusUseCase,
    private readonly tokenService: ITokenService,
    private readonly activateTenantUseCase: ActivateTenantUseCase,
    private readonly requestPasswordResetUseCase: RequestPasswordResetUseCase,
    private readonly resetPasswordUseCase: ResetPasswordUseCase
  ) {}
```

- [ ] **Step 2: Agregar los dos handlers al final de la clase (antes del cierre `}`)**

```typescript
  public forgotPassword = async (request: FastifyRequest, reply: FastifyReply) => {
    const { email } = (request.body as { email?: string }) || {};
    if (!email) {
      return reply.status(400).send({ error: "El campo email es requerido." });
    }
    const origin = request.headers.origin || process.env.APP_BASE_URL || "http://localhost:5173";
    await this.requestPasswordResetUseCase
      .execute({ email, baseUrl: origin })
      .catch((err) => console.error("[AuthController.forgotPassword]", err));
    return reply.send({ ok: true });
  };

  public resetPassword = async (request: FastifyRequest, reply: FastifyReply) => {
    const { token } = request.params as { token: string };
    const { password } = (request.body as { password?: string }) || {};
    if (!password) {
      return reply.status(400).send({ error: "El campo password es requerido." });
    }
    try {
      const result = await this.resetPasswordUseCase.execute({ token, password });
      return reply.send(result);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  };
```

- [ ] **Step 3: Verificar que TypeScript compila sin errores**

```powershell
npx tsc --noEmit
```

Esperado: sin errores (o solo errores preexistentes no relacionados)

- [ ] **Step 4: Commit**

```powershell
git add src/presentation/controllers/AuthController.ts
git commit -m "feat: add forgotPassword and resetPassword handlers to AuthController"
```

---

## Task 5: Handler en AdminController

**Files:**
- Modify: `src/presentation/controllers/AdminController.ts`

El admin usa el email del tenant para disparar el reset. `TenantOverview` ya tiene `email`. El endpoint recibe `userId` del usuario seleccionado, busca su email y llama al use case.

- [ ] **Step 1: Agregar import y dependencia**

En `src/presentation/controllers/AdminController.ts`, agregar el import después de los existentes:

```typescript
import { RequestPasswordResetUseCase } from "../../application/use-cases/auth/RequestPasswordResetUseCase.js";
```

Cambiar el constructor agregando la nueva dependencia al final:

```typescript
export class AdminController {
  constructor(
    private readonly getGlobalMetricsUseCase: GetGlobalMetricsUseCase,
    private readonly listTenantsOverviewUseCase: ListTenantsOverviewUseCase,
    private readonly getTenantDetailUseCase: GetTenantDetailUseCase,
    private readonly toggleTenantAutoAnswerUseCase: ToggleTenantAutoAnswerUseCase,
    private readonly forceTokenRefreshUseCase: ForceTokenRefreshUseCase,
    private readonly updateTenantPermissionsUseCase: UpdateTenantPermissionsUseCase,
    private readonly createTenantUseCase: CreateTenantUseCase,
    private readonly userRepo: IUserRepository,
    private readonly requestPasswordResetUseCase: RequestPasswordResetUseCase
  ) {}
```

- [ ] **Step 2: Agregar el handler al final de la clase (antes del cierre `}`)**

```typescript
  public resetUserPassword = async (request: FastifyRequest, reply: FastifyReply) => {
    const { userId } = request.params as { userId: string };
    const origin = request.headers.origin || process.env.APP_BASE_URL || "http://localhost:5173";
    try {
      const user = await this.userRepo.findById(userId);
      if (!user) {
        return reply.status(404).send({ error: "Usuario no encontrado." });
      }
      await this.requestPasswordResetUseCase.execute({ email: user.email, baseUrl: origin });
      return reply.send({ ok: true, email: user.email });
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  };
```

- [ ] **Step 3: Verificar TypeScript**

```powershell
npx tsc --noEmit
```

Esperado: sin errores nuevos

- [ ] **Step 4: Commit**

```powershell
git add src/presentation/controllers/AdminController.ts
git commit -m "feat: add resetUserPassword handler to AdminController"
```

---

## Task 6: Wiring en app.ts

**Files:**
- Modify: `src/app.ts`

- [ ] **Step 1: Agregar imports de los nuevos use cases**

En `src/app.ts`, después del import de `ActivateTenantUseCase` (línea 55), agregar:

```typescript
import { RequestPasswordResetUseCase } from "./application/use-cases/auth/RequestPasswordResetUseCase.js";
import { ResetPasswordUseCase } from "./application/use-cases/auth/ResetPasswordUseCase.js";
```

- [ ] **Step 2: Instanciar los use cases**

En `src/app.ts`, después de la línea `const activateTenantUseCase = new ActivateTenantUseCase(...)` (alrededor de línea 169), agregar:

```typescript
const requestPasswordResetUseCase = new RequestPasswordResetUseCase(userRepo, emailClient);
const resetPasswordUseCase = new ResetPasswordUseCase(userRepo, passwordHasher, tokenService);
```

- [ ] **Step 3: Actualizar la instanciación de AuthController**

Encontrar la línea donde se crea `authCtrl` (alrededor de línea 227) y agregar las dos nuevas dependencias al final:

```typescript
const authCtrl = new AuthController(
  registerUserUseCase, loginUserUseCase, getCurrentUserUseCase,
  connectMeliAccountUseCase, getOnboardingStatusUseCase, tokenService,
  activateTenantUseCase,
  requestPasswordResetUseCase,
  resetPasswordUseCase
);
```

- [ ] **Step 4: Actualizar la instanciación de AdminController**

Encontrar la línea donde se crea `adminCtrl` (alrededor de línea 233) y agregar la nueva dependencia al final:

```typescript
const adminCtrl = new AdminController(
  getGlobalMetricsUseCase, listTenantsOverviewUseCase, getTenantDetailUseCase,
  toggleTenantAutoAnswerUseCase, forceTokenRefreshUseCase, updateTenantPermissionsUseCase,
  createTenantUseCase, userRepo,
  requestPasswordResetUseCase
);
```

- [ ] **Step 5: Registrar las nuevas rutas**

En la sección de rutas de Auth (alrededor de línea 265), agregar:

```typescript
app.post("/api/auth/forgot-password", authCtrl.forgotPassword);
app.post("/api/auth/reset-password/:token", authCtrl.resetPassword);
```

En la sección de rutas de Super Admin, agregar:

```typescript
app.post("/api/admin/users/:userId/reset-password", { preHandler: requireSuperAdmin }, adminCtrl.resetUserPassword);
```

- [ ] **Step 6: Verificar TypeScript y correr todos los tests**

```powershell
npx tsc --noEmit
npx vitest run
```

Esperado: sin errores de tipos, todos los tests pasan

- [ ] **Step 7: Commit**

```powershell
git add src/app.ts
git commit -m "feat: wire password reset use cases and routes in app.ts"
```

---

## Task 7: ForgotPasswordPage

**Files:**
- Create: `client/src/pages/ForgotPasswordPage.tsx`

Reutiliza las clases CSS de `LoginPage.css` — no se crea CSS nuevo.

- [ ] **Step 1: Crear la página**

```tsx
// client/src/pages/ForgotPasswordPage.tsx
import { useState, FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bot, Mail, ArrowLeft, ArrowRight } from 'lucide-react'
import './LoginPage.css'

export default function ForgotPasswordPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
    } catch {
      // silencioso — no revelamos si el email existe
    } finally {
      setLoading(false)
      setSent(true)
    }
  }

  return (
    <div className="login-root">
      <div className="login-glow login-glow-1" aria-hidden="true" />
      <div className="login-glow login-glow-2" aria-hidden="true" />

      <div className="login-container">
        <div className="login-card glass-panel">
          <div className="login-brand-header">
            <div className="login-logo-glow-wrap">
              <div className="login-logo-badge">
                <Bot size={26} className="text-white" />
              </div>
            </div>
            <div className="login-brand-texts">
              <div className="brand-title-row">
                <h1 className="login-brand-title">MELI AI</h1>
                <span className="login-pro-pill">PRO</span>
              </div>
              <p className="login-tagline">Recuperación de contraseña</p>
            </div>
          </div>

          {sent ? (
            <div style={{ textAlign: 'center', padding: '8px 0 16px' }}>
              <p style={{ fontSize: '15px', color: 'var(--text-primary, #f8fafc)', marginBottom: '8px' }}>
                📬 Revisá tu casilla de correo
              </p>
              <p style={{ fontSize: '13px', color: 'var(--text-muted, #94a3b8)', marginBottom: '24px', lineHeight: '1.5' }}>
                Si el email está registrado, recibirás un link de recuperación en los próximos minutos.
              </p>
              <button
                className="login-submit-btn"
                onClick={() => navigate('/login')}
              >
                <span className="btn-normal-content">
                  <ArrowLeft size={16} /> Volver al login
                </span>
              </button>
            </div>
          ) : (
            <form className="login-form" onSubmit={handleSubmit} noValidate>
              <div className="login-field-group">
                <label className="login-label" htmlFor="email">
                  Correo Electrónico
                </label>
                <div className="login-input-wrap">
                  <Mail size={17} className="input-icon-left" />
                  <input
                    id="email"
                    className="login-input"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="ej. vendedor@ejemplo.com"
                    autoComplete="email"
                    required
                    autoFocus
                  />
                </div>
              </div>

              <button className="login-submit-btn" type="submit" disabled={loading || !email}>
                {loading ? (
                  <span className="btn-loading-content">
                    <span className="pulse-dot" /> Enviando…
                  </span>
                ) : (
                  <span className="btn-normal-content">
                    Enviar link de recuperación <ArrowRight size={17} />
                  </span>
                )}
              </button>

              <div style={{ textAlign: 'center', marginTop: '16px' }}>
                <button
                  type="button"
                  onClick={() => navigate('/login')}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', color: '#64748b' }}
                >
                  ← Volver al login
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```powershell
git add client/src/pages/ForgotPasswordPage.tsx
git commit -m "feat: add ForgotPasswordPage"
```

---

## Task 8: ResetPasswordPage

**Files:**
- Create: `client/src/pages/ResetPasswordPage.tsx`

Clon de `ActivatePage.tsx` con copy diferente y redirect a `/` en lugar de `/onboarding`.

- [ ] **Step 1: Crear la página**

```tsx
// client/src/pages/ResetPasswordPage.tsx
import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import './ActivatePage.css'

export default function ResetPasswordPage() {
  const { token } = useParams<{ token: string }>()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.')
      return
    }
    if (password !== confirm) {
      setError('Las contraseñas no coinciden.')
      return
    }

    setLoading(true)
    try {
      const res = await fetch(`/api/auth/reset-password/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error al restablecer la contraseña.')

      localStorage.setItem('token', data.token)
      setDone(true)
      setTimeout(() => navigate('/'), 2000)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="activate-page">
      <div className="activate-card">
        <div className="activate-logo">MeliBot</div>

        {done ? (
          <div className="activate-success">
            <div className="activate-success-icon">✓</div>
            <p className="activate-success-title">¡Contraseña actualizada!</p>
            <p className="activate-success-text">Redirigiendo al panel…</p>
          </div>
        ) : (
          <>
            <h1 className="activate-title">Restablecer contraseña</h1>
            <p className="activate-subtitle">
              Elegí una nueva contraseña para tu cuenta.
            </p>
            <form onSubmit={handleSubmit}>
              <div className="activate-field">
                <label className="activate-label">Nueva contraseña</label>
                <input
                  type="password"
                  className="activate-input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  autoFocus
                />
              </div>
              <div className="activate-field">
                <label className="activate-label">Repetir contraseña</label>
                <input
                  type="password"
                  className="activate-input"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Repetí la contraseña"
                />
              </div>
              <button type="submit" className="activate-btn" disabled={loading}>
                {loading ? 'Actualizando…' : 'Restablecer contraseña'}
              </button>
              {error && <p className="activate-error">{error}</p>}
            </form>
          </>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```powershell
git add client/src/pages/ResetPasswordPage.tsx
git commit -m "feat: add ResetPasswordPage"
```

---

## Task 9: LoginPage link + rutas en App.tsx

**Files:**
- Modify: `client/src/pages/LoginPage.tsx`
- Modify: `client/src/App.tsx`

- [ ] **Step 1: Agregar link en LoginPage.tsx**

En `client/src/pages/LoginPage.tsx`, encontrar el bloque del label de contraseña (línea ~120):

```tsx
<div className="field-label-row">
  <label className="login-label" htmlFor="password">
    Contraseña
  </label>
</div>
```

Reemplazar por:

```tsx
<div className="field-label-row">
  <label className="login-label" htmlFor="password">
    Contraseña
  </label>
  <a
    href="/forgot-password"
    style={{ fontSize: '12px', color: '#64748b', textDecoration: 'none' }}
    onMouseOver={e => (e.currentTarget.style.color = '#94a3b8')}
    onMouseOut={e => (e.currentTarget.style.color = '#64748b')}
  >
    ¿Olvidaste tu contraseña?
  </a>
</div>
```

- [ ] **Step 2: Agregar rutas en App.tsx**

En `client/src/App.tsx`, agregar los imports lazy al bloque existente (alrededor de línea 15):

```tsx
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage'))
const ResetPasswordPage  = lazy(() => import('./pages/ResetPasswordPage'))
```

Agregar las rutas públicas dentro de `<Routes>`, después de la ruta `/login` (alrededor de línea 56):

```tsx
<Route path="/forgot-password" element={<ForgotPasswordPage />} />
<Route path="/reset-password/:token" element={<ResetPasswordPage />} />
```

- [ ] **Step 3: Verificar que TypeScript compila**

```powershell
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```powershell
git add client/src/pages/LoginPage.tsx client/src/App.tsx
git commit -m "feat: add forgot-password link in login and public reset routes"
```

---

## Task 10: Botón "Resetear contraseña" en AdminPage

**Files:**
- Modify: `client/src/pages/AdminPage.tsx`

El botón aparece en dos lugares:
1. En la fila de cada **invitación pendiente** (tienen `id` = userId).
2. En el panel de detalle del **tenant activo seleccionado** (donde está "Guardar permisos").

Para los tenants activos no tenemos el `userId` directamente — usamos un endpoint alternativo buscando por email vía el `RequestPasswordResetUseCase` (que ya acepta email). Agregamos un endpoint helper o directamente llamamos a `POST /api/auth/forgot-password` con el email del tenant. **Usamos el endpoint de admin** para no bypassear auth: `POST /api/admin/users/:userId/reset-password` requiere conocer el `userId`, el cual no tenemos en `TenantOverview`.

**Solución pragmática:** para tenants activos, llamar a `POST /api/auth/forgot-password` con el email del tenant desde el admin — el efecto es idéntico. Para invitaciones pendientes, usar `POST /api/admin/users/:userId/reset-password`.

- [ ] **Step 1: Agregar estado para el feedback de reset**

En `client/src/pages/AdminPage.tsx`, agregar al bloque de estados (después de `const [copied, setCopied] = useState(false)`):

```tsx
const [resetSent, setResetSent]       = useState<string | null>(null)
const [resetting, setResetting]       = useState<string | null>(null)
```

- [ ] **Step 2: Agregar función de reset para invitaciones pendientes**

Agregar la función después de `copyLink`:

```tsx
const handleResetPassword = async (userId: string, email: string) => {
  setResetting(userId)
  try {
    await api.post(`/admin/users/${userId}/reset-password`, {})
    setResetSent(email)
    setTimeout(() => setResetSent(null), 4000)
  } catch (err: any) {
    console.error('Error al enviar reset:', err)
  } finally {
    setResetting(null)
  }
}

const handleResetForTenant = async (email: string) => {
  setResetting(email)
  try {
    await fetch('/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })
    setResetSent(email)
    setTimeout(() => setResetSent(null), 4000)
  } catch (err: any) {
    console.error('Error al enviar reset:', err)
  } finally {
    setResetting(null)
  }
}
```

- [ ] **Step 3: Agregar botón en filas de invitaciones pendientes**

Encontrar el bloque de la invitación pendiente (alrededor de línea 188):

```tsx
<div key={inv.id} className="tenant-row tenant-row--pending">
  <div className="tenant-row-info">
    <span className="tenant-row-name">{inv.name}</span>
    <span className="tenant-row-email">{inv.email}</span>
  </div>
  <span className="badge-pending">Pendiente</span>
</div>
```

Reemplazar por:

```tsx
<div key={inv.id} className="tenant-row tenant-row--pending">
  <div className="tenant-row-info">
    <span className="tenant-row-name">{inv.name}</span>
    <span className="tenant-row-email">{inv.email}</span>
  </div>
  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
    <span className="badge-pending">Pendiente</span>
    <button
      style={{
        background: 'none', border: '1px solid #334155', borderRadius: '6px',
        color: '#94a3b8', fontSize: '11px', padding: '3px 8px', cursor: 'pointer'
      }}
      disabled={resetting === inv.id}
      onClick={() => handleResetPassword(inv.id, inv.email)}
      title="Reenviar link de activación"
    >
      {resetting === inv.id ? '…' : '↺ Reenviar'}
    </button>
  </div>
</div>
```

- [ ] **Step 4: Agregar botón en el panel de detalle del tenant activo**

Encontrar el botón "Guardar permisos" (alrededor de línea 258):

```tsx
<button className="btn-save" onClick={savePermissions} disabled={saving}>
  {saving ? 'Guardando…' : 'Guardar permisos'}
</button>
```

Reemplazar por:

```tsx
<button className="btn-save" onClick={savePermissions} disabled={saving}>
  {saving ? 'Guardando…' : 'Guardar permisos'}
</button>
{selectedTenant.email && (
  <button
    style={{
      marginTop: '8px', width: '100%', background: 'none',
      border: '1px solid #334155', borderRadius: '8px', color: '#94a3b8',
      fontSize: '13px', padding: '8px', cursor: 'pointer'
    }}
    disabled={resetting === selectedTenant.email}
    onClick={() => handleResetForTenant(selectedTenant.email!)}
  >
    {resetting === selectedTenant.email ? 'Enviando…' : '🔑 Resetear contraseña'}
  </button>
)}
{resetSent && (
  <p style={{ fontSize: '12px', color: '#10b981', marginTop: '8px', textAlign: 'center' }}>
    ✓ Email de reset enviado a {resetSent}
  </p>
)}
```

- [ ] **Step 5: Verificar TypeScript**

```powershell
npx tsc --noEmit
```

- [ ] **Step 6: Commit final**

```powershell
git add client/src/pages/AdminPage.tsx
git commit -m "feat: add reset password button in admin panel for tenants and pending invitations"
```

---

## Self-Review

**Spec coverage:**
- ✅ Auto-servicio: `ForgotPasswordPage` → `POST /api/auth/forgot-password` → `RequestPasswordResetUseCase`
- ✅ Admin-triggered: botón en `AdminPage` → `POST /api/admin/users/:userId/reset-password` (pending) y `forgot-password` (activos)
- ✅ Login automático post-reset: `ResetPasswordPage` guarda JWT y redirige a `/`
- ✅ Token embebido en `activationToken`, expiración 1h, cero cambios en DB
- ✅ Respuesta siempre 200 en `forgot-password` (no revela existencia del email)
- ✅ Email ya implementado en `ResendEmailClient` — no requiere cambios

**Placeholders:** ninguno — todo el código está completo en cada paso.

**Type consistency:**
- `setResetToken(token)` definido en Task 1, usado en `RequestPasswordResetUseCase` (Task 2)
- `ResetPasswordUseCase` retorna `{ token, user }` — mismo shape que `ActivateTenantUseCase`
- `RequestPasswordResetUseCase` en el constructor de `AdminController` y `AuthController` — mismo import path `.../RequestPasswordResetUseCase.js`
- `api.post` en `AdminPage` usa la misma instancia que el resto del archivo
