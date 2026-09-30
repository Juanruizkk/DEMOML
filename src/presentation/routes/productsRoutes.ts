import { FastifyInstance } from "fastify";
import { Container } from "../../composition/container.js";
import { AuthGuards } from "../middleware/auth.js";

// Catálogo & Reglas de Conocimiento por Producto
export function registerProductsRoutes(app: FastifyInstance, c: Container, guards: AuthGuards) {
  const { productsCtrl } = c;
  const { authenticate } = guards;

  app.get("/api/tenant/products", { preHandler: authenticate }, productsCtrl.list);
  app.get("/api/tenant/products/:itemId/knowledge", { preHandler: authenticate }, productsCtrl.getKnowledge);
  app.put("/api/tenant/products/:itemId/knowledge", { preHandler: authenticate }, productsCtrl.saveKnowledge);
  app.delete("/api/tenant/products/:itemId/knowledge", { preHandler: authenticate }, productsCtrl.deleteKnowledge);
  app.post("/api/tenant/products/:itemId/simulate", { preHandler: authenticate }, productsCtrl.simulate);
  app.post("/api/tenant/products/:itemId/suggest-faqs", { preHandler: authenticate }, productsCtrl.suggestFaqs);
}
