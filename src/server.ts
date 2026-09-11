import "dotenv/config";
import { buildApp } from "./app.js";

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || "0.0.0.0";

const app = buildApp();

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
