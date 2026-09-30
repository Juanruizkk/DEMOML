import "dotenv/config";
import { db } from "../src/infrastructure/persistence/drizzle/db.js";
import { tenants } from "../src/infrastructure/persistence/drizzle/schema.js";

async function createTestUser(token: string, role: string) {
  console.log(`⏳ Creando usuario de prueba (${role})...`);
  const res = await fetch("https://api.mercadolibre.com/users/test_user", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ site_id: "MLA" }),
  });

  const data = await res.json();
  if (!res.ok) {
    console.error(`❌ Error al crear usuario ${role}:`, data);
    return null;
  }
  return data;
}

function formatPasswordBreakdown(pwd: string): string {
  return pwd
    .split("")
    .map((c, i) => {
      let desc = c;
      if (c >= "A" && c <= "Z") desc += ` (Mayúscula ${c})`;
      else if (c >= "a" && c <= "z") desc += ` (minúscula ${c})`;
      else if (c >= "0" && c <= "9") desc += ` (Número ${c})`;
      return `   [${i + 1}] ${desc}`;
    })
    .join("\n");
}

async function main() {
  const tenantList = await db.select().from(tenants);
  if (!tenantList.length) {
    console.error("❌ No se encontraron tenants en la base de datos para obtener un access token.");
    process.exit(1);
  }

  const activeTenant = tenantList[0];
  console.log(`🔑 Usando access_token de: ${activeTenant.nickname || activeTenant.email || activeTenant.sellerId}\n`);

  const seller = await createTestUser(activeTenant.accessToken, "VENDEDOR / SELLER");
  const buyer = await createTestUser(activeTenant.accessToken, "COMPRADOR / BUYER");

  console.log("\n=======================================================");
  console.log("   ✅ NUEVOS USUARIOS DE TEST GENERADOS EN MERCADO LIBRE ");
  console.log("=======================================================");
  if (seller) {
    console.log("📦 VENDEDOR (SELLER):");
    console.log(`   - ID:       ${seller.id}`);
    console.log(`   - Nickname: ${seller.nickname}`);
    console.log(`   - Email:    ${seller.email}`);
    console.log(`   - Password: ${seller.password}`);
    console.log("   Desglose de contraseña:");
    console.log(formatPasswordBreakdown(seller.password));
    console.log("");
  }
  if (buyer) {
    console.log("🛒 COMPRADOR (BUYER):");
    console.log(`   - ID:       ${buyer.id}`);
    console.log(`   - Nickname: ${buyer.nickname}`);
    console.log(`   - Email:    ${buyer.email}`);
    console.log(`   - Password: ${buyer.password}`);
    console.log("   Desglose de contraseña:");
    console.log(formatPasswordBreakdown(buyer.password));
    console.log("");
  }
  console.log("=======================================================");
  console.log("💡 Para iniciar sesión:");
  console.log("   1. Abrí una ventana de incógnito en https://www.mercadolibre.com.ar");
  console.log("   2. Ingresá el Nickname o Email correspondiente");
  console.log("   3. Ingresá la contraseña exacta generada arriba\n");

  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Error inesperado:", err);
  process.exit(1);
});
