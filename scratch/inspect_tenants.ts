import "dotenv/config";
import { db } from "../src/infrastructure/persistence/drizzle/db.js";
import { tenants } from "../src/infrastructure/persistence/drizzle/schema.js";

async function main() {
  try {
    const list = await db.select().from(tenants);
    console.log("=== TENANTS IN DB ===");
    for (const t of list) {
      console.log(`Seller ID: ${t.sellerId}`);
      console.log(`Nickname: ${t.nickname}`);
      console.log(`Email: ${t.email}`);
      console.log(`Access Token: ${t.accessToken?.substring(0, 15)}...`);
      console.log(`Refresh Token: ${t.refreshToken?.substring(0, 15)}...`);
      console.log(`Expires At: ${new Date(Number(t.expiresAt)).toISOString()} (${Number(t.expiresAt)})`);
      console.log("-----------------------------------------");
    }
  } catch (err) {
    console.error("DB Error:", err);
  }
  process.exit(0);
}

main();
