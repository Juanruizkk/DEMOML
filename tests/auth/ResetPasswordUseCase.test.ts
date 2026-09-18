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
