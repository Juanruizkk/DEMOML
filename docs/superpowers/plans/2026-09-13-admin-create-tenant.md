# Admin Create Tenant Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the super admin create tenant accounts from the admin panel with a two-step flow: admin fills name + email → gets an activation link → tenant sets password via that link.

**Architecture:** Add `status` and `activation_token` columns to the `users` table. A new `CreateTenantUseCase` creates a `pending` user with a random token; `ActivateTenantUseCase` validates the token, sets the password, and marks the user `active`. The activation link is shown on-screen in the admin modal (no email sending yet). A public `/activate/:token` route lets the tenant complete onboarding.

**Tech Stack:** TypeScript, Fastify, better-sqlite3, Vitest, React + React Router v6, `api` client (`get/post/put`).

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/infrastructure/persistence/sqlite/SqliteDatabase.ts` | Modify | Add `status`/`activation_token` columns via `addColumnIfNotExists` |
| `src/domain/entities/User.ts` | Modify | Add `status` (`pending`\|`active`) and `activationToken` fields |
| `src/application/interfaces/IUserRepository.ts` | Modify | Add `findByActivationToken` and `findPendingTenants` |
| `src/infrastructure/persistence/sqlite/SqliteUserRepository.ts` | Modify | Implement new methods + persist new fields |
| `src/application/use-cases/admin/CreateTenantUseCase.ts` | Create | Admin creates a pending tenant user |
| `src/application/use-cases/auth/ActivateTenantUseCase.ts` | Create | Tenant sets password and goes active |
| `src/presentation/controllers/AdminController.ts` | Modify | Add `createTenant` and `getPendingInvitations` handlers |
| `src/presentation/controllers/AuthController.ts` | Modify | Add `activateTenant` handler |
| `src/app.ts` | Modify | Wire new use cases, controllers, and routes |
| `src/tests/CreateTenantUseCase.test.ts` | Create | Unit tests for CreateTenantUseCase |
| `src/tests/ActivateTenantUseCase.test.ts` | Create | Unit tests for ActivateTenantUseCase |
| `client/src/pages/ActivatePage.tsx` | Create | Public page where tenant sets their password |
| `client/src/pages/ActivatePage.css` | Create | Styles for activation page |
| `client/src/App.tsx` | Modify | Add public `/activate/:token` route |
| `client/src/pages/AdminPage.tsx` | Modify | Add "Nuevo tenant" button, creation modal, activation link, pending badges |

---

## Task 1: DB Schema Migration

**Files:**
- Modify: `src/infrastructure/persistence/sqlite/SqliteDatabase.ts`

- [ ] **Step 1: Add migration calls for new columns**

In `SqliteDatabase.ts`, at the end of the `addColumnIfNotExists` block (after the `addColumnIfNotExists("users", "seller_id", "TEXT")` line), add:

```typescript
addColumnIfNotExists("users", "status", "TEXT NOT NULL DEFAULT 'active'");
addColumnIfNotExists("users", "activation_token", "TEXT");
```

> Note: Default is `active` so existing users (super_admin, seeded tenants) stay fully functional without migration.

- [ ] **Step 2: Run the app to verify the migration runs without error**

```bash
npm run dev
```

Expected: server starts, no SQLite errors. Check the log for "Error seeding" — there should be none.

- [ ] **Step 3: Commit**

```bash
git add src/infrastructure/persistence/sqlite/SqliteDatabase.ts
git commit -m "feat: add status and activation_token columns to users table"
```

---

## Task 2: Update User Entity and Repository

**Files:**
- Modify: `src/domain/entities/User.ts`
- Modify: `src/application/interfaces/IUserRepository.ts`
- Modify: `src/infrastructure/persistence/sqlite/SqliteUserRepository.ts`

- [ ] **Step 1: Update `UserProps` and `User` class**

In `src/domain/entities/User.ts`, update `UserProps` and the `User` class:

```typescript
export type UserStatus = "pending" | "active";

export interface UserProps {
  id: string;
  email: string;
  passwordHash: string;
  name: string;
  role: UserRoleType;
  sellerId?: string | null;
  status?: UserStatus;
  activationToken?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export class User {
  public readonly id: string;
  public email: string;
  public passwordHash: string;
  public name: string;
  public role: UserRoleType;
  public sellerId?: string | null;
  public status: UserStatus;
  public activationToken?: string | null;
  public readonly createdAt: Date;
  public updatedAt: Date;

  constructor(props: UserProps) {
    this.id = props.id;
    this.email = this.normalizeEmail(props.email);
    this.passwordHash = props.passwordHash;
    this.name = props.name.trim();
    this.role = props.role;
    this.sellerId = props.sellerId || null;
    this.status = props.status ?? "active";
    this.activationToken = props.activationToken ?? null;
    this.createdAt = props.createdAt || new Date();
    this.updatedAt = props.updatedAt || new Date();

    this.validate();
  }

  private normalizeEmail(email: string): string {
    return email.toLowerCase().trim();
  }

  private validate(): void {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(this.email)) {
      throw new Error(`Email inválido: ${this.email}`);
    }
    if (!this.name || this.name.length < 2) {
      throw new Error("El nombre debe tener al menos 2 caracteres.");
    }
  }

  public isPending(): boolean {
    return this.status === "pending";
  }

  public activate(passwordHash: string): void {
    this.passwordHash = passwordHash;
    this.status = "active";
    this.activationToken = null;
    this.updatedAt = new Date();
  }

  public isSuperAdmin(): boolean {
    return this.role === "super_admin";
  }

  public isDemo(): boolean {
    return this.role === "demo";
  }

  public canAccessSeller(sellerId: string): boolean {
    if (this.isSuperAdmin()) return true;
    return this.sellerId === sellerId;
  }

  public linkSeller(sellerId: string): void {
    this.sellerId = sellerId;
    this.updatedAt = new Date();
  }

