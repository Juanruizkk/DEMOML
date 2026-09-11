import { IUserRepository } from "../../interfaces/IUserRepository.js";
import { IPasswordHasher } from "../../interfaces/IPasswordHasher.js";
import { ITokenService, UserTokenPayload } from "../../interfaces/ITokenService.js";
import { AuthResponseDTO } from "./RegisterUserUseCase.js";

export interface LoginUserDTO {
  email: string;
  password: string;
}

export class LoginUserUseCase {
  constructor(
    private readonly userRepo: IUserRepository,
    private readonly passwordHasher: IPasswordHasher,
    private readonly tokenService: ITokenService
  ) {}

  public async execute(dto: LoginUserDTO): Promise<AuthResponseDTO> {
    if (!dto.email || !dto.password) {
      throw new Error("Email y contraseña son obligatorios.");
    }

    const user = await this.userRepo.findByEmail(dto.email);
    if (!user) {
      throw new Error("Credenciales inválidas.");
    }

    const isValidPassword = await this.passwordHasher.compare(dto.password, user.passwordHash);
    if (!isValidPassword) {
      throw new Error("Credenciales inválidas.");
    }

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
