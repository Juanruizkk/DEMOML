import "dotenv/config";
import { db } from "../src/infrastructure/persistence/drizzle/db.js";
import { tenants } from "../src/infrastructure/persistence/drizzle/schema.js";

async function createTestUser(token: string, role: string) {
  console.log(`\nCreando usuario de prueba: ${role}...`);
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
    console.error(`Error al crear usuario ${role}:`, data);
    return null;
  }
  return data;
}

async function main() {
  const tenantList = await db.select().from(tenants);
  if (!tenantList.length) {
    console.error("No se encontraron tenants en la base de datos.");
    process.exit(1);
  }

  const activeTenant = tenantList[0];
  console.log(`Usando access_token del tenant ${activeTenant.sellerId} (${activeTenant.nickname || activeTenant.email})...`);

  // Crear Vendedor
  const seller = await createTestUser(activeTenant.accessToken, "VENDEDOR (SELLER)");
  // Crear Comprador
  const buyer = await createTestUser(activeTenant.accessToken, "COMPRADOR (BUYER)");

  console.log("\n==========================================");
  console.log("       NUEVOS USUARIOS DE TEST MELI       ");
  console.log("==========================================");
  console.log("VENDEDOR (SELLER):", JSON.stringify(seller, null, 2));
  console.log("\nCOMPRADOR (BUYER):", JSON.stringify(buyer, null, 2));
  console.log("==========================================\n");

  process.exit(0);
}

main().catch(err => {
  console.error("Error fatal:", err);
  process.exit(1);
});
