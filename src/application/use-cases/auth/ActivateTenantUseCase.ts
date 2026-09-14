import { IUserRepository } from "../../interfaces/IUserRepository.js";
import { IPasswordHasher } from "../../interfaces/IPasswordHasher.js";
import { ITokenService, UserTokenPayload } from "../../interfaces/ITokenService.js";

export interface ActivateTenantDTO {
  token: string;
  password: string;
}

export interface ActivateResponseDTO {
  token: string;
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
    status: string;
  };
}

export class ActivateTenantUseCase {
  constructor(
    private readonly userRepo: IUserRepository,
    private readonly passwordHasher: IPasswordHasher,
    private readonly tokenService: ITokenService
  ) {}

  public async execute(dto: ActivateTenantDTO): Promise<ActivateResponseDTO> {
    if (!dto.password || dto.password.length < 6) {
      throw new Error("La contraseña debe tener al menos 6 caracteres.");
    }

    const user = await this.userRepo.findByActivationToken(dto.token);
    if (!user) {
      throw new Error("Token de activación inválido o expirado.");
    }

    const passwordHash = await this.passwordHasher.hash(dto.password);
    user.activate(passwordHash);
    await this.userRepo.save(user);

    const tokenPayload: UserTokenPayload = {
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      sellerId: user.sellerId,
    };

    const jwtToken = this.tokenService.generateToken(tokenPayload);

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
