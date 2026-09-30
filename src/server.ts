import "dotenv/config";
import { buildApp } from "./app.js";
import { buildContainer } from "./composition/container.js";

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || "0.0.0.0";

const container = buildContainer();
const app = buildApp(container);

// Efectos de arranque: seeds y poller viven acá para que buildApp sea puro en tests
container.runStartupSeeds().catch((err) => app.log.error(err, "Error en seeds de arranque"));
container.startBackgroundJobs();

try {
  await app.listen({ port: PORT, host: HOST });
  console.log(`\n🚀 [Clean Architecture] MELI AI Assistant corriendo en http://localhost:${PORT}`);
  console.log(`   Panel:            http://localhost:${PORT}`);
  console.log(`   OAuth login:      http://localhost:${PORT}/oauth/login`);
  console.log(`   Health check:     http://localhost:${PORT}/api/health\n`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
