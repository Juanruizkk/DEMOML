import crypto from "crypto";
import { IUserRepository } from "../../interfaces/IUserRepository.js";
import { IEmailClient } from "../../interfaces/IEmailClient.js";

export interface RequestPasswordResetDTO {
  email: string;
  baseUrl?: string;
}

export class RequestPasswordResetUseCase {
  constructor(
    private readonly userRepo: IUserRepository,
    private readonly emailClient: IEmailClient
  ) {}

  public async execute(dto: RequestPasswordResetDTO): Promise<{ ok: true }> {
    const user = await this.userRepo.findByEmail(dto.email);

    if (!user) {
      return { ok: true };
    }

    const hex = crypto.randomBytes(32).toString("hex");
    const expiresAt = Date.now() + 60 * 60 * 1000; // 1 hora
    const token = `${hex}|${expiresAt}`;

    user.setResetToken(token);
    await this.userRepo.save(user);

    const baseUrl = dto.baseUrl || process.env.APP_BASE_URL || "http://localhost:5173";
    const resetUrl = `${baseUrl}/reset-password/${token}`;

    await this.emailClient
      .sendPasswordReset({
        to: user.email,
        name: user.name,
        resetUrl,
        expiresInMinutes: 60,
      })
      .catch((err) => console.error("[RequestPasswordResetUseCase] Error enviando email:", err));

    return { ok: true };
  }
}
