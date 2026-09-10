const PHONE_REGEX = /(\+?\d[\d\s.\-]{6,}\d)/; // 8+ dígitos con o sin separadores
const EMAIL_REGEX = /[a-z0-9._%+-]+\s*(@|\[?\s*arroba\s*\]?)\s*[a-z0-9.-]+\s*\.\s*[a-z]{2,}/i;
const URL_REGEX = /(https?:\/\/|www\.|\.com\b|\.com\.ar\b|\.ar\b|\.net\b)/i;

const CONTACT_KEYWORDS = [
  "whatsapp",
  "wsp",
  "wapp",
  "telegram",
  "celular",
  "instagram",
  "\\big\\b",
  "facebook",
  "\\bfb\\b",
  "por fuera",
  "por fuera de ml",
  "transferencia directa",
  "mp fuera",
];

const KEYWORD_REGEX = new RegExp(CONTACT_KEYWORDS.join("|"), "i");

/**
 * Corre SIEMPRE después del LLM y antes de publicar. Si detecta cualquier
 * patrón de riesgo, anula la auto-respuesta y fuerza revisión humana.
 * Protege la cuenta de MELI de baneos por infracción de políticas de contacto.
 */
export function moderate(answerText) {
  if (!answerText || answerText.trim().length === 0) {
    return { blocked: true, reason: "moderation_block: respuesta vacía" };
  }
  if (answerText.length > 2000) {
    return { blocked: true, reason: "moderation_block: respuesta excede 2000 caracteres" };
  }
  if (PHONE_REGEX.test(answerText)) {
    return { blocked: true, reason: "moderation_block: posible número de teléfono detectado" };
  }
  if (EMAIL_REGEX.test(answerText)) {
    return { blocked: true, reason: "moderation_block: posible email detectado" };
  }
  if (URL_REGEX.test(answerText)) {
    return { blocked: true, reason: "moderation_block: posible URL o dominio detectado" };
  }
  if (KEYWORD_REGEX.test(answerText)) {
    const match = answerText.match(KEYWORD_REGEX);
    return { blocked: true, reason: `moderation_block: palabra clave de contacto externo detectada (${match[0]})` };
  }
  return { blocked: false, reason: null };
}
