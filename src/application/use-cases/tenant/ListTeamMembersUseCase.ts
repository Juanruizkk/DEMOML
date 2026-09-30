import { IUserRepository } from "../../interfaces/IUserRepository.js";
import { ITenantRepository } from "../../interfaces/ITenantRepository.js";

export interface TeamMemberDTO {
  id: string;
  name: string;
  email: string;
  role: string;
  status: "active" | "pending";
  createdAt: string;
  activationToken?: string | null;
}

export interface ListTeamMembersResult {
  multiUserEnabled: boolean;
  members: TeamMemberDTO[];
}

export class ListTeamMembersUseCase {
  constructor(
    private readonly userRepo: IUserRepository,
    private readonly tenantRepo: ITenantRepository
  ) {}

  public async execute(sellerId: string): Promise<ListTeamMembersResult> {
    const tenant = await this.tenantRepo.findBySellerId(sellerId);
    if (!tenant) {
      throw new Error(`Tienda con sellerId ${sellerId} no encontrada.`);
    }

    const multiUserEnabled = Boolean(tenant.effectivePermissions.multiUserEnabled);
    const users = await this.userRepo.findAllBySellerId(sellerId);

    const members: TeamMemberDTO[] = users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      status: u.status,
      createdAt: u.createdAt.toISOString(),
      activationToken: u.isPending() ? u.activationToken : null,
    }));

    return {
      multiUserEnabled,
      members,
    };
  }
}
