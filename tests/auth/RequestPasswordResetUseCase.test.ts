import { describe, it, expect, vi, beforeEach } from "vitest";
import { RequestPasswordResetUseCase } from "../../src/application/use-cases/auth/RequestPasswordResetUseCase.js";
import { IUserRepository } from "../../src/application/interfaces/IUserRepository.js";
import { IEmailClient } from "../../src/application/interfaces/IEmailClient.js";
import { User } from "../../src/domain/entities/User.js";

const makeUser = () =>
  new User({
    id: "u1",
    email: "vendedor@test.com",
    passwordHash: "hash",
    name: "Vendedor Test",
    role: "tenant",
    status: "active",
    activationToken: null,
  });

describe("RequestPasswordResetUseCase", () => {
  let userRepo: IUserRepository;
  let emailClient: IEmailClient;
  let useCase: RequestPasswordResetUseCase;

  beforeEach(() => {
    userRepo = {
      findByEmail: vi.fn(),
      save: vi.fn(),
      findById: vi.fn(),
      findBySellerId: vi.fn(),
      findAllBySellerId: vi.fn().mockResolvedValue([]),
      findByActivationToken: vi.fn(),
      findPendingTenants: vi.fn(),
      findActiveUnconnectedTenants: vi.fn().mockResolvedValue([]),
      delete: vi.fn().mockResolvedValue(undefined),
      getAll: vi.fn(),
      count: vi.fn(),
    };
    emailClient = {
      sendPasswordReset: vi.fn().mockResolvedValue({ success: true }),
      sendQuestionReviewAlert: vi.fn(),
      sendClaimSlaAlert: vi.fn(),
      sendTestEmail: vi.fn(),
      sendTenantInvitation: vi.fn(),
    };
    useCase = new RequestPasswordResetUseCase(userRepo, emailClient);
  });

  it("returns ok:true silently when email does not exist", async () => {
    vi.mocked(userRepo.findByEmail).mockResolvedValue(null);
    const result = await useCase.execute({ email: "noexiste@test.com" });
    expect(result).toEqual({ ok: true });
    expect(emailClient.sendPasswordReset).not.toHaveBeenCalled();
  });

  it("sets reset token on user and saves when email exists", async () => {
    const user = makeUser();
    vi.mocked(userRepo.findByEmail).mockResolvedValue(user);
    vi.mocked(userRepo.save).mockResolvedValue(undefined);

    await useCase.execute({ email: "vendedor@test.com" });

    expect(userRepo.save).toHaveBeenCalledWith(user);
    expect(user.activationToken).toMatch(/^[a-f0-9]+\|\d+$/);
  });

  it("sends reset email with correct params when email exists", async () => {
    const user = makeUser();
    vi.mocked(userRepo.findByEmail).mockResolvedValue(user);
    vi.mocked(userRepo.save).mockResolvedValue(undefined);

    await useCase.execute({ email: "vendedor@test.com", baseUrl: "https://app.com" });

    expect(emailClient.sendPasswordReset).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "vendedor@test.com",
        name: "Vendedor Test",
        resetUrl: expect.stringContaining("/reset-password/"),
        expiresInMinutes: 60,
      })
    );
  });

  it("returns ok:true even when user exists", async () => {
    const user = makeUser();
    vi.mocked(userRepo.findByEmail).mockResolvedValue(user);
    vi.mocked(userRepo.save).mockResolvedValue(undefined);

    const result = await useCase.execute({ email: "vendedor@test.com" });
    expect(result).toEqual({ ok: true });
  });
});
