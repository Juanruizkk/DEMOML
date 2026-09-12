import { IMeliClient } from "../../interfaces/IMeliClient.js";
import { ITenantRepository } from "../../interfaces/ITenantRepository.js";
import { IUserRepository } from "../../interfaces/IUserRepository.js";
import { IEventRepository } from "../../interfaces/IEventRepository.js";
import { ITokenService } from "../../interfaces/ITokenService.js";
import { Tenant } from "../../../domain/entities/Tenant.js";
import { EventLog } from "../../../domain/entities/EventLog.js";

export interface ConnectMeliAccountDTO {
  code: string;
  userId?: string;
}

export interface ConnectMeliAccountResult {
  sellerId: string;
  nickname: string;
  email?: string;
  user?: {
    id: string;
    email: string;
    name: string;
    role: string;
    sellerId: string;
  };
  token?: string;
  isNewTenant: boolean;
}

export class ConnectMeliAccountUseCase {
  constructor(
    private readonly meliClient: IMeliClient,
    private readonly tenantRepo: ITenantRepository,
    private readonly userRepo: IUserRepository,
    private readonly eventRepo: IEventRepository,
    private readonly tokenService: ITokenService
  ) {}

  public async execute(dto: ConnectMeliAccountDTO): Promise<ConnectMeliAccountResult> {
    if (!dto.code) {
      throw new Error("El código de autorización OAuth (code) es obligatorio.");
    }

    // 1. Intercambiar código por tokens de MELI
    const tokens = await this.meliClient.exchangeCodeForTokens(dto.code);
    const sellerId = String(tokens.user_id);

    // 2. Obtener perfil de la tienda (nickname, email)
    const profile = await this.meliClient.getSellerProfile(sellerId, tokens.access_token);
    const nickname = profile.nickname || `Vendedor_${sellerId}`;
    const email = profile.email;

    // 3. Crear o actualizar Tenant
    let isNewTenant = false;
    let tenant = await this.tenantRepo.findBySellerId(sellerId);

    if (!tenant) {
      isNewTenant = true;
      tenant = Tenant.createDefault({
        id: sellerId,
        sellerId,
        nickname,
        email,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresInSec: tokens.expires_in,
      });
    } else {
      tenant.nickname = nickname;
      if (email) tenant.email = email;
      tenant.updateTokens(tokens.access_token, tokens.refresh_token, tokens.expires_in);
    }

    await this.tenantRepo.save(tenant);

    // 4. Vincular al usuario si se proveyó userId en el state
    let userResult: any = undefined;
    let newToken: string | undefined = undefined;

    if (dto.userId) {
      const user = await this.userRepo.findById(dto.userId);
      if (user) {
        user.linkSeller(sellerId);
        await this.userRepo.save(user);

        userResult = {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          sellerId: user.sellerId!,
        };

        // Generar nuevo JWT con el sellerId vinculado
        newToken = this.tokenService.generateToken({
          userId: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          sellerId: user.sellerId || undefined,
        });
      }
    }

    // 5. Registrar evento de auditoría
    await this.eventRepo.log(
      new EventLog({
        sellerId,
        type: "ACCOUNT_CONNECTED",
        message: `Cuenta de Mercado Libre conectada exitosamente para ${nickname} (Seller ID: ${sellerId}).`,
      })
    );

    return {
      sellerId,
      nickname,
      email,
      user: userResult,
      token: newToken,
      isNewTenant,
    };
  }
}
