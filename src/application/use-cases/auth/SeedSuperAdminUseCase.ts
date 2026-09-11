import { IUserRepository } from "../../interfaces/IUserRepository.js";
import { IPasswordHasher } from "../../interfaces/IPasswordHasher.js";
import { User } from "../../../domain/entities/User.js";
import crypto from "node:crypto";

export class SeedSuperAdminUseCase {
  constructor(
    private readonly userRepo: IUserRepository,
    private readonly passwordHasher: IPasswordHasher
  ) {}

  public async execute(): Promise<void> {
    const adminEmail = process.env.SUPER_ADMIN_EMAIL || "admin@melibot.com";
    const adminPassword = process.env.SUPER_ADMIN_PASSWORD || "Admin123456!";
    const adminName = process.env.SUPER_ADMIN_NAME || "Super Admin";

    const existing = await this.userRepo.findByEmail(adminEmail);
    if (!existing) {
      const passwordHash = await this.passwordHasher.hash(adminPassword);
      const adminUser = new User({
        id: crypto.randomUUID(),
        email: adminEmail,
        passwordHash,
        name: adminName,
        role: "super_admin",
      });

      await this.userRepo.save(adminUser);
      console.log(`\n👑 [Auth] Super Admin inicial creado: ${adminEmail}`);
    }
  }
}
