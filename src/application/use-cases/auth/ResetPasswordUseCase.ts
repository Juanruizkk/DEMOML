// src/application/use-cases/auth/ResetPasswordUseCase.ts
import { IUserRepository } from "../../interfaces/IUserRepository.js";
import { IPasswordHasher } from "../../interfaces/IPasswordHasher.js";
import { ITokenService, UserTokenPayload } from "../../interfaces/ITokenService.js";

export interface ResetPasswordDTO {
  token: string;
  password: string;
}

export interface ResetPasswordResponseDTO {
  token: string;
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
    status: string;
  };
}

export class ResetPasswordUseCase {
  constructor(
    private readonly userRepo: IUserRepository,
    private readonly passwordHasher: IPasswordHasher,
    private readonly tokenService: ITokenService
  ) {}

  public async execute(dto: ResetPasswordDTO): Promise<ResetPasswordResponseDTO> {
    const user = await this.userRepo.findByActivationToken(dto.token);

    if (!user) {
      throw new Error("Token inválido o expirado.");
    }

    const parts = dto.token.split("|");
    const expiresAt = parts.length === 2 ? Number(parts[1]) : 0;

    if (Date.now() > expiresAt) {
      user.activationToken = null;
      user.updatedAt = new Date();
      await this.userRepo.save(user);
      throw new Error("El link expiró. Solicitá uno nuevo.");
    }

    if (!dto.password || dto.password.length < 6) {
      throw new Error("La contraseña debe tener al menos 6 caracteres.");
    }

    const passwordHash = await this.passwordHasher.hash(dto.password);
    user.activate(passwordHash);
    await this.userRepo.save(user);

    const payload: UserTokenPayload = {
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      sellerId: user.sellerId,
    };
    const jwtToken = this.tokenService.generateToken(payload);

    return {
      token: jwtToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        status: user.status,
      },
    };
  }
}
