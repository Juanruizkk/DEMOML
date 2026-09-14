import crypto from "node:crypto";
import { IUserRepository } from "../../interfaces/IUserRepository.js";
import { User } from "../../../domain/entities/User.js";

export interface CreateTenantDTO {
  name: string;
  email: string;
}

export interface CreateTenantResult {
  userId: string;
  activationToken: string;
}

export class CreateTenantUseCase {
  constructor(private readonly userRepo: IUserRepository) {}

  public async execute(dto: CreateTenantDTO): Promise<CreateTenantResult> {
    const existing = await this.userRepo.findByEmail(dto.email);
    if (existing) {
      throw new Error("Ya existe un usuario registrado con este correo electrónico.");
    }

    const userId = crypto.randomUUID();
    const activationToken = crypto.randomBytes(32).toString("hex");
    const placeholderHash = crypto.randomBytes(32).toString("hex");

    const user = new User({
      id: userId,
      email: dto.email,
      passwordHash: placeholderHash,
      name: dto.name,
      role: "tenant",
      status: "pending",
      activationToken,
    });

    await this.userRepo.save(user);

    return { userId, activationToken };
  }
}
