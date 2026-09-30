import "dotenv/config";
import { db } from "../src/infrastructure/persistence/drizzle/db.js";
import { tenants } from "../src/infrastructure/persistence/drizzle/schema.js";

async function main() {
  const tenantList = await db.select().from(tenants);
  const tenant = tenantList[0];

  // Let's create a custom standalone item (NOT catalog listing)
  // To avoid GTIN requirements or catalog competition, we can use:
  // - buying_mode: "buy_it_now"
  // - listing_type_id: "gold_special" or "gold_pro"
  // - condition: "new"
  // - attributes with GTIN: "EMPTY" or "N/A" if needed or valid category
  
  const customItem = {
    title: "Item Exclusivo Test Bot IA " + Date.now().toString().slice(-4),
    category_id: "MLA3530", // Otro tipo de articulo / Bazar / Varios
    price: 15000,
    currency_id: "ARS",
    available_quantity: 50,
    buying_mode: "buy_it_now",
    listing_type_id: "gold_special",
    condition: "new",
    pictures: [
      { source: "https://http2.mlstatic.com/D_NQ_NP_891618-MLA80207590953_102024-F.jpg" }
    ],
    attributes: [
      { id: "BRAND", value_name: "Genérica" },
      { id: "MODEL", value_name: "Demo IA 2026" },
      { id: "ITEM_CONDITION", value_name: "Nuevo" }
    ]
  };

  console.log("Creando publicación estándar directa...");
  const res = await fetch("https://api.mercadolibre.com/items", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${tenant.accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(customItem)
  });

  const data = await res.json();
  console.log("Respuesta:", JSON.stringify(data, null, 2));
}

main().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
