import { IUserRepository } from "../../interfaces/IUserRepository.js";
import { ITenantRepository } from "../../interfaces/ITenantRepository.js";

export interface OnboardingStatusDTO {
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
    sellerId: string | null;
  };
  isMeliConnected: boolean;
  tenant?: {
    sellerId: string;
    nickname?: string;
    email?: string;
    tokenHealth: "healthy" | "expiring_soon" | "expired";
    autoAnswerEnabled: boolean;
    confidenceThreshold: number;
    tone: string;
  };
  meliAuthUrl: string;
}

export class GetOnboardingStatusUseCase {
  constructor(
    private readonly userRepo: IUserRepository,
    private readonly tenantRepo: ITenantRepository
  ) {}

  public async execute(userId: string): Promise<OnboardingStatusDTO> {
    const user = await this.userRepo.findById(userId);
    if (!user) {
      throw new Error("Usuario no encontrado.");
    }

    const stateParam = `&state=${encodeURIComponent(user.id)}`;
    const meliAuthUrl = `https://auth.mercadolibre.com.ar/authorization?response_type=code&client_id=${process.env.ML_CLIENT_ID || ""}&redirect_uri=${encodeURIComponent(process.env.ML_REDIRECT_URI || "")}${stateParam}`;

    if (!user.sellerId) {
      return {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          sellerId: null,
        },
        isMeliConnected: false,
        meliAuthUrl,
      };
    }

    const tenant = await this.tenantRepo.findBySellerId(user.sellerId);
    if (!tenant) {
      return {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          sellerId: user.sellerId,
        },
        isMeliConnected: false,
        meliAuthUrl,
      };
    }

    let tokenHealth: "healthy" | "expiring_soon" | "expired" = "healthy";
    const remainingMs = tenant.expiresAt - Date.now();
    if (remainingMs <= 0) {
      tokenHealth = "expired";
    } else if (remainingMs < 15 * 60 * 1000) {
      tokenHealth = "expiring_soon";
    }

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        sellerId: user.sellerId,
      },
      isMeliConnected: true,
      tenant: {
        sellerId: tenant.sellerId,
        nickname: tenant.nickname,
        email: tenant.email,
        tokenHealth,
        autoAnswerEnabled: tenant.settings.autoAnswerEnabled,
        confidenceThreshold: tenant.settings.confidenceThreshold,
        tone: tenant.settings.tone,
      },
      meliAuthUrl,
    };
  }
}
