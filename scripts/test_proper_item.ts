import "dotenv/config";
import { db } from "../src/infrastructure/persistence/drizzle/db.js";
import { tenants } from "../src/infrastructure/persistence/drizzle/schema.js";

async function main() {
  const tenantList = await db.select().from(tenants);
  const tenant = tenantList[0];

  // Test creating in true category MLA47769 (Termos) with proper attributes
  const termoPayload = {
    title: "Termo Acero Inox Lumilagro 1L Tapon Cebador",
    category_id: "MLA47769",
    price: 38000,
    currency_id: "ARS",
    available_quantity: 15,
    buying_mode: "buy_it_now",
    listing_type_id: "gold_special",
    condition: "new",
    pictures: [
      { source: "https://http2.mlstatic.com/D_NQ_NP_891618-MLA80207590953_102024-F.jpg" }
    ],
    shipping: {
      mode: "me2",
      local_pick_up: true,
      free_shipping: false
    },
    attributes: [
      { id: "BRAND", value_name: "Lumilagro" },
      { id: "MODEL", value_name: "Luminox" },
      { id: "ITEM_CONDITION", value_name: "Nuevo" },
      { id: "GTIN", value_name: "7790001001016" },
      { id: "THERMO_CAPACITY", value_name: "1 L" }
    ]
  };

  console.log("Probando publicación en categoría correcta con GTIN...");
  const res = await fetch("https://api.mercadolibre.com/items", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${tenant.accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(termoPayload)
  });

  const data = await res.json();
  console.log("Respuesta:", JSON.stringify(data, null, 2));
}

main().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
