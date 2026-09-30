import "dotenv/config";
import { db } from "../src/infrastructure/persistence/drizzle/db.js";
import { tenants } from "../src/infrastructure/persistence/drizzle/schema.js";

async function main() {
  const tenantList = await db.select().from(tenants);
  const tenant = tenantList[0];

  const searchRes = await fetch(`https://api.mercadolibre.com/users/${tenant.sellerId}/items/search`, {
    headers: { Authorization: `Bearer ${tenant.accessToken}` },
  });
  const searchData = await searchRes.json();
  const itemIds: string[] = searchData.results || [];

  console.log(`Total items para ${tenant.sellerId}: ${itemIds.length}`);
  for (const id of itemIds) {
    const res = await fetch(`https://api.mercadolibre.com/items/${id}`, {
      headers: { Authorization: `Bearer ${tenant.accessToken}` },
    });
    const item = await res.json();
    console.log(`- [${item.id}] Status: ${item.status} | SubStatus: ${JSON.stringify(item.sub_status)} | Title: ${item.title}`);
  }
}

main().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
