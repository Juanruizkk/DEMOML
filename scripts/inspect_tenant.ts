import "dotenv/config";
import { db } from "../src/infrastructure/persistence/drizzle/db.js";
import { tenants } from "../src/infrastructure/persistence/drizzle/schema.js";

async function main() {
  const list = await db.select().from(tenants);
  for (const t of list) {
    console.log("-----------------------------------------");
    console.log("Tenant:", t.sellerId, t.nickname, t.email);
    console.log("settingsJson:", JSON.stringify(JSON.parse(t.settingsJson), null, 2));
  }
}

main().then(() => process.exit(0)).catch(e => {
  console.error(e);
  process.exit(1);
});
