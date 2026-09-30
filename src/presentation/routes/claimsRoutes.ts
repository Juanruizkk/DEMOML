import { FastifyInstance } from "fastify";
import { Container } from "../../composition/container.js";
import { AuthGuards } from "../middleware/auth.js";

export function registerClaimsRoutes(app: FastifyInstance, c: Container, guards: AuthGuards) {
  const { claimsCtrl } = c;
  const { authenticate } = guards;

  app.get("/api/claims", { preHandler: authenticate }, claimsCtrl.getClaims);
  app.post("/api/claims/simulate", { preHandler: authenticate }, claimsCtrl.simulate as any);
  app.post("/api/claims/:id/ack", { preHandler: authenticate }, claimsCtrl.acknowledge);
  app.post("/api/claims/:id/unack", { preHandler: authenticate }, claimsCtrl.unacknowledge);
  app.post("/api/claims/:id/close", { preHandler: authenticate }, claimsCtrl.closeClaim);
  app.post("/api/claims/:id/reopen", { preHandler: authenticate }, claimsCtrl.reopenClaim);
}
