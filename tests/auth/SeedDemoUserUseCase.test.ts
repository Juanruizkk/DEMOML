import { describe, it, expect, vi, beforeEach } from "vitest";
import { SeedDemoUserUseCase } from "../../src/application/use-cases/auth/SeedDemoUserUseCase.js";

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

  it("crea usuario y tenant demo cuando ambos no existen y hay token", async () => {
    mockUserRepo.findByEmail.mockResolvedValue(null);
    mockTenantRepo.findBySellerId.mockResolvedValue(null);
    process.env.DEMO_EMAIL = "demo@melibot.com";
    process.env.DEMO_PASSWORD = "Demo123456!";
    process.env.DEMO_SELLER_ID = "3680586616";
    process.env.DEMO_ACCESS_TOKEN = "test_token_123";

    const useCase = new SeedDemoUserUseCase(mockUserRepo as any, mockTenantRepo as any, mockHasher as any);
    await useCase.execute();

    expect(mockUserRepo.save).toHaveBeenCalledOnce();
    expect(mockTenantRepo.save).toHaveBeenCalledOnce();
  });
});
