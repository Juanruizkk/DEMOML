import "dotenv/config";
import { db } from "../src/infrastructure/persistence/drizzle/db.js";
import { tenants } from "../src/infrastructure/persistence/drizzle/schema.js";

const itemsToPublish = [
  {
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
    shipping: { mode: "me2", local_pick_up: true, free_shipping: false },
    attributes: [
      { id: "BRAND", value_name: "Lumilagro" },
      { id: "MODEL", value_name: "Luminox" },
      { id: "ITEM_CONDITION", value_name: "Nuevo" },
      { id: "GTIN", value_name: "7790001001016" },
      { id: "THERMO_CAPACITY", value_name: "1 L" }
    ]
  },
  {
    title: "Teclado Mecanico Gamer Redragon K552 Switch Blue",
    category_id: "MLA418448",
    price: 52000,
    currency_id: "ARS",
    available_quantity: 20,
    buying_mode: "buy_it_now",
    listing_type_id: "gold_special",
    condition: "new",
    pictures: [
      { source: "https://http2.mlstatic.com/D_NQ_NP_679404-MLU70095103493_062023-F.jpg" }
    ],
    shipping: { mode: "me2", local_pick_up: true, free_shipping: false },
    attributes: [
      { id: "BRAND", value_name: "Redragon" },
      { id: "MODEL", value_name: "Kumara K552" },
      { id: "ITEM_CONDITION", value_name: "Nuevo" },
      { id: "GTIN", value_name: "6950376783998" },
      { id: "KEYBOARD_LAYOUT", value_name: "QWERTY" },
      { id: "KEYBOARD_LANGUAGE", value_name: "Español Latinoamérica" }
    ]
  },
  {
    title: "Cafetera Espresso Oster Prima Latte Roja 19 Bares",
    category_id: "MLA4340",
    price: 185000,
    currency_id: "ARS",
    available_quantity: 10,
    buying_mode: "buy_it_now",
    listing_type_id: "gold_special",
    condition: "new",
    pictures: [
      { source: "https://http2.mlstatic.com/D_NQ_NP_666063-MLC48036390275_102021-F.jpg" }
    ],
    shipping: { mode: "me2", local_pick_up: true, free_shipping: false },
    attributes: [
      { id: "BRAND", value_name: "Oster" },
      { id: "MODEL", value_name: "Prima Latte" },
      { id: "ITEM_CONDITION", value_name: "Nuevo" },
      { id: "GTIN", value_name: "053891107563" },
      { id: "POWER", value_name: "1050 W" },
      { id: "COFFEE_MAKER_TYPE", value_name: "Espresso" },
      { id: "POWER_SUPPLY_TYPE", value_name: "Corriente directa" }
    ]
  }
];

async function main() {
  const tenantList = await db.select().from(tenants);
  const tenant = tenantList[0];

  console.log(`🏪 Publicando en cuenta: ${tenant.sellerId} (${tenant.nickname || tenant.email})\n`);
  for (const item of itemsToPublish) {
    try {
      const res = await fetch("https://api.mercadolibre.com/items", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tenant.accessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(item)
      });
      const data = await res.json();
      if (res.status === 201 || res.ok) {
        console.log(`✅ [${data.id}] ${data.title} -> STATUS: ${data.status}`);
        console.log(`   🔗 ${data.permalink}\n`);
      } else {
        console.error(`❌ Error en "${item.title}":`, JSON.stringify(data));
      }
    } catch (err) {
      console.error("Error:", err);
    }
  }
}

main().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
