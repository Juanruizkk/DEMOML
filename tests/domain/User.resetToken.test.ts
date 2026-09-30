import { describe, it, expect } from "vitest";
import { User } from "../../src/domain/entities/User.js";

describe("User.setResetToken", () => {
  const makeUser = () =>
    new User({
      id: "u1",
      email: "test@test.com",
      passwordHash: "hash",
      name: "Test User",
      role: "tenant",
      status: "active",
      activationToken: null,
    });

  it("sets activationToken to the provided token string", () => {
    const user = makeUser();
    user.setResetToken("abc123|1999999999999");
    expect(user.activationToken).toBe("abc123|1999999999999");
  });

  it("updates updatedAt when token is set", () => {
    const user = makeUser();
    const before = user.updatedAt;
    user.setResetToken("abc|123");
    expect(user.updatedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
  });
});
