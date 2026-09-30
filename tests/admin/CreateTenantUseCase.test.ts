import { describe, it, expect, vi } from "vitest";
import { CreateTenantUseCase } from "../../src/application/use-cases/admin/CreateTenantUseCase.js";
import { IUserRepository } from "../../src/application/interfaces/IUserRepository.js";
import { User } from "../../src/domain/entities/User.js";

function makeRepo(): IUserRepository {
  return {
    findById: vi.fn().mockResolvedValue(null),
    findByEmail: vi.fn().mockResolvedValue(null),
    findBySellerId: vi.fn().mockResolvedValue(null),
    findAllBySellerId: vi.fn().mockResolvedValue([]),
    findByActivationToken: vi.fn().mockResolvedValue(null),
    findPendingTenants: vi.fn().mockResolvedValue([]),
    findActiveUnconnectedTenants: vi.fn().mockResolvedValue([]),
    save: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
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
