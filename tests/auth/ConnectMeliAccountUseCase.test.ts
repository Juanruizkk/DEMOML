import { describe, it, expect, beforeEach, vi } from "vitest";
import { ConnectMeliAccountUseCase } from "../../src/application/use-cases/auth/ConnectMeliAccountUseCase.js";
import { User } from "../../src/domain/entities/User.js";
import { Tenant } from "../../src/domain/entities/Tenant.js";

describe("ConnectMeliAccountUseCase", () => {
  let mockMeliClient: any;
  let mockTenantRepo: any;
  let mockUserRepo: any;
  let mockEventRepo: any;
  let mockTokenService: any;
  let useCase: ConnectMeliAccountUseCase;

  let tenants: Map<string, Tenant>;
  let users: Map<string, User>;
  let events: any[];

  beforeEach(() => {
    tenants = new Map();
    users = new Map();
    events = [];

    mockMeliClient = {
      exchangeCodeForTokens: vi.fn(async (code: string) => {
        if (code === "valid_code") {
          return {
            access_token: "APP_USR-test-token-123",
            refresh_token: "TG-test-refresh-456",
            expires_in: 21600,
            user_id: 123456789,
          };
        }
        throw new Error("Invalid OAuth code");
      }),
      getSellerProfile: vi.fn(async (sellerId: string) => ({
        id: Number(sellerId),
        nickname: "MERCADOLIBRE_OFICIAL",
        email: "tienda@mercadolibre.com",
      })),
    };

    mockTenantRepo = {
      findBySellerId: vi.fn(async (sellerId: string) => tenants.get(sellerId) || null),
      save: vi.fn(async (tenant: Tenant) => {
        tenants.set(tenant.sellerId, tenant);
      }),
    };

    mockUserRepo = {
      findById: vi.fn(async (id: string) => users.get(id) || null),
      save: vi.fn(async (user: User) => {
        users.set(user.id, user);
      }),
    };

    mockEventRepo = {
      log: vi.fn(async (event: any) => {
        events.push(event);
      }),
    };

    mockTokenService = {
      generateToken: vi.fn(() => "new_jwt_with_seller_id"),
    };

    useCase = new ConnectMeliAccountUseCase(
      mockMeliClient,
      mockTenantRepo,
      mockUserRepo,
      mockEventRepo,
      mockTokenService
    );
  });

  it("debe crear un Tenant nuevo, vincularlo al usuario y devolver un nuevo token", async () => {
    const user = new User({
      id: "user-uuid-1",
      email: "vendedor@demo.com",
      passwordHash: "hash",
      name: "Juan Vendedor",
      role: "tenant",
    });
    users.set(user.id, user);

    const result = await useCase.execute({
      code: "valid_code",
      userId: "user-uuid-1",
    });

    expect(result.sellerId).toBe("123456789");
    expect(result.nickname).toBe("MERCADOLIBRE_OFICIAL");
    expect(result.isNewTenant).toBe(true);
    expect(result.token).toBe("new_jwt_with_seller_id");
    expect(result.user?.sellerId).toBe("123456789");

    // Verificar persistencia de Tenant
    const savedTenant = tenants.get("123456789");
    expect(savedTenant).toBeDefined();
    expect(savedTenant?.accessToken).toBe("APP_USR-test-token-123");
    expect(savedTenant?.nickname).toBe("MERCADOLIBRE_OFICIAL");

    // Verificar actualización de User
    const savedUser = users.get("user-uuid-1");
    expect(savedUser?.sellerId).toBe("123456789");

    // Verificar evento de auditoría
    expect(events.length).toBe(1);
    expect(events[0].type).toBe("ACCOUNT_CONNECTED");
  });

  it("debe actualizar tokens si el Tenant ya existía", async () => {
    const existingTenant = Tenant.createDefault({
      id: "123456789",
      sellerId: "123456789",
      nickname: "Antiguo Nickname",
      accessToken: "old-token",
      refreshToken: "old-refresh",
      expiresInSec: 100,
    });
    tenants.set(existingTenant.sellerId, existingTenant);

    const result = await useCase.execute({
      code: "valid_code",
    });

    expect(result.isNewTenant).toBe(false);
    expect(result.nickname).toBe("MERCADOLIBRE_OFICIAL");

    const updated = tenants.get("123456789")!;
    expect(updated.accessToken).toBe("APP_USR-test-token-123");
  });

  it("debe lanzar error si el código OAuth es inválido", async () => {
    await expect(
      useCase.execute({
        code: "invalid_code",
      })
    ).rejects.toThrow("Invalid OAuth code");
  });
});
