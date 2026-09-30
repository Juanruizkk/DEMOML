import crypto from "node:crypto";
import { IUserRepository } from "../../interfaces/IUserRepository.js";
import { ITenantRepository } from "../../interfaces/ITenantRepository.js";
import { IEventRepository } from "../../interfaces/IEventRepository.js";
import { IEmailClient } from "../../interfaces/IEmailClient.js";
import { User } from "../../../domain/entities/User.js";
import { EventLog } from "../../../domain/entities/EventLog.js";

export interface InviteTeamMemberDTO {
  sellerId: string;
  name: string;
  email: string;
  originUrl?: string;
  invitedByUserId?: string;
}

export interface InviteTeamMemberResult {
  userId: string;
  name: string;
  email: string;
  activationUrl: string;
  activationToken: string;
}

export class InviteTeamMemberUseCase {
  constructor(
    private readonly userRepo: IUserRepository,
    private readonly tenantRepo: ITenantRepository,
    private readonly eventRepo: IEventRepository,
    private readonly emailClient?: IEmailClient
  ) {}

  public async execute(dto: InviteTeamMemberDTO): Promise<InviteTeamMemberResult> {
    const tenant = await this.tenantRepo.findBySellerId(dto.sellerId);
    if (!tenant) {
      throw new Error(`Tienda con sellerId ${dto.sellerId} no encontrada.`);
    }

    if (!tenant.effectivePermissions.multiUserEnabled) {
      throw new Error("La funcionalidad de colaboradores multi-usuario no está habilitada para esta tienda.");
    }

    const normalizedEmail = dto.email.toLowerCase().trim();
    const existing = await this.userRepo.findByEmail(normalizedEmail);
    if (existing) {
      throw new Error("Ya existe un usuario registrado con este correo electrónico.");
    }

    const userId = crypto.randomUUID();
    const activationToken = crypto.randomBytes(32).toString("hex");
    const placeholderHash = crypto.randomBytes(32).toString("hex");

    const user = new User({
      id: userId,
      email: normalizedEmail,
      passwordHash: placeholderHash,
      name: dto.name.trim(),
      role: "tenant",
      sellerId: dto.sellerId,
      status: "pending",
      activationToken,
    });

    await this.userRepo.save(user);

    const baseUrl = dto.originUrl || process.env.APP_BASE_URL || "http://localhost:5173";
    const activationUrl = `${baseUrl.replace(/\/$/, "")}/activate/${activationToken}`;

    // Despacho de email de invitación con Resend si está disponible
    if (this.emailClient) {
      try {
        await this.emailClient.sendTenantInvitation({
          to: user.email,
          name: user.name,
          activationUrl,
        });
      } catch (err) {
        console.error("⚠️ [InviteTeamMemberUseCase] Error enviando email de invitación:", err);
      }
    }

    // Registrar evento de auditoría
    await this.eventRepo.log(
      new EventLog({
        sellerId: dto.sellerId,
        type: "TEAM_MEMBER_INVITED",
        message: `👥 Nuevo colaborador invitado: ${user.name} (${user.email}).`,
      })
    );

    return {
      userId,
      name: user.name,
      email: user.email,
      activationUrl,
      activationToken,
    };
  }
}
