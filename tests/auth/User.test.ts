import { describe, it, expect } from "vitest";
import { User } from "../../src/domain/entities/User.js";

describe("User Entity (Domain)", () => {
  it("debe crear un usuario válido con email normalizado", () => {
    const user = new User({
      id: "u123",
      email: "  Vendedor@Tienda.COM  ",
      passwordHash: "hash123",
      name: "Juan Perez",
      role: "tenant",
      sellerId: "MLA12345",
    });

    expect(user.email).toBe("vendedor@tienda.com");
    expect(user.role).toBe("tenant");
    expect(user.sellerId).toBe("MLA12345");
  });

  it("debe rechazar emails inválidos", () => {
    expect(() => {
      new User({
        id: "u123",
        email: "email-invalido",
        passwordHash: "hash123",
        name: "Juan",
        role: "tenant",
      });
    }).toThrow("Email inválido");
  });

  it("un Super Admin debe tener acceso a cualquier sellerId", () => {
    const admin = new User({
      id: "admin1",
      email: "admin@melibot.com",
      passwordHash: "hash123",
      name: "Admin",
      role: "super_admin",
    });

    expect(admin.isSuperAdmin()).toBe(true);
    expect(admin.canAccessSeller("MLA999999")).toBe(true);
  });

  it("un Tenant solo debe tener acceso a su propio sellerId", () => {
    const tenant = new User({
      id: "t1",
      email: "cliente@tienda.com",
      passwordHash: "hash123",
      name: "Cliente",
      role: "tenant",
      sellerId: "SELLER_PROPIO",
    });

    expect(tenant.isSuperAdmin()).toBe(false);
    expect(tenant.canAccessSeller("SELLER_PROPIO")).toBe(true);
    expect(tenant.canAccessSeller("SELLER_AJENO")).toBe(false);
  });
});
