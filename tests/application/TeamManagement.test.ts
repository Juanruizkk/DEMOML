import { describe, it, expect, vi, beforeEach } from "vitest";
import { User } from "../../src/domain/entities/User.js";
import { Tenant } from "../../src/domain/entities/Tenant.js";
import { IUserRepository } from "../../src/application/interfaces/IUserRepository.js";
import { ITenantRepository } from "../../src/application/interfaces/ITenantRepository.js";
import { IEventRepository } from "../../src/application/interfaces/IEventRepository.js";
import { IEmailClient } from "../../src/application/interfaces/IEmailClient.js";
import { ListTeamMembersUseCase } from "../../src/application/use-cases/tenant/ListTeamMembersUseCase.js";
import { InviteTeamMemberUseCase } from "../../src/application/use-cases/tenant/InviteTeamMemberUseCase.js";
import { RemoveTeamMemberUseCase } from "../../src/application/use-cases/tenant/RemoveTeamMemberUseCase.js";

describe("Team Management Use Cases", () => {
  let userRepo: IUserRepository;
  let tenantRepo: ITenantRepository;
  let eventRepo: IEventRepository;
  let emailClient: IEmailClient;

  let users: Map<string, User>;
  let tenant: Tenant;

  beforeEach(() => {
    users = new Map<string, User>();

    userRepo = {
      findById: vi.fn(async (id: string) => users.get(id) || null),
      findByEmail: vi.fn(async (email: string) => {
        for (const u of users.values()) {
          if (u.email.toLowerCase() === email.toLowerCase()) return u;
        }
        return null;
      }),
      findBySellerId: vi.fn(async (sellerId: string) => {
        for (const u of users.values()) {
          if (u.sellerId === sellerId) return u;
        }
        return null;
      }),
      findAllBySellerId: vi.fn(async (sellerId: string) => {
        return Array.from(users.values()).filter((u) => u.sellerId === sellerId);
      }),
      findByActivationToken: vi.fn(async () => null),
      findPendingTenants: vi.fn(async () => []),
      findActiveUnconnectedTenants: vi.fn(async () => []),
      save: vi.fn(async (user: User) => {
        users.set(user.id, user);
      }),
      delete: vi.fn(async (id: string) => {
        users.delete(id);
      }),
      getAll: vi.fn(async () => Array.from(users.values())),
      count: vi.fn(async () => users.size),
    };

    tenant = Tenant.createDefault({
      id: "3680586616",
      sellerId: "3680586616",
      nickname: "Tienda Oficial Demo",
      email: "owner@demo.com",
      accessToken: "token_123",
      refreshToken: "refresh_123",
      expiresInSec: 21600,
    });

    tenantRepo = {
      findById: vi.fn(async (id: string) => (id === tenant.id ? tenant : null)),
      findBySellerId: vi.fn(async (sId: string) => (sId === tenant.sellerId ? tenant : null)),
      findByTelegramChatId: vi.fn(async () => null),
      save: vi.fn(async () => {}),
      getAll: vi.fn(async () => [tenant]),
    };

    eventRepo = {
      log: vi.fn(async () => {}),
      getRecent: vi.fn(async () => []),
      getRecentBySellerId: vi.fn(async () => []),
    };

    emailClient = {
      sendQuestionReviewAlert: vi.fn(async () => ({ success: true })),
      sendClaimSlaAlert: vi.fn(async () => ({ success: true })),
      sendTestEmail: vi.fn(async () => ({ success: true })),
      sendTenantInvitation: vi.fn(async () => ({ success: true, messageId: "msg_123" })),
      sendPasswordReset: vi.fn(async () => ({ success: true })),
    };

    // Agregar usuario dueño
    const owner = new User({
      id: "usr_owner",
      email: "owner@demo.com",
      passwordHash: "hash123",
      name: "Juan Dueño",
      role: "tenant",
      sellerId: "3680586616",
      status: "active",
    });
    users.set(owner.id, owner);
  });

  describe("ListTeamMembersUseCase", () => {
    it("should list team members and indicate if multiUserEnabled is active", async () => {
      tenant.updatePermissions({ multiUserEnabled: true });
      const useCase = new ListTeamMembersUseCase(userRepo, tenantRepo);
      const result = await useCase.execute("3680586616");

      expect(result.multiUserEnabled).toBe(true);
      expect(result.members.length).toBe(1);
      expect(result.members[0].name).toBe("Juan Dueño");
    });
  });

  describe("InviteTeamMemberUseCase", () => {
    it("should reject invitation if multiUserEnabled is false", async () => {
      tenant.updatePermissions({ multiUserEnabled: false });
      const useCase = new InviteTeamMemberUseCase(userRepo, tenantRepo, eventRepo, emailClient);

      await expect(
        useCase.execute({
          sellerId: "3680586616",
          name: "Lucas Vendedor",
          email: "lucas@demo.com",
        })
      ).rejects.toThrow("La funcionalidad de colaboradores multi-usuario no está habilitada");
    });

    it("should reject invitation if email is already taken", async () => {
      tenant.updatePermissions({ multiUserEnabled: true });
      const useCase = new InviteTeamMemberUseCase(userRepo, tenantRepo, eventRepo, emailClient);

      await expect(
        useCase.execute({
          sellerId: "3680586616",
          name: "Otro Juan",
          email: "owner@demo.com",
        })
      ).rejects.toThrow("Ya existe un usuario registrado con este correo");
    });

    it("should create pending user and dispatch invitation email when permission is active", async () => {
      tenant.updatePermissions({ multiUserEnabled: true });
      const useCase = new InviteTeamMemberUseCase(userRepo, tenantRepo, eventRepo, emailClient);

      const res = await useCase.execute({
        sellerId: "3680586616",
        name: "Lucas Vendedor",
        email: "lucas@demo.com",
        originUrl: "http://localhost:5173",
      });

      expect(res.userId).toBeDefined();
      expect(res.activationUrl).toContain("http://localhost:5173/activate/");
      expect(emailClient.sendTenantInvitation).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "lucas@demo.com",
          name: "Lucas Vendedor",
        })
      );
      expect(users.size).toBe(2);
      expect(eventRepo.log).toHaveBeenCalled();
    });
  });

  describe("RemoveTeamMemberUseCase", () => {
    it("should reject removing oneself", async () => {
      const useCase = new RemoveTeamMemberUseCase(userRepo, tenantRepo, eventRepo);

      await expect(
        useCase.execute({
          sellerId: "3680586616",
          memberId: "usr_owner",
          requesterUserId: "usr_owner",
        })
      ).rejects.toThrow("No podés eliminar tu propia cuenta");
    });

    it("should remove collaborator successfully", async () => {
      const collaborator = new User({
        id: "usr_collab",
        email: "collab@demo.com",
        passwordHash: "hash456",
        name: "Carlos Vendedor",
        role: "tenant",
        sellerId: "3680586616",
        status: "active",
      });
      users.set(collaborator.id, collaborator);

      const useCase = new RemoveTeamMemberUseCase(userRepo, tenantRepo, eventRepo);
      const res = await useCase.execute({
        sellerId: "3680586616",
        memberId: "usr_collab",
        requesterUserId: "usr_owner",
      });

      expect(res.ok).toBe(true);
      expect(users.has("usr_collab")).toBe(false);
      expect(eventRepo.log).toHaveBeenCalled();
    });
  });
});
