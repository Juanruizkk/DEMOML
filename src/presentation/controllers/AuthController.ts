import { FastifyRequest, FastifyReply } from "fastify";
import { IMeliClient } from "../../application/interfaces/IMeliClient.js";
import { ITenantRepository } from "../../application/interfaces/ITenantRepository.js";
import { IUserRepository } from "../../application/interfaces/IUserRepository.js";
import { RegisterUserUseCase, RegisterUserDTO } from "../../application/use-cases/auth/RegisterUserUseCase.js";
import { LoginUserUseCase, LoginUserDTO } from "../../application/use-cases/auth/LoginUserUseCase.js";
import { GetCurrentUserUseCase } from "../../application/use-cases/auth/GetCurrentUserUseCase.js";
import { Tenant } from "../../domain/entities/Tenant.js";

export class AuthController {
  constructor(
    private readonly meliClient: IMeliClient,
    private readonly tenantRepo: ITenantRepository,
    private readonly userRepo: IUserRepository,
    private readonly registerUseCase: RegisterUserUseCase,
    private readonly loginUseCase: LoginUserUseCase,
    private readonly getCurrentUserUseCase: GetCurrentUserUseCase
  ) {}

  public register = async (
    request: FastifyRequest<{ Body: RegisterUserDTO }>,
    reply: FastifyReply
  ) => {
    try {
      const response = await this.registerUseCase.execute(request.body);
      return reply.status(201).send(response);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  };

  public login = async (
    request: FastifyRequest<{ Body: LoginUserDTO }>,
    reply: FastifyReply
  ) => {
    try {
      const response = await this.loginUseCase.execute(request.body);
      return reply.send(response);
    } catch (err: any) {
      return reply.status(401).send({ error: err.message });
    }
  };

  public getMe = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user;
    if (!user || !user.userId) {
      return reply.status(401).send({ error: "No autenticado." });
    }

    try {
      const profile = await this.getCurrentUserUseCase.execute(user.userId);
      return reply.send(profile);
    } catch (err: any) {
      return reply.status(404).send({ error: err.message });
    }
  };

  public meliOAuthLogin = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user;
    const stateParam = user?.userId ? `&state=${encodeURIComponent(user.userId)}` : "";
    const url = `https://auth.mercadolibre.com.ar/authorization?response_type=code&client_id=${process.env.ML_CLIENT_ID}&redirect_uri=${encodeURIComponent(process.env.ML_REDIRECT_URI || "")}${stateParam}`;
    return reply.redirect(url);
  };

  public meliOAuthCallback = async (
    request: FastifyRequest<{ Querystring: { code?: string; state?: string } }>,
    reply: FastifyReply
  ) => {
    const { code, state } = request.query;
    if (!code) {
      return reply.status(400).send("Falta el parámetro code.");
    }

    try {
      const tokens = await this.meliClient.exchangeCodeForTokens(code);
      const sellerId = String(tokens.user_id);

      let tenant = await this.tenantRepo.findBySellerId(sellerId);
      if (!tenant) {
        tenant = Tenant.createDefault({
          id: sellerId,
          sellerId,
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          expiresInSec: tokens.expires_in,
        });
      } else {
        tenant.updateTokens(tokens.access_token, tokens.refresh_token, tokens.expires_in);
      }

      await this.tenantRepo.save(tenant);

      // Si se pasó el userId en el state, vinculamos el sellerId al usuario
      if (state) {
        const user = await this.userRepo.findById(state);
        if (user) {
          user.linkSeller(sellerId);
          await this.userRepo.save(user);
        }
      }

      return reply.redirect("/?connected=1");
    } catch (err: any) {
      return reply.status(500).send(`Error en el callback OAuth: ${err.message}`);
    }
  };
}
