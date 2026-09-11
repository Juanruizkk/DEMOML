import { IUserRepository } from "../../interfaces/IUserRepository.js";
import { IPasswordHasher } from "../../interfaces/IPasswordHasher.js";
import { ITokenService, UserTokenPayload } from "../../interfaces/ITokenService.js";
import { User } from "../../../domain/entities/User.js";
import { UserRoleType } from "../../../domain/value-objects/UserRole.js";
import crypto from "node:crypto";

export interface RegisterUserDTO {
  email: string;
  password: string;
  name: string;
  role?: UserRoleType;
  sellerId?: string;
}

export interface AuthResponseDTO {
  token: string;
  user: {
    id: string;
    email: string;
    name: string;
    role: UserRoleType;
    sellerId?: string | null;
  };
}

export class RegisterUserUseCase {
  constructor(
    private readonly userRepo: IUserRepository,
    private readonly passwordHasher: IPasswordHasher,
    private readonly tokenService: ITokenService
  ) {}

  public async execute(dto: RegisterUserDTO): Promise<AuthResponseDTO> {
    const existing = await this.userRepo.findByEmail(dto.email);
    if (existing) {
      throw new Error("Ya existe un usuario registrado con este correo electrónico.");
    }

    if (!dto.password || dto.password.length < 6) {
      throw new Error("La contraseña debe tener al menos 6 caracteres.");
    }

    const passwordHash = await this.passwordHasher.hash(dto.password);
    const userId = crypto.randomUUID();
    const role: UserRoleType = dto.role || "tenant";

    const user = new User({
      id: userId,
      email: dto.email,
      passwordHash,
      name: dto.name,
      role,
      sellerId: dto.sellerId,
    });

    await this.userRepo.save(user);

    const tokenPayload: UserTokenPayload = {
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      sellerId: user.sellerId,
    };

    const token = this.tokenService.generateToken(tokenPayload);

    return {
      token,
      user: user.toJSON(),
    };
  }
}
