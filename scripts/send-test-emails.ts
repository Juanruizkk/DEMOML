import dotenv from "dotenv";
import { ResendEmailClient } from "../src/infrastructure/email/ResendEmailClient.js";

// Cargar variables de entorno desde .env
dotenv.config();

const TARGET_EMAIL = process.argv[2] || "asistentemercadol@gmail.com";
const apiKey = process.env.RESEND_API_KEY;
const fromEmail = process.env.EMAIL_FROM || "MELI AI Assistant <onboarding@resend.dev>";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function run() {
  console.log("==========================================================");
  console.log("📨 MELI AI Assistant - Suite de Prueba de Emails con Resend");
  console.log("==========================================================");
  console.log(`🔑 RESEND_API_KEY : ${apiKey ? apiKey.slice(0, 10) + "..." : "⚠️ NO CONFIGURADA (Modo Simulación)"}`);
  console.log(`📤 Remitente (FROM): ${fromEmail}`);
  console.log(`📥 Destinatario   : ${TARGET_EMAIL}`);
  console.log("----------------------------------------------------------\n");

  const emailClient = new ResendEmailClient(apiKey, fromEmail);

  // 1. Email de Conexión / Test
  console.log("1️⃣  Enviando Email de Test / Verificación de Conexión...");
  const testRes = await emailClient.sendTestEmail({
    to: TARGET_EMAIL,
    tenantName: "Tienda Oficial Demo",
  });
  console.log(`   Resultado: ${testRes.success ? "✅ ENVIADO" : "❌ FALLÓ"} | ID: ${testRes.messageId || testRes.error}\n`);

  await sleep(800); // Evitar rate limits del sandbox de Resend (2 req/s)

  // 2. Alerta de Pregunta que requiere moderación
  console.log("2️⃣  Enviando Alerta de Pregunta (Revisión Requerida)...");
  const questionRes = await emailClient.sendQuestionReviewAlert({
    to: TARGET_EMAIL,
    sellerId: "123456789",
    questionId: "Q-998877",
    itemTitle: "Smart TV Samsung 55 pulgadas 4K Crystal UHD",
    itemPrice: 789999,
    questionText: "¿Hacen factura A? ¿Tienen stock para entrega inmediata en Palermo hoy mismo?",
    suggestedAnswer: "¡Hola! Sí, emitimos factura A de forma automática. Tenemos stock disponible para retiro hoy mismo en Palermo.",
    reason: "Consulta sobre facturación especial y retiro en el día con urgencia",
    portalUrl: "http://localhost:5173/questions",
  });
  console.log(`   Resultado: ${questionRes.success ? "✅ ENVIADO" : "❌ FALLÓ"} | ID: ${questionRes.messageId || questionRes.error}\n`);

  await sleep(800);

  // 3. Alerta Crítica de SLA de Reclamo
  console.log("3️⃣  Enviando Alerta de Reclamo SLA Crítico...");
  const claimRes = await emailClient.sendClaimSlaAlert({
    to: TARGET_EMAIL,
    sellerId: "123456789",
    claimId: "CLM-5049382",
    orderId: "ORD-2000008493021",
    reason: "El comprador indica que el producto llegó con la pantalla dañada y solicita cambio urgente.",
    remainingHours: 4,
    urgency: "critical",
    portalUrl: "http://localhost:5173/claims",
  });
  console.log(`   Resultado: ${claimRes.success ? "✅ ENVIADO" : "❌ FALLÓ"} | ID: ${claimRes.messageId || claimRes.error}\n`);

  await sleep(800);

  // 4. Invitación y Activación de Cuenta / Tenant
  console.log("4️⃣  Enviando Invitación de Activación de Cuenta / Tenant...");
  const inviteRes = await emailClient.sendTenantInvitation({
    to: TARGET_EMAIL,
    name: "Juan Ruiz",
    activationUrl: "http://localhost:5173/activate?token=meli_act_8f93e2b1c4",
    temporaryToken: "742-910",
  });
  console.log(`   Resultado: ${inviteRes.success ? "✅ ENVIADO" : "❌ FALLÓ"} | ID: ${inviteRes.messageId || inviteRes.error}\n`);

  await sleep(800);

  // 5. Restablecimiento de Contraseña
  console.log("5️⃣  Enviando Restablecimiento de Contraseña...");
  const resetRes = await emailClient.sendPasswordReset({
    to: TARGET_EMAIL,
    name: "Juan Ruiz",
    resetUrl: "http://localhost:5173/reset-password?token=meli_rst_3e89a1f4",
    expiresInMinutes: 30,
  });
  console.log(`   Resultado: ${resetRes.success ? "✅ ENVIADO" : "❌ FALLÓ"} | ID: ${resetRes.messageId || resetRes.error}\n`);

  console.log("==========================================================");
  console.log("🎉 ¡Prueba finalizada! Revisá la bandeja de entrada o spam de:");
  console.log(`   👉 ${TARGET_EMAIL}`);
  console.log("==========================================================");
}

run().catch((err) => {
  console.error("❌ Error no controlado al ejecutar el script:", err);
  process.exit(1);
});
