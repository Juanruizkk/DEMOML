import { Resend } from 'resend';
import dotenv from 'dotenv';
dotenv.config();

const resend = new Resend(process.env.RESEND_API_KEY);
const TO = 'asistentemercadol@gmail.com';

async function test() {
  console.log('🚀 Probando conexión con Resend...');
  console.log(`   API Key: ${process.env.RESEND_API_KEY?.slice(0, 10)}...`);
  console.log(`   From:    ${process.env.EMAIL_FROM}`);
  console.log(`   To:      ${TO}`);

  const { data, error } = await resend.emails.send({
    from: process.env.EMAIL_FROM || 'onboarding@resend.dev',
    to: [TO],
    subject: '🧪 Test de Conexión MELI AI Assistant',
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background: #0f172a; color: #f8fafc; border-radius: 12px;">
        <h2 style="color: #60a5fa;">🎉 ¡Resend funciona!</h2>
        <p>Test de conectividad enviado desde <strong>MELI AI Assistant</strong>.</p>
        <p style="color: #94a3b8; font-size: 12px;">Enviado: ${new Date().toISOString()}</p>
      </div>
    `,
  });

  if (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }

  console.log('✅ Email enviado con ID:', data?.id);
}

test();
