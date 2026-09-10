import db from "./db.js";

const TOKEN_URL = "https://api.mercadolibre.com/oauth/token";
const REFRESH_MARGIN_MS = 10 * 60 * 1000; // refrescar si faltan menos de 10 minutos

let refreshPromise = null;

function readTokenRow() {
  return db.prepare("SELECT * FROM tokens WHERE id = 1").get();
}

function saveTokens({ access_token, refresh_token, expires_in }) {
  const expiresAt = Date.now() + expires_in * 1000;
  db.prepare(
    `INSERT INTO tokens (id, access_token, refresh_token, expires_at, updated_at)
     VALUES (1, ?, ?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(id) DO UPDATE SET
       access_token = excluded.access_token,
       refresh_token = excluded.refresh_token,
       expires_at = excluded.expires_at,
       updated_at = CURRENT_TIMESTAMP`
  ).run(access_token, refresh_token, expiresAt);
  return readTokenRow();
}

/** Intercambia el authorization code inicial (usado por GET /oauth/callback). */
export async function exchangeCodeForTokens(code) {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: process.env.ML_CLIENT_ID,
    client_secret: process.env.ML_CLIENT_SECRET,
    code,
    redirect_uri: process.env.ML_REDIRECT_URI,
  });

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Error intercambiando code OAuth: ${res.status} ${errText}`);
  }

  const json = await res.json();
  return saveTokens(json);
}

async function refreshTokens(refreshToken) {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: process.env.ML_CLIENT_ID,
    client_secret: process.env.ML_CLIENT_SECRET,
    refresh_token: refreshToken,
  });

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Error refrescando token de MELI: ${res.status} ${errText}`);
  }

  const json = await res.json();
  return saveTokens(json);
}

/**
 * Devuelve un access_token válido. Refresca automáticamente si faltan
 * menos de 10 minutos para expirar. Usa un mutex en memoria para que
 * llamadas concurrentes no disparen refrescos en paralelo (el refresh_token
 * de MELI es de un solo uso).
 */
export async function getValidToken() {
  const row = readTokenRow();
  if (!row) {
    throw new Error("No hay tokens de Mercado Libre guardados. Completá el flujo OAuth en /oauth/login.");
  }

  const willExpireSoon = row.expires_at - Date.now() < REFRESH_MARGIN_MS;
  if (!willExpireSoon) {
    return row.access_token;
  }

  if (!refreshPromise) {
    refreshPromise = refreshTokens(row.refresh_token)
      .finally(() => {
        refreshPromise = null;
      });
  }

  const refreshed = await refreshPromise;
  return refreshed.access_token;
}

export function getTokenStatus() {
  const row = readTokenRow();
  if (!row) return { connected: false };
  return {
    connected: true,
    expiresAt: row.expires_at,
    expiresInMs: row.expires_at - Date.now(),
  };
}
