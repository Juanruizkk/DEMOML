import { describe, it, expect, vi, beforeEach } from "vitest";
import { ResendEmailClient } from "../infrastructure/email/ResendEmailClient.js";

describe("ResendEmailClient", () => {
  let emailClient: ResendEmailClient;

  beforeEach(() => {
    emailClient = new ResendEmailClient(undefined, "test@melibot.com");
  });

  it("should simulate question review alert when no API key is provided", async () => {
    const res = await emailClient.sendQuestionReviewAlert({
      to: "vendedor@test.com",
      sellerId: "12345",
      questionId: "Q100",
      itemTitle: "Auriculares Sony WH-1000XM5",
      itemPrice: 350000,
      questionText: "¿Viene con cable de audio o solo bluetooth?",
      suggestedAnswer: "¡Hola! Sí, incluye el cable de audio 3.5mm.",
      reason: "Consulta sobre accesorios incluidos",
    });

    expect(res.success).toBe(true);
    expect(res.messageId).toContain("simulated_");
  });

  it("should simulate claim SLA alert when no API key is provided", async () => {
    const res = await emailClient.sendClaimSlaAlert({
      to: "vendedor@test.com",
      sellerId: "12345",
      claimId: "C500",
      orderId: "ORD-999",
      reason: "Paquete no recibido (PNR)",
      remainingHours: 8,
      urgency: "critical",
    });

    expect(res.success).toBe(true);
    expect(res.messageId).toContain("simulated_");
  });

  it("should simulate test email successfully", async () => {
    const res = await emailClient.sendTestEmail({
      to: "vendedor@test.com",
      tenantName: "Tienda Oficial",
    });

    expect(res.success).toBe(true);
    expect(res.messageId).toContain("simulated_");
  });
});
