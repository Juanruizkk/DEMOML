import db from "./db.js";
import { getValidToken } from "./meli-auth.js";

const API_BASE = "https://api.mercadolibre.com";
const ITEM_CACHE_TTL_MS = 5 * 60 * 1000;

async function meliFetch(pathname, options = {}) {
  const token = await getValidToken();
  const res = await fetch(`${API_BASE}${pathname}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  if (!res.ok) {
    const errText = await res.text();
    const err = new Error(`MELI API ${res.status} en ${pathname}: ${errText}`);
    err.status = res.status;
    throw err;
  }

  return res.json();
}

export async function getQuestion(questionId) {
  return meliFetch(`/questions/${questionId}`);
}

export async function getReceivedQuestions() {
  return meliFetch(`/my/received_questions/search?api_version=4`);
}

/** Trae el ítem, usando cache SQLite de 5 minutos para no re-consultar en ráfagas. */
export async function getItemCached(itemId) {
  const cached = db.prepare("SELECT * FROM items_cache WHERE item_id = ?").get(itemId);
  const now = Date.now();

  if (cached && now - cached.cached_at < ITEM_CACHE_TTL_MS) {
    return { ...JSON.parse(cached.payload_json), _fromCache: true };
  }

  const [item, description] = await Promise.all([
    meliFetch(`/items/${itemId}`),
    meliFetch(`/items/${itemId}/description`).catch(() => ({ plain_text: "" })),
  ]);

  const payload = { ...item, description_text: description.plain_text || "" };

  db.prepare(
    `INSERT INTO items_cache (item_id, payload_json, cached_at) VALUES (?, ?, ?)
     ON CONFLICT(item_id) DO UPDATE SET payload_json = excluded.payload_json, cached_at = excluded.cached_at`
  ).run(itemId, JSON.stringify(payload), now);

  return { ...payload, _fromCache: false };
}

export async function postAnswer(questionId, text) {
  return meliFetch(`/answers`, {
    method: "POST",
    body: JSON.stringify({ question_id: Number(questionId), text }),
  });
}

export async function getResponseTime(sellerId) {
  return meliFetch(`/users/${sellerId}/questions/response_time`);
}

// Producto real del catálogo de ML (auriculares bluetooth) — evita que la moderación
// automática tumbe el ítem a "waiting_for_patch" por marca/modelo inventados.
const CATALOG_PRODUCT_ID = "MLA73670546";

/** Publica un ítem de prueba asociado a un producto real del catálogo (categoría Auriculares). */
export async function publishTestItem({ price, quantity } = {}) {
  const item = await meliFetch(`/items`, {
    method: "POST",
    body: JSON.stringify({
      title: "Auriculares Inalambricos Bluetooth Micro SD Negros",
      catalog_product_id: CATALOG_PRODUCT_ID,
      catalog_listing: true,
      category_id: "MLA3697",
      price: price ?? 25000,
      currency_id: "ARS",
      available_quantity: quantity ?? 15,
      buying_mode: "buy_it_now",
      listing_type_id: "free",
      condition: "new",
      pictures: [{ source: "https://http2.mlstatic.com/D_NQ_NP_697684-MLA112116730100_062026-F.jpg" }],
    }),
  });
  // Los ítems de catálogo heredan la descripción del producto: no se puede sobreescribir.

  return { ...item, permalink: item.permalink };
}
