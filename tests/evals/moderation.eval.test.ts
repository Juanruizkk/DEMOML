import { describe, it, expect } from "vitest";
import { ModerationService } from "../../src/domain/services/ModerationService.js";

describe("ModerationService — eval suite (regresión)", () => {
  describe("bloquea contenido prohibido", () => {
    it("bloquea número de teléfono con guiones", () => {
      const result = ModerationService.moderate("Llamanos al 011-4567-8901 para más info.");
      expect(result.blocked).toBe(true);
      expect(result.matchedRule).toBe("phone_digits");
    });

    it("bloquea número de teléfono con espacios", () => {
      const result = ModerationService.moderate("Contactanos al 15 3456 7890.");
      expect(result.blocked).toBe(true);
    });

    it("bloquea WhatsApp explícito", () => {
      const result = ModerationService.moderate("Escribinos al WhatsApp.");
      expect(result.blocked).toBe(true);
      expect(result.matchedRule).toBe("whatsapp_keywords");
    });

    it("bloquea WhatsApp camuflado como 'wsp'", () => {
      const result = ModerationService.moderate("Mandanos un wsp.");
      expect(result.blocked).toBe(true);
    });

    it("bloquea WhatsApp camuflado como 'wasap'", () => {
      const result = ModerationService.moderate("Contactanos por wasap.");
      expect(result.blocked).toBe(true);
    });

    it("bloquea email", () => {
      const result = ModerationService.moderate("Escribinos a ventas@tienda.com");
      expect(result.blocked).toBe(true);
      expect(result.matchedRule).toBe("email");
    });

    it("bloquea URL con http", () => {
      const result = ModerationService.moderate("Más info en http://mi-tienda.com");
      expect(result.blocked).toBe(true);
      expect(result.matchedRule).toBe("urls");
    });

    it("bloquea URL con www", () => {
      const result = ModerationService.moderate("Visitá www.mitienda.com.ar");
      expect(result.blocked).toBe(true);
    });

    it("bloquea mención de Instagram con usuario", () => {
      const result = ModerationService.moderate("Seguinos en instagram: @mitienda");
      expect(result.blocked).toBe(true);
      expect(result.matchedRule).toBe("social_media");
    });

    it("bloquea pago fuera de plataforma", () => {
      const result = ModerationService.moderate("Podemos coordinar un pago por afuera.");
      expect(result.blocked).toBe(true);
    });
  });

  describe("permite respuestas normales", () => {
    it("permite respuesta de stock sin datos de contacto", () => {
      const result = ModerationService.moderate("Sí, tenemos stock disponible para entrega inmediata.");
      expect(result.blocked).toBe(false);
    });

    it("permite respuesta de envío", () => {
      const result = ModerationService.moderate("Enviamos por Mercado Envíos a todo el país. El plazo es de 3 a 5 días hábiles.");
      expect(result.blocked).toBe(false);
    });

    it("permite respuesta de garantía", () => {
      const result = ModerationService.moderate("El producto tiene 1 año de garantía oficial del fabricante.");
      expect(result.blocked).toBe(false);
    });

    it("permite respuesta de precio sin negociación fuera de plataforma", () => {
      const result = ModerationService.moderate("El precio es el publicado en Mercado Libre. No hay descuentos adicionales.");
      expect(result.blocked).toBe(false);
    });

    it("no bloquea la palabra 'once' usada como número en contexto no telefónico", () => {
      const result = ModerationService.moderate("Tenemos once colores disponibles.");
      expect(result.blocked).toBe(false);
    });
  });
});
