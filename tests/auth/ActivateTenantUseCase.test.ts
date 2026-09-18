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