  public toJSON(): Omit<UserProps, "passwordHash"> {
    return {
      id: this.id,
      email: this.email,
      name: this.name,
      role: this.role,
      sellerId: this.sellerId,
      status: this.status,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
```

- [ ] **Step 2: Update `IUserRepository`**

In `src/application/interfaces/IUserRepository.ts`:

```typescript
import { User } from "../../domain/entities/User.js";

export interface IUserRepository {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  findBySellerId(sellerId: string): Promise<User | null>;
  findByActivationToken(token: string): Promise<User | null>;
  findPendingTenants(): Promise<User[]>;
  save(user: User): Promise<void>;
  getAll(): Promise<User[]>;
  count(): Promise<number>;
}
```

- [ ] **Step 3: Update `SqliteUserRepository`**

Replace the full file `src/infrastructure/persistence/sqlite/SqliteUserRepository.ts`:

```typescript
import { Database as DatabaseType } from "better-sqlite3";
import { IUserRepository } from "../../../application/interfaces/IUserRepository.js";
import { User } from "../../../domain/entities/User.js";
import { UserRoleType } from "../../../domain/value-objects/UserRole.js";

export class SqliteUserRepository implements IUserRepository {
  constructor(private readonly db: DatabaseType) {}

  public async findById(id: string): Promise<User | null> {
    const row = this.db.prepare("SELECT * FROM users WHERE id = ?").get(id) as any;
    if (!row) return null;
    return this.mapToDomain(row);
  }

  public async findByEmail(email: string): Promise<User | null> {
    const normalized = email.toLowerCase().trim();
    const row = this.db.prepare("SELECT * FROM users WHERE email = ?").get(normalized) as any;
    if (!row) return null;
    return this.mapToDomain(row);
  }

  public async findBySellerId(sellerId: string): Promise<User | null> {
    const row = this.db.prepare("SELECT * FROM users WHERE seller_id = ?").get(sellerId) as any;
    if (!row) return null;
    return this.mapToDomain(row);
  }

  public async findByActivationToken(token: string): Promise<User | null> {
    const row = this.db.prepare("SELECT * FROM users WHERE activation_token = ?").get(token) as any;
    if (!row) return null;
    return this.mapToDomain(row);
  }

  public async findPendingTenants(): Promise<User[]> {
    const rows = this.db
      .prepare("SELECT * FROM users WHERE role = 'tenant' AND status = 'pending' ORDER BY created_at DESC")
      .all() as any[];
    return rows.map((r) => this.mapToDomain(r));
  }

  public async save(user: User): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO users (id, email, password_hash, name, role, seller_id, status, activation_token, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        email = excluded.email,
        password_hash = excluded.password_hash,
        name = excluded.name,
        role = excluded.role,
        seller_id = excluded.seller_id,
        status = excluded.status,
        activation_token = excluded.activation_token,
        updated_at = excluded.updated_at
    `);

    stmt.run(
      user.id,
      user.email,
      user.passwordHash,
      user.name,
      user.role,
      user.sellerId || null,
      user.status,
      user.activationToken || null,
      user.createdAt.toISOString(),
      user.updatedAt.toISOString()
    );
  }

  public async getAll(): Promise<User[]> {
    const rows = this.db.prepare("SELECT * FROM users ORDER BY created_at DESC").all() as any[];
    return rows.map((r) => this.mapToDomain(r));
  }

  public async count(): Promise<number> {
    const row = this.db.prepare("SELECT COUNT(*) as count FROM users").get() as any;
    return row?.count || 0;
  }

  private mapToDomain(row: any): User {
    return new User({
      id: row.id,
      email: row.email,
      passwordHash: row.password_hash,
      name: row.name,
      role: row.role as UserRoleType,
      sellerId: row.seller_id || null,
      status: row.status ?? "active",
      activationToken: row.activation_token ?? null,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    });
  }
}
```

- [ ] **Step 4: Run TypeScript check**

```bash
npm run build
```

Expected: compiles without errors. Fix any TS errors before continuing.

- [ ] **Step 5: Commit**

```bash
git add src/domain/entities/User.ts src/application/interfaces/IUserRepository.ts src/infrastructure/persistence/sqlite/SqliteUserRepository.ts
git commit -m "feat: add status and activationToken to User entity and repository"
```

---

## Task 3: CreateTenantUseCase

**Files:**
- Create: `src/application/use-cases/admin/CreateTenantUseCase.ts`
- Create: `src/tests/CreateTenantUseCase.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/tests/CreateTenantUseCase.test.ts`:

```typescript
import { describe, it, expect, beforeEach, vi } from "vitest";
import { CreateTenantUseCase } from "../application/use-cases/admin/CreateTenantUseCase.js";
import { IUserRepository } from "../application/interfaces/IUserRepository.js";
import { User } from "../domain/entities/User.js";

function makeRepo(): IUserRepository {
  return {
    findById: vi.fn().mockResolvedValue(null),
    findByEmail: vi.fn().mockResolvedValue(null),
    findBySellerId: vi.fn().mockResolvedValue(null),
    findByActivationToken: vi.fn().mockResolvedValue(null),
    findPendingTenants: vi.fn().mockResolvedValue([]),
    save: vi.fn().mockResolvedValue(undefined),
    getAll: vi.fn().mockResolvedValue([]),
    count: vi.fn().mockResolvedValue(0),
  };
}

describe("CreateTenantUseCase", () => {
  it("creates a pending user and returns an activation token", async () => {
    const repo = makeRepo();
    const useCase = new CreateTenantUseCase(repo);

    const result = await useCase.execute({ name: "Acme Corp", email: "acme@example.com" });

    expect(result.activationToken).toBeTruthy();
    expect(result.activationToken.length).toBeGreaterThan(10);
    expect(repo.save).toHaveBeenCalledOnce();

    const savedUser = (repo.save as any).mock.calls[0][0] as User;
    expect(savedUser.email).toBe("acme@example.com");
    expect(savedUser.name).toBe("Acme Corp");
    expect(savedUser.role).toBe("tenant");
    expect(savedUser.status).toBe("pending");
    expect(savedUser.activationToken).toBe(result.activationToken);
  });

  it("throws if email is already registered", async () => {
    const repo = makeRepo();
    (repo.findByEmail as any).mockResolvedValue({ email: "acme@example.com" });
    const useCase = new CreateTenantUseCase(repo);

    await expect(
      useCase.execute({ name: "Acme Corp", email: "acme@example.com" })
    ).rejects.toThrow("Ya existe un usuario registrado con este correo electrónico.");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/tests/CreateTenantUseCase.test.ts
```

Expected: FAIL — `CreateTenantUseCase` not found.

- [ ] **Step 3: Implement `CreateTenantUseCase`**

Create `src/application/use-cases/admin/CreateTenantUseCase.ts`:

```typescript
import crypto from "node:crypto";
import { IUserRepository } from "../../interfaces/IUserRepository.js";
import { User } from "../../../domain/entities/User.js";

export interface CreateTenantDTO {
  name: string;
  email: string;
}

export interface CreateTenantResult {
  userId: string;
  activationToken: string;
}

export class CreateTenantUseCase {
  constructor(private readonly userRepo: IUserRepository) {}

  public async execute(dto: CreateTenantDTO): Promise<CreateTenantResult> {
    const existing = await this.userRepo.findByEmail(dto.email);
    if (existing) {
      throw new Error("Ya existe un usuario registrado con este correo electrónico.");
    }

    const userId = crypto.randomUUID();
    const activationToken = crypto.randomBytes(32).toString("hex");
    const placeholderHash = crypto.randomBytes(32).toString("hex");

    const user = new User({
      id: userId,
      email: dto.email,
      passwordHash: placeholderHash,
      name: dto.name,
      role: "tenant",
      status: "pending",
      activationToken,
    });

    await this.userRepo.save(user);

    return { userId, activationToken };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run src/tests/CreateTenantUseCase.test.ts
```

Expected: PASS — 2 tests passing.

- [ ] **Step 5: Commit**

```bash
git add src/application/use-cases/admin/CreateTenantUseCase.ts src/tests/CreateTenantUseCase.test.ts
git commit -m "feat: add CreateTenantUseCase with pending status and activation token"
```

---

## Task 4: ActivateTenantUseCase

**Files:**
- Create: `src/application/use-cases/auth/ActivateTenantUseCase.ts`
- Create: `src/tests/ActivateTenantUseCase.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/tests/ActivateTenantUseCase.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";
import { ActivateTenantUseCase } from "../application/use-cases/auth/ActivateTenantUseCase.js";
import { IUserRepository } from "../application/interfaces/IUserRepository.js";
import { IPasswordHasher } from "../application/interfaces/IPasswordHasher.js";
import { ITokenService, UserTokenPayload } from "../application/interfaces/ITokenService.js";
import { User } from "../domain/entities/User.js";

function makePendingUser(): User {
  return new User({
    id: "u-001",
    email: "acme@example.com",
    passwordHash: "placeholder",
    name: "Acme Corp",
    role: "tenant",
    status: "pending",
    activationToken: "abc123token",
  });
}

function makeRepo(user: User | null): IUserRepository {
  return {
    findById: vi.fn().mockResolvedValue(null),
    findByEmail: vi.fn().mockResolvedValue(null),
    findBySellerId: vi.fn().mockResolvedValue(null),
    findByActivationToken: vi.fn().mockResolvedValue(user),
    findPendingTenants: vi.fn().mockResolvedValue([]),
    save: vi.fn().mockResolvedValue(undefined),
    getAll: vi.fn().mockResolvedValue([]),
    count: vi.fn().mockResolvedValue(0),
  };
}

function makePasswordHasher(): IPasswordHasher {
  return {
    hash: vi.fn().mockResolvedValue("hashed_password"),
    compare: vi.fn().mockResolvedValue(true),
  };
}

function makeTokenService(): ITokenService {
  return {
    generateToken: vi.fn().mockReturnValue("jwt_token_here"),
    verifyToken: vi.fn().mockReturnValue({} as UserTokenPayload),
  };
}

describe("ActivateTenantUseCase", () => {
  it("activates a pending user and returns a JWT", async () => {
    const user = makePendingUser();
    const repo = makeRepo(user);
    const hasher = makePasswordHasher();
    const tokenService = makeTokenService();
    const useCase = new ActivateTenantUseCase(repo, hasher, tokenService);

    const result = await useCase.execute({ token: "abc123token", password: "newpassword123" });

    expect(result.token).toBe("jwt_token_here");
    expect(result.user.status).toBe("active");
    expect(repo.save).toHaveBeenCalledOnce();
    const savedUser = (repo.save as any).mock.calls[0][0] as User;
    expect(savedUser.status).toBe("active");
    expect(savedUser.activationToken).toBeNull();
  });

  it("throws if token is not found", async () => {
    const repo = makeRepo(null);
    const useCase = new ActivateTenantUseCase(repo, makePasswordHasher(), makeTokenService());

    await expect(
      useCase.execute({ token: "invalid", password: "pass123" })
    ).rejects.toThrow("Token de activación inválido o expirado.");
  });

  it("throws if password is too short", async () => {
    const user = makePendingUser();
    const repo = makeRepo(user);
    const useCase = new ActivateTenantUseCase(repo, makePasswordHasher(), makeTokenService());

    await expect(
      useCase.execute({ token: "abc123token", password: "12345" })
    ).rejects.toThrow("La contraseña debe tener al menos 6 caracteres.");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/tests/ActivateTenantUseCase.test.ts
```

Expected: FAIL — `ActivateTenantUseCase` not found.

- [ ] **Step 3: Implement `ActivateTenantUseCase`**

Create `src/application/use-cases/auth/ActivateTenantUseCase.ts`:

```typescript
import { IUserRepository } from "../../interfaces/IUserRepository.js";
import { IPasswordHasher } from "../../interfaces/IPasswordHasher.js";
import { ITokenService, UserTokenPayload } from "../../interfaces/ITokenService.js";

export interface ActivateTenantDTO {
  token: string;
  password: string;
}

export interface ActivateResponseDTO {
  token: string;
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
    status: string;
  };
}

export class ActivateTenantUseCase {
  constructor(
    private readonly userRepo: IUserRepository,
    private readonly passwordHasher: IPasswordHasher,
    private readonly tokenService: ITokenService
  ) {}

  public async execute(dto: ActivateTenantDTO): Promise<ActivateResponseDTO> {
    if (!dto.password || dto.password.length < 6) {
      throw new Error("La contraseña debe tener al menos 6 caracteres.");
    }

    const user = await this.userRepo.findByActivationToken(dto.token);
    if (!user) {
      throw new Error("Token de activación inválido o expirado.");
    }

    const passwordHash = await this.passwordHasher.hash(dto.password);
    user.activate(passwordHash);
    await this.userRepo.save(user);

    const tokenPayload: UserTokenPayload = {
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      sellerId: user.sellerId,
    };

    const jwtToken = this.tokenService.generateToken(tokenPayload);

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

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run src/tests/ActivateTenantUseCase.test.ts
```

Expected: PASS — 3 tests passing.

- [ ] **Step 5: Commit**

```bash
git add src/application/use-cases/auth/ActivateTenantUseCase.ts src/tests/ActivateTenantUseCase.test.ts
git commit -m "feat: add ActivateTenantUseCase for tenant password activation"
```

---

## Task 5: Backend Wiring (Controllers + Routes)

**Files:**
- Modify: `src/presentation/controllers/AdminController.ts`
- Modify: `src/presentation/controllers/AuthController.ts`
- Modify: `src/app.ts`

- [ ] **Step 1: Update `AdminController`**

Replace the full file `src/presentation/controllers/AdminController.ts`:

```typescript
import { FastifyRequest, FastifyReply } from "fastify";
import { GetGlobalMetricsUseCase } from "../../application/use-cases/admin/GetGlobalMetricsUseCase.js";
import { ListTenantsOverviewUseCase } from "../../application/use-cases/admin/ListTenantsOverviewUseCase.js";
import { GetTenantDetailUseCase } from "../../application/use-cases/admin/GetTenantDetailUseCase.js";
import { ToggleTenantAutoAnswerUseCase } from "../../application/use-cases/admin/ToggleTenantAutoAnswerUseCase.js";
import { ForceTokenRefreshUseCase } from "../../application/use-cases/admin/ForceTokenRefreshUseCase.js";
import { UpdateTenantPermissionsUseCase } from "../../application/use-cases/admin/UpdateTenantPermissionsUseCase.js";
import { CreateTenantUseCase } from "../../application/use-cases/admin/CreateTenantUseCase.js";
import { IUserRepository } from "../../application/interfaces/IUserRepository.js";
import { TenantPermissions } from "../../domain/entities/Tenant.js";

export class AdminController {
  constructor(
    private readonly getGlobalMetricsUseCase: GetGlobalMetricsUseCase,
    private readonly listTenantsOverviewUseCase: ListTenantsOverviewUseCase,
    private readonly getTenantDetailUseCase: GetTenantDetailUseCase,
    private readonly toggleTenantAutoAnswerUseCase: ToggleTenantAutoAnswerUseCase,
    private readonly forceTokenRefreshUseCase: ForceTokenRefreshUseCase,
    private readonly updateTenantPermissionsUseCase: UpdateTenantPermissionsUseCase,
    private readonly createTenantUseCase: CreateTenantUseCase,
    private readonly userRepo: IUserRepository
  ) {}

  public getMetrics = async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const metrics = await this.getGlobalMetricsUseCase.execute();
      return reply.send(metrics);
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  };

  public getTenants = async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenants = await this.listTenantsOverviewUseCase.execute();
      return reply.send(tenants);
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  };

  public getPendingInvitations = async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const pending = await this.userRepo.findPendingTenants();
      return reply.send(
        pending.map((u) => ({ id: u.id, name: u.name, email: u.email, createdAt: u.createdAt }))
      );
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  };

  public getTenantDetail = async (request: FastifyRequest, reply: FastifyReply) => {
    const { sellerId } = request.params as { sellerId: string };
    try {
      const detail = await this.getTenantDetailUseCase.execute(sellerId);
      return reply.send(detail);
    } catch (err: any) {
      return reply.status(404).send({ error: err.message });
    }
  };

  public toggleAutoAnswer = async (request: FastifyRequest, reply: FastifyReply) => {
    const { sellerId } = request.params as { sellerId: string };
    const { enabled } = (request.body as { enabled?: boolean }) || {};
    try {
      const result = await this.toggleTenantAutoAnswerUseCase.execute({ sellerId, enabled });
      return reply.send(result);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  };

  public refreshToken = async (request: FastifyRequest, reply: FastifyReply) => {
    const { sellerId } = request.params as { sellerId: string };
    try {
      const result = await this.forceTokenRefreshUseCase.execute(sellerId);
      return reply.send(result);
    } catch (err: any) {
      return reply.status(502).send({ error: err.message });
    }
  };

  public updatePermissions = async (request: FastifyRequest, reply: FastifyReply) => {
    const { sellerId } = request.params as { sellerId: string };
    const { permissions } = request.body as { permissions: Partial<TenantPermissions> };
    try {
      const result = await this.updateTenantPermissionsUseCase.execute({ sellerId, permissions });
      return reply.send(result);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  };

  public createTenant = async (request: FastifyRequest, reply: FastifyReply) => {
    const { name, email } = request.body as { name: string; email: string };
    try {
      const result = await this.createTenantUseCase.execute({ name, email });
      const origin = `${request.protocol}://${request.hostname}`;
      const activationUrl = `${origin}/activate/${result.activationToken}`;
      return reply.status(201).send({ userId: result.userId, activationUrl });
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  };
}
```

- [ ] **Step 2: Add `activateTenant` to `AuthController`**

In `src/presentation/controllers/AuthController.ts`, add `ActivateTenantUseCase` to the constructor and add the handler. Replace the full file:

```typescript
import { FastifyRequest, FastifyReply } from "fastify";
import { RegisterUserUseCase, RegisterUserDTO } from "../../application/use-cases/auth/RegisterUserUseCase.js";
import { LoginUserUseCase, LoginUserDTO } from "../../application/use-cases/auth/LoginUserUseCase.js";
import { GetCurrentUserUseCase } from "../../application/use-cases/auth/GetCurrentUserUseCase.js";
import { ConnectMeliAccountUseCase } from "../../application/use-cases/auth/ConnectMeliAccountUseCase.js";
import { GetOnboardingStatusUseCase } from "../../application/use-cases/auth/GetOnboardingStatusUseCase.js";
import { ActivateTenantUseCase } from "../../application/use-cases/auth/ActivateTenantUseCase.js";
import { ITokenService } from "../../application/interfaces/ITokenService.js";

export class AuthController {
  constructor(
    private readonly registerUseCase: RegisterUserUseCase,
    private readonly loginUseCase: LoginUserUseCase,
    private readonly getCurrentUserUseCase: GetCurrentUserUseCase,
    private readonly connectMeliUseCase: ConnectMeliAccountUseCase,
    private readonly getOnboardingStatusUseCase: GetOnboardingStatusUseCase,
    private readonly tokenService: ITokenService,
    private readonly activateTenantUseCase: ActivateTenantUseCase
  ) {}

  public register = async (
    request: FastifyRequest<{ Body: RegisterUserDTO }>,
    reply: FastifyReply
  ) => {
    try {
      const response = await this.registerUseCase.execute(request.body);
      return reply.status(201).send(response);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  };

  public login = async (
    request: FastifyRequest<{ Body: LoginUserDTO }>,
    reply: FastifyReply
  ) => {
    try {
      const response = await this.loginUseCase.execute(request.body);
      return reply.send(response);
    } catch (err: any) {
      return reply.status(401).send({ error: err.message });
    }
  };

  public getMe = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user;
    if (!user || !user.userId) {
      return reply.status(401).send({ error: "No autenticado." });
    }
    try {
      const profile = await this.getCurrentUserUseCase.execute(user.userId);
      return reply.send(profile);
    } catch (err: any) {
      return reply.status(404).send({ error: err.message });
    }
  };

  public getOnboardingStatus = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user;
    if (!user || !user.userId) {
      return reply.status(401).send({ error: "No autenticado." });
    }
    try {
      const status = await this.getOnboardingStatusUseCase.execute(user.userId);
      return reply.send(status);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  };

  public getMeliAuthUrl = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user;
    const userId = user?.userId;
    const stateParam = userId ? `&state=${encodeURIComponent(userId)}` : "";
    const url = `https://auth.mercadolibre.com.ar/authorization?response_type=code&client_id=${process.env.ML_CLIENT_ID || ""}&redirect_uri=${encodeURIComponent(process.env.ML_REDIRECT_URI || "")}${stateParam}`;
    return reply.send({ url });
  };

  public meliOAuthLogin = async (request: FastifyRequest, reply: FastifyReply) => {
    const query = (request.query as { token?: string; userId?: string }) || {};
    let userId = (request as any).user?.userId || query.userId;
    if (!userId && query.token) {
      try {
        const payload = this.tokenService.verifyToken(query.token);
        userId = payload.userId;
      } catch (e) {
        // ignore invalid token
      }
    }
    const stateParam = userId ? `&state=${encodeURIComponent(userId)}` : "";
    const url = `https://auth.mercadolibre.com.ar/authorization?response_type=code&client_id=${process.env.ML_CLIENT_ID || ""}&redirect_uri=${encodeURIComponent(process.env.ML_REDIRECT_URI || "")}${stateParam}`;
    return reply.redirect(url);
  };

  public meliOAuthCallback = async (request: FastifyRequest, reply: FastifyReply) => {
    const query = (request.query as { code?: string; state?: string }) || {};
    const { code, state } = query;
    if (!code) {
      return reply.status(400).send("Falta el parámetro code.");
    }
    try {
      const result = await this.connectMeliUseCase.execute({ code, userId: state });
      const tokenParam = result.token ? `&token=${encodeURIComponent(result.token)}` : "";
      const nicknameParam = `&nickname=${encodeURIComponent(result.nickname)}`;
      const sellerIdParam = `&sellerId=${encodeURIComponent(result.sellerId)}`;
      return reply.redirect(`/onboarding.html?status=connected${sellerIdParam}${nicknameParam}${tokenParam}`);
    } catch (err: any) {
      return reply.redirect(`/onboarding.html?status=error&error=${encodeURIComponent(err.message)}`);
    }
  };

  public activateTenant = async (request: FastifyRequest, reply: FastifyReply) => {
    const { token } = request.params as { token: string };
    const { password } = request.body as { password: string };
    try {
      const result = await this.activateTenantUseCase.execute({ token, password });
      return reply.send(result);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  };
}
```

- [ ] **Step 3: Update `app.ts`**

In `src/app.ts`, make the following changes:

3a. Add imports after the existing admin use-case imports:

```typescript
import { CreateTenantUseCase } from "./application/use-cases/admin/CreateTenantUseCase.js";
import { ActivateTenantUseCase } from "./application/use-cases/auth/ActivateTenantUseCase.js";
```

3b. In the "Casos de Uso Admin" section (after `updateTenantPermissionsUseCase`), add:

```typescript
const createTenantUseCase = new CreateTenantUseCase(userRepo);
const activateTenantUseCase = new ActivateTenantUseCase(userRepo, passwordHasher, tokenService);
```

3c. Replace the `adminCtrl` instantiation:

```typescript
const adminCtrl = new AdminController(
  getGlobalMetricsUseCase, listTenantsOverviewUseCase, getTenantDetailUseCase,
  toggleTenantAutoAnswerUseCase, forceTokenRefreshUseCase, updateTenantPermissionsUseCase,
  createTenantUseCase, userRepo
);
```

3d. Replace the `authCtrl` instantiation:

```typescript
const authCtrl = new AuthController(
  registerUserUseCase, loginUserUseCase, getCurrentUserUseCase,
  connectMeliAccountUseCase, getOnboardingStatusUseCase, tokenService,
  activateTenantUseCase
);
```

3e. Add new routes in the "Rutas — Super Admin" section:

```typescript
app.post("/api/admin/tenants", { preHandler: requireSuperAdmin }, adminCtrl.createTenant);
app.get("/api/admin/invitations", { preHandler: requireSuperAdmin }, adminCtrl.getPendingInvitations);
```

3f. Add activation route in "Rutas — Auth" (no auth guard needed):

```typescript
app.post("/api/auth/activate/:token", authCtrl.activateTenant);
```

- [ ] **Step 4: Build and verify**

```bash
npm run build
```

Expected: compiles without errors.

- [ ] **Step 5: Smoke test the new endpoints manually**

```bash
npm run dev
```

Then in another terminal, test that the endpoints exist (replace TOKEN with a valid super_admin JWT):

```bash
curl -s -X POST http://localhost:3000/api/admin/tenants \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Corp","email":"test@example.com"}' | jq .
```

Expected response:
```json
{
  "userId": "...",
  "activationUrl": "http://localhost:3000/activate/..."
}
```

- [ ] **Step 6: Commit**

```bash
git add src/presentation/controllers/AdminController.ts src/presentation/controllers/AuthController.ts src/app.ts
git commit -m "feat: wire CreateTenantUseCase and ActivateTenantUseCase into routes"
```

---

## Task 6: ActivatePage (Frontend)

**Files:**
- Create: `client/src/pages/ActivatePage.tsx`
- Create: `client/src/pages/ActivatePage.css`

- [ ] **Step 1: Create `ActivatePage.css`**

Create `client/src/pages/ActivatePage.css`:

```css
.activate-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-base, #0f1117);
  padding: 24px;
}

.activate-card {
  width: 100%;
  max-width: 420px;
  background: var(--bg-card, #1a1d27);
  border: 1px solid var(--border, rgba(255,255,255,0.08));
  border-radius: 16px;
  padding: 40px 32px;
}

.activate-logo {
  font-size: 28px;
  font-weight: 700;
  letter-spacing: -0.5px;
  color: var(--text-primary, #f0f2f5);
  margin-bottom: 8px;
}

.activate-title {
  font-size: 20px;
  font-weight: 600;
  color: var(--text-primary, #f0f2f5);
  margin: 0 0 6px;
}

.activate-subtitle {
  font-size: 14px;
  color: var(--text-muted, #8b90a0);
  margin: 0 0 28px;
}

.activate-field {
  margin-bottom: 16px;
}

.activate-label {
  display: block;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-secondary, #b0b6c6);
  margin-bottom: 6px;
}

.activate-input {
  width: 100%;
  padding: 10px 14px;
  background: var(--bg-input, rgba(255,255,255,0.05));
  border: 1px solid var(--border, rgba(255,255,255,0.08));
  border-radius: 8px;
  color: var(--text-primary, #f0f2f5);
  font-size: 14px;
  outline: none;
  box-sizing: border-box;
  transition: border-color 0.15s;
}

.activate-input:focus {
  border-color: var(--accent, #6366f1);
}

.activate-btn {
  width: 100%;
  padding: 11px;
  background: var(--accent, #6366f1);
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  margin-top: 8px;
  transition: opacity 0.15s;
}

.activate-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.activate-error {
  font-size: 13px;
  color: #ef4444;
  margin-top: 12px;
  text-align: center;
}

.activate-success {
  text-align: center;
}

.activate-success-icon {
  font-size: 40px;
  margin-bottom: 12px;
}

.activate-success-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary, #f0f2f5);
  margin: 0 0 8px;
}

.activate-success-text {
  font-size: 14px;
  color: var(--text-muted, #8b90a0);
}
```

- [ ] **Step 2: Create `ActivatePage.tsx`**

Create `client/src/pages/ActivatePage.tsx`:

```tsx
import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import './ActivatePage.css'

export default function ActivatePage() {
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
      const res = await fetch(`/api/auth/activate/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error al activar la cuenta.')

      localStorage.setItem('token', data.token)
      setDone(true)
      setTimeout(() => navigate('/onboarding'), 2000)
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
            <p className="activate-success-title">Cuenta activada</p>
            <p className="activate-success-text">Redirigiendo al onboarding…</p>
          </div>
        ) : (
          <>
            <h1 className="activate-title">Activá tu cuenta</h1>
            <p className="activate-subtitle">
              Elegí una contraseña para acceder al panel de gestión.
            </p>
            <form onSubmit={handleSubmit}>
              <div className="activate-field">
                <label className="activate-label">Contraseña</label>
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
                {loading ? 'Activando…' : 'Activar cuenta'}
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

- [ ] **Step 3: Commit**

```bash
git add client/src/pages/ActivatePage.tsx client/src/pages/ActivatePage.css
git commit -m "feat: add ActivatePage for tenant account activation"
```

---

## Task 7: Frontend Wiring — Route + Admin Modal

**Files:**
- Modify: `client/src/App.tsx`
- Modify: `client/src/pages/AdminPage.tsx`

- [ ] **Step 1: Add `/activate/:token` route to `App.tsx`**

In `client/src/App.tsx`, add the lazy import:

```tsx
const ActivatePage = lazy(() => import('./pages/ActivatePage'))
```

Add the public route inside `<Routes>`, before the catch-all `*` route:

```tsx
{/* Activation — public, no auth required */}
<Route path="/activate/:token" element={<ActivatePage />} />
```

- [ ] **Step 2: Update `AdminPage.tsx` with create tenant modal**

Replace the full `client/src/pages/AdminPage.tsx`:

```tsx
import { useState, useEffect } from 'react'
import { api } from '../api/client'
import PageHeader from '../components/PageHeader'
import './AdminPage.css'

interface Metrics {
  totalTenants?: number
  activeTenants?: number
  totalQuestions?: number
  pendingQuestions?: number
  totalClaims?: number
}

interface TenantOverview {
  sellerId: string
  nickname?: string
  email?: string
  totalQuestions?: number
  autoAnswerEnabled?: boolean
}

interface PendingInvitation {
  id: string
  name: string
  email: string
  createdAt: string
}

interface CreateTenantResult {
  userId: string
  activationUrl: string
}

const PERMISSION_LABELS: Record<string, string> = {
  whatsappEnabled:  'WhatsApp',
  telegramEnabled:  'Telegram',
  emailEnabled:     'Email',
  preSaleEnabled:   'Pre-venta',
  postSaleEnabled:  'Post-venta',
}

export default function AdminPage() {
  const [metrics, setMetrics]           = useState<Metrics | null>(null)
  const [tenants, setTenants]           = useState<TenantOverview[]>([])
  const [pending, setPending]           = useState<PendingInvitation[]>([])
  const [loading, setLoading]           = useState(true)
  const [selected, setSelected]         = useState<string | null>(null)
  const [saving, setSaving]             = useState(false)
  const [localPerms, setLocalPerms]     = useState<Record<string, boolean>>({})

  // Modal state
  const [showModal, setShowModal]       = useState(false)
  const [newName, setNewName]           = useState('')
  const [newEmail, setNewEmail]         = useState('')
  const [creating, setCreating]         = useState(false)
  const [createError, setCreateError]   = useState<string | null>(null)
  const [createdLink, setCreatedLink]   = useState<string | null>(null)
  const [copied, setCopied]             = useState(false)

  useEffect(() => {
    Promise.all([
      api.get<Metrics>('/admin/metrics'),
      api.get<TenantOverview[]>('/admin/tenants'),
      api.get<PendingInvitation[]>('/admin/invitations'),
    ]).then(([m, t, p]) => {
      setMetrics(m)
      setTenants(t)
      setPending(p)
    }).catch(console.error).finally(() => setLoading(false))
  }, [])

  const selectTenant = async (t: TenantOverview) => {
    setSelected(t.sellerId)
    try {
      const detail = await api.get<{ settings: { permissions?: Record<string, boolean> } }>(`/admin/tenants/${t.sellerId}`)
      setLocalPerms(detail.settings?.permissions || {
        whatsappEnabled: true, telegramEnabled: true, emailEnabled: false,
        preSaleEnabled: true, postSaleEnabled: true,
      })
    } catch {
      setLocalPerms({ whatsappEnabled: true, telegramEnabled: true, emailEnabled: false, preSaleEnabled: true, postSaleEnabled: true })
    }
  }

  const savePermissions = async () => {
    if (!selected) return
    setSaving(true)
    try {
      await api.put(`/admin/tenants/${selected}/permissions`, { permissions: localPerms })
      setTenants(ts => ts.map(t =>
        t.sellerId === selected ? { ...t, permissions: { ...localPerms } } : t
      ))
    } catch (e) {
      console.error(e)
    } finally {
      setSaving(false)
    }
  }

  const openModal = () => {
    setShowModal(true)
    setNewName('')
    setNewEmail('')
    setCreateError(null)
    setCreatedLink(null)
    setCopied(false)
  }

  const closeModal = () => {
    setShowModal(false)
    setCreatedLink(null)
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreateError(null)
    setCreating(true)
    try {
      const result = await api.post<CreateTenantResult>('/admin/tenants', { name: newName, email: newEmail })
      setCreatedLink(result.activationUrl)
      setPending(p => [...p, { id: result.userId, name: newName, email: newEmail, createdAt: new Date().toISOString() }])
    } catch (err: any) {
      setCreateError(err.message)
    } finally {
      setCreating(false)
    }
  }

  const copyLink = () => {
    if (!createdLink) return
    navigator.clipboard.writeText(createdLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const selectedTenant = tenants.find(t => t.sellerId === selected)

  return (
    <div className="page">
      <PageHeader
        title="Super Admin"
        subtitle="Panel de operaciones"
        stats={[
          { label: 'Tenants',    value: metrics?.totalTenants    ?? '—', color: 'blue' },
          { label: 'Preguntas',  value: metrics?.totalQuestions  ?? '—', color: 'dim' },
          { label: 'Pendientes', value: metrics?.pendingQuestions ?? '—', color: metrics?.pendingQuestions ? 'amber' : 'dim' },
        ]}
      />

      {loading && <div className="list-empty"><span className="pulse-dot" /> Cargando…</div>}

      {!loading && (
        <div className="admin-layout">
          {/* Tenant list */}
          <div className="tenant-list">
            <div className="tenant-list-header">
              <p className="tenant-list-title">Tenants</p>
              <button className="btn-new-tenant" onClick={openModal}>+ Nuevo</button>
            </div>

            {/* Pending invitations */}
            {pending.length > 0 && (
              <div className="pending-section">
                {pending.map(inv => (
                  <div key={inv.id} className="tenant-row tenant-row--pending">
                    <div className="tenant-row-info">
                      <span className="tenant-row-name">{inv.name}</span>
                      <span className="tenant-row-email">{inv.email}</span>
                    </div>
                    <span className="badge-pending">Pendiente</span>
                  </div>
                ))}
              </div>
            )}

            {tenants.length === 0 && pending.length === 0 && (
              <p className="list-empty" style={{ padding: '24px 16px' }}>Sin tenants registrados</p>
            )}
            {tenants.map(t => (
              <button
                key={t.sellerId}
                className={`tenant-row${selected === t.sellerId ? ' tenant-row--active' : ''}`}
                onClick={() => selectTenant(t)}
              >
                <div className="tenant-row-info">
                  <span className="tenant-row-name">{t.nickname || t.sellerId}</span>
                  {t.email && <span className="tenant-row-email">{t.email}</span>}
                </div>
                <div className="tenant-row-stats">
                  {t.totalQuestions !== undefined && (
                    <span className="tenant-row-badge">{t.totalQuestions} Q</span>
                  )}
                  {t.autoAnswerEnabled && (
                    <span className="tenant-row-badge tenant-row-badge--green">IA ✓</span>
                  )}
                </div>
              </button>
            ))}
          </div>

          {/* Tenant detail */}
          {selectedTenant ? (
            <div className="tenant-detail glass">
              <div className="tenant-detail-header">
                <div>
                  <p className="tenant-detail-name">{selectedTenant.nickname || selectedTenant.sellerId}</p>
                  <p className="tenant-detail-id tabular">ID: {selectedTenant.sellerId}</p>
                </div>
              </div>

              <div className="permissions-section">
                <p className="permissions-title">Permisos granulares</p>
                <p className="permissions-hint">Controlá qué funcionalidades tiene disponibles este tenant.</p>

                <div className="permissions-grid">
                  {Object.entries(PERMISSION_LABELS).map(([key, label]) => (
                    <div key={key} className="permission-item">
                      <div className="permission-info">
                        <span className="permission-label">{label}</span>
                        {key === 'emailEnabled' && (
                          <span className="permission-soon">próximamente</span>
                        )}
                      </div>
                      <button
                        className={`toggle${localPerms[key] ? ' toggle--on' : ''}${key === 'emailEnabled' ? ' toggle--disabled' : ''}`}
                        disabled={key === 'emailEnabled'}
                        onClick={() => setLocalPerms(p => ({ ...p, [key]: !p[key] }))}
                      >
                        <span className="toggle-thumb" />
                      </button>
                    </div>
                  ))}
                </div>

                <button className="btn-save" onClick={savePermissions} disabled={saving}>
                  {saving ? 'Guardando…' : 'Guardar permisos'}
                </button>
              </div>
            </div>
          ) : (
            <div className="tenant-detail-empty">
              <span className="list-empty-icon">◈</span>
              <p>Seleccioná un tenant para ver y editar sus permisos</p>
            </div>
          )}
        </div>
      )}

      {/* Create Tenant Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-card glass" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Nuevo tenant</h3>
              <button className="modal-close" onClick={closeModal}>✕</button>
            </div>

            {createdLink ? (
              <div className="modal-success">
                <p className="modal-success-text">
                  Cuenta creada. Enviá este link al tenant para que active su cuenta:
                </p>
                <div className="activation-link-box">
                  <span className="activation-link-text">{createdLink}</span>
                </div>
                <button className="btn-copy" onClick={copyLink}>
                  {copied ? '✓ Copiado' : 'Copiar link'}
                </button>
                <button className="btn-save" style={{ marginTop: 12 }} onClick={closeModal}>
                  Cerrar
                </button>
              </div>
            ) : (
              <form onSubmit={handleCreate}>
                <div className="modal-field">
                  <label className="modal-label">Nombre</label>
                  <input
                    type="text"
                    className="tenant-input"
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    placeholder="Acme Corp"
                    required
                    autoFocus
                  />
                </div>
                <div className="modal-field">
                  <label className="modal-label">Email</label>
                  <input
                    type="email"
                    className="tenant-input"
                    value={newEmail}
                    onChange={e => setNewEmail(e.target.value)}
                    placeholder="admin@acme.com"
                    required
                  />
                </div>
                {createError && <p className="modal-error">{createError}</p>}
                <button type="submit" className="btn-save" disabled={creating}>
                  {creating ? 'Creando…' : 'Crear tenant'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Add modal + pending badge styles to `AdminPage.css`**

Open `client/src/pages/AdminPage.css` and append the following at the end of the file (do not replace existing styles):

```css
/* ── Tenant list header with button ─────────────────────────────────────── */
.tenant-list-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px 8px;
}

.btn-new-tenant {
  font-size: 12px;
  font-weight: 600;
  color: var(--accent, #6366f1);
  background: transparent;
  border: 1px solid var(--accent, #6366f1);
  border-radius: 6px;
  padding: 4px 10px;
  cursor: pointer;
  transition: background 0.15s;
}

.btn-new-tenant:hover {
  background: rgba(99,102,241,0.12);
}

/* ── Pending invitations ─────────────────────────────────────────────────── */
.pending-section {
  border-bottom: 1px solid var(--border, rgba(255,255,255,0.06));
  margin-bottom: 8px;
  padding-bottom: 8px;
}

.tenant-row--pending {
  cursor: default;
  opacity: 0.75;
}

.badge-pending {
  font-size: 11px;
  font-weight: 600;
  color: #f59e0b;
  background: rgba(245,158,11,0.12);
  border: 1px solid rgba(245,158,11,0.25);
  border-radius: 4px;
  padding: 2px 6px;
  white-space: nowrap;
}

/* ── Modal ───────────────────────────────────────────────────────────────── */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  padding: 24px;
}

.modal-card {
  width: 100%;
  max-width: 420px;
  border-radius: 16px;
  padding: 28px;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
}

.modal-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary, #f0f2f5);
  margin: 0;
}

.modal-close {
  background: transparent;
  border: none;
  color: var(--text-muted, #8b90a0);
  font-size: 16px;
  cursor: pointer;
  padding: 4px;
  line-height: 1;
}

.modal-field {
  margin-bottom: 14px;
}

.modal-label {
  display: block;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-secondary, #b0b6c6);
  margin-bottom: 6px;
}

.modal-error {
  font-size: 13px;
  color: #ef4444;
  margin: 8px 0;
}

.modal-success {
  text-align: center;
}

.modal-success-text {
  font-size: 14px;
  color: var(--text-secondary, #b0b6c6);
  margin-bottom: 14px;
}

.activation-link-box {
  background: var(--bg-input, rgba(255,255,255,0.04));
  border: 1px solid var(--border, rgba(255,255,255,0.08));
  border-radius: 8px;
  padding: 10px 14px;
  margin-bottom: 12px;
  word-break: break-all;
}

.activation-link-text {
  font-size: 12px;
  color: var(--accent, #6366f1);
  font-family: monospace;
}

.btn-copy {
  width: 100%;
  padding: 9px;
  background: var(--bg-input, rgba(255,255,255,0.05));
  border: 1px solid var(--border, rgba(255,255,255,0.1));
  border-radius: 8px;
  color: var(--text-primary, #f0f2f5);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s;
}

.btn-copy:hover {
  background: rgba(255,255,255,0.08);
}
```

- [ ] **Step 4: Run the frontend dev server and verify the full flow**

```bash
cd client && npm run dev
```

Verify:
1. Log in as super admin → navigate to `/admin`
2. "Nuevo" button appears in tenant list header
3. Click "Nuevo" → modal opens with name + email fields
4. Fill in form → click "Crear tenant" → activation link appears
5. Copy the link, open it in a new tab → ActivatePage renders
6. Set a password → redirected to `/onboarding`
7. Pending tenant appears with amber "Pendiente" badge in the list

- [ ] **Step 5: Commit**

```bash
git add client/src/App.tsx client/src/pages/AdminPage.tsx client/src/pages/ActivatePage.tsx client/src/pages/ActivatePage.css
git commit -m "feat: admin create tenant modal with activation link and pending badge"
```

---

## Full Test Suite

After all tasks are complete, run the full test suite to verify nothing regressed:

```bash
npx vitest run
```

Expected: all tests pass including the 5 new ones in `CreateTenantUseCase.test.ts` and `ActivateTenantUseCase.test.ts`.
