import { describe, it, expect } from "vitest";
import { ModerationService } from "../../src/domain/services/ModerationService.js";

describe("ModerationService (Anti-Sanctions Domain)", () => {
  it("debe aprobar respuestas cordiales legítimas sin datos de contacto", () => {
    const res = ModerationService.moderate("¡Hola! Sí, tenemos stock disponible para retiro hoy mismo. ¡Esperamos tu compra!");
    expect(res.blocked).toBe(false);
    expect(res.reason).toBeNull();
  });

  it("debe bloquear números de teléfono en dígitos", () => {
    const res = ModerationService.moderate("Escribime al 11 4567-8901 y coordinamos");
    expect(res.blocked).toBe(true);
    expect(res.reason).toContain("teléfono");
  });

  it("debe bloquear números telefónicos camuflados con palabras", () => {
    const res = ModerationService.moderate("Habláme al once cincuenta y cuatro veintidós");
    expect(res.blocked).toBe(true);
    expect(res.reason).toContain("palabras");
  });

  it("debe bloquear menciones directas a WhatsApp / WSP", () => {
    const res1 = ModerationService.moderate("Mandame wsp y te paso fotos");
    expect(res1.blocked).toBe(true);
    expect(res1.reason).toContain("WhatsApp");

    const res2 = ModerationService.moderate("Buscame por wa.me/12345");
    expect(res2.blocked).toBe(true);
  });

  it("debe bloquear emails", () => {
    const res = ModerationService.moderate("Escribime a ventas@tiendaejemplo.com.ar para pasarte lista de precios");
    expect(res.blocked).toBe(true);
    expect(res.reason).toContain("correo electrónico");
  });

  it("debe bloquear enlaces web externos", () => {
    const res = ModerationService.moderate("Podés ver todos nuestros modelos en https://mitienda.com");
    expect(res.blocked).toBe(true);
    expect(res.reason).toContain("enlace URL");
  });

  it("debe bloquear coordinación de pagos por fuera de la plataforma", () => {
    const res = ModerationService.moderate("Hacemos 10% de descuento si hacés pago por afuera en efectivo");
    expect(res.blocked).toBe(true);
    expect(res.reason).toContain("pago o contacto por fuera");
  });
});
