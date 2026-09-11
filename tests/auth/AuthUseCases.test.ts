import { describe, it, expect, beforeEach, vi } from "vitest";
import { RegisterUserUseCase } from "../../src/application/use-cases/auth/RegisterUserUseCase.js";
import { LoginUserUseCase } from "../../src/application/use-cases/auth/LoginUserUseCase.js";
import { User } from "../../src/domain/entities/User.js";

describe("Auth Use Cases (Register & Login)", () => {
  let mockUserRepo: any;
  let mockHasher: any;
  let mockTokenService: any;
  let registerUseCase: RegisterUserUseCase;
  let loginUseCase: LoginUserUseCase;

  beforeEach(() => {
    const users = new Map<string, User>();

    mockUserRepo = {
      findById: vi.fn(async (id: string) => users.get(id) || null),
      findByEmail: vi.fn(async (email: string) => {
        for (const u of users.values()) {
          if (u.email === email.toLowerCase().trim()) return u;
        }
        return null;
      }),
      save: vi.fn(async (user: User) => {
        users.set(user.id, user);
      }),
    };

    mockHasher = {
      hash: vi.fn(async (p: string) => `hashed_${p}`),
      compare: vi.fn(async (p: string, h: string) => h === `hashed_${p}`),
    };

    mockTokenService = {
      generateToken: vi.fn(() => "mocked_jwt_token"),
      verifyToken: vi.fn(),
    };

    registerUseCase = new RegisterUserUseCase(mockUserRepo, mockHasher, mockTokenService);
    loginUseCase = new LoginUserUseCase(mockUserRepo, mockHasher, mockTokenService);
  });

  it("debe registrar un nuevo usuario y devolver su token", async () => {
    const result = await registerUseCase.execute({
      email: "nuevo@vendedor.com",
      password: "Password123!",
      name: "Nuevo Vendedor",
      role: "tenant",
      sellerId: "MLA888",
    });

    expect(result.token).toBe("mocked_jwt_token");
    expect(result.user.email).toBe("nuevo@vendedor.com");
    expect(result.user.role).toBe("tenant");
    expect(result.user.sellerId).toBe("MLA888");
  });

  it("debe rechazar registro con email duplicado", async () => {
    await registerUseCase.execute({
      email: "duplicado@vendedor.com",
      password: "Password123!",
      name: "Primero",
    });

    await expect(
      registerUseCase.execute({
        email: "duplicado@vendedor.com",
        password: "Password123!",
        name: "Segundo",
      })
    ).rejects.toThrow("Ya existe un usuario registrado");
  });

  it("debe iniciar sesión con credenciales correctas", async () => {
    await registerUseCase.execute({
      email: "login@vendedor.com",
      password: "Password123!",
      name: "Vendedor Login",
    });

    const result = await loginUseCase.execute({
      email: "login@vendedor.com",
      password: "Password123!",
    });

    expect(result.token).toBe("mocked_jwt_token");
    expect(result.user.email).toBe("login@vendedor.com");
  });

  it("debe rechazar inicio de sesión con contraseña incorrecta", async () => {
    await registerUseCase.execute({
      email: "login2@vendedor.com",
      password: "PasswordCorrecta",
      name: "Vendedor 2",
    });

    await expect(
      loginUseCase.execute({
        email: "login2@vendedor.com",
        password: "PasswordErronea",
      })
    ).rejects.toThrow("Credenciales inválidas");
  });
});
