import { describe, it, expect } from "vitest";
import { CryptoPasswordHasher } from "../../src/infrastructure/security/CryptoPasswordHasher.js";
import { JwtTokenService } from "../../src/infrastructure/security/JwtTokenService.js";

describe("Security (PasswordHasher & JwtTokenService)", () => {
  const hasher = new CryptoPasswordHasher();
  const tokenService = new JwtTokenService("test_secret_key_12345");

  it("debe hashear y verificar contraseñas correctamente", async () => {
    const rawPassword = "MiPasswordSeguro123!";
    const hash = await hasher.hash(rawPassword);

    expect(hash).toContain(":");
    expect(await hasher.compare(rawPassword, hash)).toBe(true);
    expect(await hasher.compare("PasswordIncorrecto", hash)).toBe(false);
  });

  it("debe generar y verificar JWTs correctamente con claims", () => {
    const payload = {
      userId: "user_123",
      email: "test@tienda.com",
      name: "Test User",
      role: "tenant" as const,
      sellerId: "SELLER_999",
    };

    const token = tokenService.generateToken(payload);
    expect(typeof token).toBe("string");

    const decoded = tokenService.verifyToken(token);
    expect(decoded.userId).toBe("user_123");
    expect(decoded.email).toBe("test@tienda.com");
    expect(decoded.role).toBe("tenant");
    expect(decoded.sellerId).toBe("SELLER_999");
  });

  it("debe rechazar tokens con firmas manipuladas", () => {
    const payload = {
      userId: "user_123",
      email: "test@tienda.com",
      name: "Test User",
      role: "tenant" as const,
    };

    const token = tokenService.generateToken(payload);
    const tampered = token.slice(0, -5) + "abcde";

    expect(() => tokenService.verifyToken(tampered)).toThrow("Firma de token inválida");
  });
});
