import { IUserRepository } from "../../interfaces/IUserRepository.js";
import { ITenantRepository } from "../../interfaces/ITenantRepository.js";
import { IEventRepository } from "../../interfaces/IEventRepository.js";
import { EventLog } from "../../../domain/entities/EventLog.js";

export interface RemoveTeamMemberDTO {
  sellerId: string;
  memberId: string;
  requesterUserId?: string;
}

export class RemoveTeamMemberUseCase {
  constructor(
    private readonly userRepo: IUserRepository,
    private readonly tenantRepo: ITenantRepository,
    private readonly eventRepo: IEventRepository
  ) {}

  public async execute(dto: RemoveTeamMemberDTO): Promise<{ ok: boolean; deletedUserId: string }> {
    const tenant = await this.tenantRepo.findBySellerId(dto.sellerId);
    if (!tenant) {
      throw new Error(`Tienda con sellerId ${dto.sellerId} no encontrada.`);
    }

    if (dto.requesterUserId && dto.requesterUserId === dto.memberId) {
      throw new Error("No podés eliminar tu propia cuenta de usuario.");
    }

    const member = await this.userRepo.findById(dto.memberId);
    if (!member) {
      throw new Error("Colaborador no encontrado.");
    }

    if (member.sellerId !== dto.sellerId) {
      throw new Error("El colaborador no pertenece a esta organización.");
    }

    await this.userRepo.delete(dto.memberId);

    // Registrar evento de auditoría
    await this.eventRepo.log(
      new EventLog({
        sellerId: dto.sellerId,
        type: "TEAM_MEMBER_REMOVED",
        message: `🗑️ Colaborador eliminado del equipo: ${member.name} (${member.email}).`,
      })
    );

    return { ok: true, deletedUserId: dto.memberId };
  }
}
