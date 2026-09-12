import { describe, it, expect, beforeEach, vi } from "vitest";
import { GetOnboardingStatusUseCase } from "../../src/application/use-cases/auth/GetOnboardingStatusUseCase.js";
import { User } from "../../src/domain/entities/User.js";
import { Tenant } from "../../src/domain/entities/Tenant.js";

describe("GetOnboardingStatusUseCase", () => {
  let mockUserRepo: any;
  let mockTenantRepo: any;
  let useCase: GetOnboardingStatusUseCase;

  let users: Map<string, User>;
  let tenants: Map<string, Tenant>;

  beforeEach(() => {
    users = new Map();
    tenants = new Map();

    mockUserRepo = {
      findById: vi.fn(async (id: string) => users.get(id) || null),
    };

    mockTenantRepo = {
      findBySellerId: vi.fn(async (sellerId: string) => tenants.get(sellerId) || null),
    };

    useCase = new GetOnboardingStatusUseCase(mockUserRepo, mockTenantRepo);
  });

  it("debe retornar isMeliConnected=false si el usuario no tiene sellerId", async () => {
    const user = new User({
      id: "u-1",
      email: "test@demo.com",
      passwordHash: "hash",
      name: "Sin Conectar",
      role: "tenant",
    });
    users.set(user.id, user);

    const status = await useCase.execute("u-1");

    expect(status.isMeliConnected).toBe(false);
    expect(status.user.sellerId).toBeNull();
    expect(status.meliAuthUrl).toContain("state=u-1");
  });

  it("debe retornar isMeliConnected=true y detalles del Tenant si está conectado", async () => {
    const user = new User({
      id: "u-2",
      email: "conectado@demo.com",
      passwordHash: "hash",
      name: "Conectado",
      role: "tenant",
      sellerId: "MLA999",
    });
    users.set(user.id, user);

    const tenant = Tenant.createDefault({
      id: "MLA999",
      sellerId: "MLA999",
      nickname: "TIENDA_OFICIAL_PRO",
      accessToken: "token",
      refreshToken: "refresh",
      expiresInSec: 3600,
    });
    tenants.set("MLA999", tenant);

    const status = await useCase.execute("u-2");

    expect(status.isMeliConnected).toBe(true);
    expect(status.tenant?.sellerId).toBe("MLA999");
    expect(status.tenant?.nickname).toBe("TIENDA_OFICIAL_PRO");
    expect(status.tenant?.tokenHealth).toBe("healthy");
    expect(status.tenant?.autoAnswerEnabled).toBe(true);
  });
});
