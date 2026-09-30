import { FastifyInstance } from "fastify";
import { Container } from "../../composition/container.js";
import { AuthGuards } from "../middleware/auth.js";

export function registerDemoRoutes(app: FastifyInstance, c: Container, guards: AuthGuards) {
  const { demoCtrl, simulatorCtrl } = c;
  const { authenticate, requireDemo } = guards;

  app.post("/api/demo/seed", { preHandler: requireDemo }, demoCtrl.seed);
  app.post("/api/simulate-question", { preHandler: authenticate }, simulatorCtrl.simulate as any);
}
