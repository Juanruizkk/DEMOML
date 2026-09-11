import { ModerationResult } from "../value-objects/ModerationResult.js";

export class ModerationService {
  private static readonly RULES: Array<{ id: string; pattern: RegExp; reason: string }> = [
    {
      id: "phone_digits",
      // Detecta secuencias de 8+ dígitos con posibles separadores (espacios, guiones, puntos).
      pattern: /(?:(?:\+|00)?\d{1,3}[\s.-]*)?(?:\(?\d{2,4}\)?[\s.-]*)?\d{3,4}[\s.-]*\d{4}/i,
      reason: "Contiene número de teléfono o celular",
    },
    {
      id: "phone_words",
      // Números escritos con letras ("quince cuarenta y dos...", "cero once...")
      pattern:
        /\b(quince|once|doce|trece|catorce|dieciseis|veinte|treinta|cuarenta|cincuenta|sesenta|setenta|ochenta|noventa|cien)\s+(y\s+)?(uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|cero)\b/i,
      reason: "Contiene números telefónicos escritos con palabras",
    },
    {
      id: "whatsapp_keywords",
      pattern: /\b(wsp|wa\.me|wh?atsapp|whastapp|wapp|wpp|wasap|wts|watsap|w-a-s-a-p)\b/i,
      reason: "Mención explícita a WhatsApp o mensajería externa",
    },
    {
      id: "email",
      pattern: /[a-zA-Z0-9._%+-]+(?:\s*\[at\]\s*|\s*@\s*)[a-zA-Z0-9.-]+\s*\.\s*[a-zA-Z]{2,}/i,
      reason: "Contiene dirección de correo electrónico",
    },
    {
      id: "urls",
      pattern: /(?:https?:\/\/|www\.)[^\s]+|\b[a-zA-Z0-9.-]+\.(com|com\.ar|net|org|io|ar|me|co)\b/i,
      reason: "Contiene enlace URL o dominio web externo",
    },
    {
      id: "social_media",
      pattern: /\b(instagram|ig|facebook|fb|tiktok|twitter|telegram|tg)[\s:]+[@]?[a-zA-Z0-9._-]{3,}\b/i,
      reason: "Mención de perfiles de redes sociales",
    },
    {
      id: "external_payment_coordination",
      pattern:
        /\b(pago\s+(por\s+afuera|en\s+efectivo\s+en\s+mano|transferencia\s+directa|por\s+fuera)|coordinar\s+por\s+(privado|afuera))\b/i,
      reason: "Intento de coordinar pago o contacto por fuera de Mercado Libre",
    },
  ];

  /**
   * Evalúa determinísticamente si un texto infringe las políticas de Mercado Libre.
   * Si retorna `blocked: true`, NUNCA debe publicarse automáticamente.
   */
  public static moderate(text: string): ModerationResult {
    if (!text || typeof text !== "string") {
      return { blocked: false, reason: null };
    }

    const normalized = text.toLowerCase().trim();

    for (const rule of this.RULES) {
      if (rule.pattern.test(normalized)) {
        return {
          blocked: true,
          reason: rule.reason,
          matchedRule: rule.id,
        };
      }
    }

    return { blocked: false, reason: null };
  }
}
