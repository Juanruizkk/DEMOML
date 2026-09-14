import { FastifyRequest, FastifyReply } from "fastify";
import { RegisterUserUseCase, RegisterUserDTO } from "../../application/use-cases/auth/RegisterUserUseCase.js";
import { LoginUserUseCase, LoginUserDTO } from "../../application/use-cases/auth/LoginUserUseCase.js";
import { GetCurrentUserUseCase } from "../../application/use-cases/auth/GetCurrentUserUseCase.js";
import { ConnectMeliAccountUseCase } from "../../application/use-cases/auth/ConnectMeliAccountUseCase.js";
import { GetOnboardingStatusUseCase } from "../../application/use-cases/auth/GetOnboardingStatusUseCase.js";
import { ActivateTenantUseCase } from "../../application/use-cases/auth/ActivateTenantUseCase.js";
import { RequestPasswordResetUseCase } from "../../application/use-cases/auth/RequestPasswordResetUseCase.js";
import { ResetPasswordUseCase } from "../../application/use-cases/auth/ResetPasswordUseCase.js";
import { ITokenService } from "../../application/interfaces/ITokenService.js";

export class AuthController {
  constructor(
    private readonly registerUseCase: RegisterUserUseCase,
    private readonly loginUseCase: LoginUserUseCase,
    private readonly getCurrentUserUseCase: GetCurrentUserUseCase,
    private readonly connectMeliUseCase: ConnectMeliAccountUseCase,
    private readonly getOnboardingStatusUseCase: GetOnboardingStatusUseCase,
    private readonly tokenService: ITokenService,
    private readonly activateTenantUseCase: ActivateTenantUseCase,
    private readonly requestPasswordResetUseCase: RequestPasswordResetUseCase,
    private readonly resetPasswordUseCase: ResetPasswordUseCase
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

  public getOnboardingStatus = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user;
    if (!user || !user.userId) {
      return reply.status(401).send({ error: "No autenticado." });
    }
    try {
      const status = await this.getOnboardingStatusUseCase.execute(user.userId);
      return reply.send(status);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  };

  public getMeliAuthUrl = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user;
    const userId = user?.userId;
    const stateParam = userId ? `&state=${encodeURIComponent(userId)}` : "";
    const url = `https://auth.mercadolibre.com.ar/authorization?response_type=code&client_id=${process.env.ML_CLIENT_ID || ""}&redirect_uri=${encodeURIComponent(process.env.ML_REDIRECT_URI || "")}${stateParam}`;
    return reply.send({ url });
  };

  public meliOAuthLogin = async (request: FastifyRequest, reply: FastifyReply) => {
    const query = (request.query as { token?: string; userId?: string }) || {};
    let userId = (request as any).user?.userId || query.userId;
    if (!userId && query.token) {
      try {
        const payload = this.tokenService.verifyToken(query.token);
        userId = payload.userId;
      } catch (e) {
        // ignore invalid token
      }
    }
    const stateParam = userId ? `&state=${encodeURIComponent(userId)}` : "";
    const url = `https://auth.mercadolibre.com.ar/authorization?response_type=code&client_id=${process.env.ML_CLIENT_ID || ""}&redirect_uri=${encodeURIComponent(process.env.ML_REDIRECT_URI || "")}${stateParam}`;
    return reply.redirect(url);
  };

  public meliOAuthCallback = async (request: FastifyRequest, reply: FastifyReply) => {
    const query = (request.query as { code?: string; state?: string }) || {};
    const { code, state } = query;
    if (!code) {
      return reply.status(400).send("Falta el parámetro code.");
    }
    try {
      const result = await this.connectMeliUseCase.execute({ code, userId: state });
      const tokenParam = result.token ? `&token=${encodeURIComponent(result.token)}` : "";
      const nicknameParam = `&nickname=${encodeURIComponent(result.nickname)}`;
      const sellerIdParam = `&sellerId=${encodeURIComponent(result.sellerId)}`;
      return reply.redirect(`/onboarding.html?status=connected${sellerIdParam}${nicknameParam}${tokenParam}`);
    } catch (err: any) {
      return reply.redirect(`/onboarding.html?status=error&error=${encodeURIComponent(err.message)}`);
    }
  };

  public activateTenant = async (request: FastifyRequest, reply: FastifyReply) => {
    const { token } = request.params as { token: string };
    const { password } = request.body as { password: string };
    try {
      const result = await this.activateTenantUseCase.execute({ token, password });
      return reply.send(result);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  };

  public forgotPassword = async (request: FastifyRequest, reply: FastifyReply) => {
    const { email } = (request.body as { email?: string }) || {};
    if (!email) {
      return reply.status(400).send({ error: "El campo email es requerido." });
    }
    const origin = request.headers.origin || process.env.APP_BASE_URL || "http://localhost:5173";
    await this.requestPasswordResetUseCase
      .execute({ email, baseUrl: origin as string })
      .catch((err) => console.error("[AuthController.forgotPassword]", err));
    return reply.send({ ok: true });
  };

  public resetPassword = async (request: FastifyRequest, reply: FastifyReply) => {
    const { token } = request.params as { token: string };
    const { password } = (request.body as { password?: string }) || {};
    if (!password) {
      return reply.status(400).send({ error: "El campo password es requerido." });
    }
    try {
      const result = await this.resetPasswordUseCase.execute({ token, password });
      return reply.send(result);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  };
}
