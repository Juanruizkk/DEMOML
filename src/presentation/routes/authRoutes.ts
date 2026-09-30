import { FastifyInstance } from "fastify";
import { Container } from "../../composition/container.js";
import { AuthGuards } from "../middleware/auth.js";

const AUTH_RATE = { max: 10, timeWindow: "1 minute" };
const RESET_RATE = { max: 3, timeWindow: "1 hour" };

export function registerAuthRoutes(app: FastifyInstance, c: Container, guards: AuthGuards) {
  const { authCtrl } = c;
  const { authenticate } = guards;

  // Públicas con rate limit
  app.post("/api/auth/register", { config: { rateLimit: AUTH_RATE } }, authCtrl.register);
  app.post("/api/auth/login", { config: { rateLimit: AUTH_RATE } }, authCtrl.login);
  app.post("/api/auth/forgot-password", { config: { rateLimit: RESET_RATE } }, authCtrl.forgotPassword);
  app.post("/api/auth/reset-password/:token", { config: { rateLimit: RESET_RATE } }, authCtrl.resetPassword);
  app.post("/api/auth/activate/:token", { config: { rateLimit: AUTH_RATE } }, authCtrl.activateTenant);

  // Requieren token
  app.get("/api/auth/me", { preHandler: authenticate }, authCtrl.getMe);
  app.get("/api/auth/onboarding-status", { preHandler: authenticate }, authCtrl.getOnboardingStatus);
  app.get("/api/auth/meli-auth-url", { preHandler: authenticate }, authCtrl.getMeliAuthUrl);

  // OAuth Mercado Libre
  app.get("/oauth/login", { preHandler: authenticate }, authCtrl.meliOAuthLogin);
  app.get("/oauth/callback", authCtrl.meliOAuthCallback);
}
