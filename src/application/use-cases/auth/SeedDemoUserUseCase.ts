import crypto from "node:crypto";
import { IUserRepository } from "../../interfaces/IUserRepository.js";
import { ITenantRepository } from "../../interfaces/ITenantRepository.js";
import { IPasswordHasher } from "../../interfaces/IPasswordHasher.js";
import { User } from "../../../domain/entities/User.js";
import { Tenant } from "../../../domain/entities/Tenant.js";

export class SeedDemoUserUseCase {
  constructor(
    private readonly userRepo: IUserRepository,
    private readonly tenantRepo: ITenantRepository,
    private readonly passwordHasher: IPasswordHasher
  ) {}

  async execute(): Promise<void> {
    const email = process.env.DEMO_EMAIL ?? "demo@melibot.com";
    const password = process.env.DEMO_PASSWORD ?? "Demo123456!";
    const name = process.env.DEMO_NAME ?? "Demo User";
    const sellerId = process.env.DEMO_SELLER_ID ?? "3680586616";
    const accessToken = process.env.DEMO_ACCESS_TOKEN ?? "";

    const existing = await this.userRepo.findByEmail(email);
    if (!existing) {
      const passwordHash = await this.passwordHasher.hash(password);
      const user = new User({
        id: crypto.randomUUID(),
        email,
        passwordHash,
        name,
        role: "demo",
        sellerId,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      await this.userRepo.save(user);
      console.log(`\n🎬 [Auth] Demo user creado: ${email}`);
    }

    // Ensure demo tenant exists
    const existingTenant = await this.tenantRepo.findBySellerId(sellerId);
    if (!existingTenant && accessToken) {
      const tenant = Tenant.createDefault({
        id: crypto.randomUUID(),
        sellerId,
        nickname: process.env.DEMO_SELLER_NICKNAME ?? "TESTUSER4327702539223624795",
        email: "test_user_demo@testuser.com",
        accessToken,
        refreshToken: "",
        expiresInSec: 21600,
      });
      await this.tenantRepo.save(tenant);
      console.log(`\n🎬 [Auth] Demo tenant creado: sellerId=${sellerId}`);
    }
  }
}
