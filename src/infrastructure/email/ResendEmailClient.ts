import { Resend } from "resend";
import {
  IEmailClient,
  SendQuestionAlertParams,
  SendClaimAlertParams,
  SendTestEmailParams,
  SendTenantInvitationParams,
  SendPasswordResetParams,
  SendNewLeadAlertParams,
  EmailSendResult,
} from "../../application/interfaces/IEmailClient.js";

export class ResendEmailClient implements IEmailClient {
  private resend: Resend | null = null;
  private readonly fromEmail: string;

  constructor(apiKey?: string, fromEmail?: string) {
    const key = apiKey ?? process.env.RESEND_API_KEY;
    this.fromEmail = fromEmail ?? process.env.EMAIL_FROM ?? "MELI AI Assistant <onboarding@resend.dev>";

    if (key && key.trim() !== "") {
      this.resend = new Resend(key);
    } else {
      console.log("ℹ️ [ResendEmailClient] RESEND_API_KEY no configurada. Los correos se registrarán en modo simulación.");
    }
  }

  public async sendQuestionReviewAlert(params: SendQuestionAlertParams): Promise<EmailSendResult> {
    const html = this.buildQuestionAlertHtml(params);
    const subject = `🤔 [Revisión Requerida] Nueva pregunta en "${params.itemTitle.slice(0, 40)}${params.itemTitle.length > 40 ? "..." : ""}"`;

    return this.sendMail(params.to, subject, html);
  }

  public async sendClaimSlaAlert(params: SendClaimAlertParams): Promise<EmailSendResult> {
    const html = this.buildClaimAlertHtml(params);
    const urgencyEmoji = params.urgency === "critical" ? "🚨 URGENTE" : "⏰ ATENCIÓN";
    const subject = `${urgencyEmoji}: Reclamo #${params.claimId} vence en ${params.remainingHours}h`;

    return this.sendMail(params.to, subject, html);
  }

  public async sendTestEmail(params: SendTestEmailParams): Promise<EmailSendResult> {
    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background: #0f172a; color: #f8fafc; border-radius: 12px; border: 1px solid #334155;">
        <h2 style="color: #60a5fa; margin-top: 0; font-size: 20px;">🎉 ¡Conexión con Resend Exitosa!</h2>
        <p style="font-size: 15px; line-height: 1.5;">Hola <strong>${params.tenantName || "Vendedor"}</strong>,</p>
        <p style="font-size: 14px; line-height: 1.5; color: #cbd5e1;">Tu canal de alertas por correo electrónico está correctamente vinculado con <strong>MELI AI Assistant</strong>.</p>
        <div style="background: #1e293b; padding: 16px; border-radius: 8px; border-left: 4px solid #10b981; margin: 20px 0;">
          <p style="margin: 0; font-size: 14px; color: #e2e8f0;">
            A partir de ahora vas a recibir aquí las notificaciones de preguntas que requieran moderación o respuesta personalizada, y avisos críticos de reclamos con SLA urgente.
          </p>
        </div>
        <p style="font-size: 12px; color: #64748b; margin-bottom: 0;">Enviado automáticamente por MELI AI Assistant con tecnología Resend.</p>
      </div>
    `;
    const subject = "✅ Verificación de Alertas por Email - MELI AI Assistant";

    return this.sendMail(params.to, subject, html);
  }

  public async sendTenantInvitation(params: SendTenantInvitationParams): Promise<EmailSendResult> {
    const html = this.buildTenantInvitationHtml(params);
    const subject = `🚀 ¡Bienvenido a MELI AI Assistant! Activá tu cuenta de vendedor`;

    return this.sendMail(params.to, subject, html);
  }

  public async sendPasswordReset(params: SendPasswordResetParams): Promise<EmailSendResult> {
    const html = this.buildPasswordResetHtml(params);
    const subject = `🔐 Restablecimiento de contraseña - MELI AI Assistant`;

    return this.sendMail(params.to, subject, html);
  }

  public async sendNewLeadAlert(params: SendNewLeadAlertParams): Promise<EmailSendResult> {
    const { lead } = params;
    const subject = `Nuevo lead: ${lead.name} — ${lead.weeklyQuestions} preg/sem`;
    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background: #0f172a; color: #f8fafc; border-radius: 12px; border: 1px solid #334155;">
        <h2 style="color: #60a5fa; margin-top: 0; font-size: 20px;">🎯 Nuevo lead calificado</h2>
        <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
          <tr><td style="padding: 8px 0; color: #94a3b8; font-size: 13px; width: 120px;">Nombre</td><td style="padding: 8px 0; font-size: 14px;">${this.escapeHtml(lead.name)}</td></tr>
          <tr><td style="padding: 8px 0; color: #94a3b8; font-size: 13px;">Email</td><td style="padding: 8px 0; font-size: 14px;">${this.escapeHtml(lead.email)}</td></tr>
          <tr><td style="padding: 8px 0; color: #94a3b8; font-size: 13px;">Teléfono</td><td style="padding: 8px 0; font-size: 14px;">${this.escapeHtml(lead.phone)}</td></tr>
          <tr><td style="padding: 8px 0; color: #94a3b8; font-size: 13px;">Tienda ML</td><td style="padding: 8px 0; font-size: 14px;">${this.escapeHtml(lead.mlStore)}</td></tr>
          <tr><td style="padding: 8px 0; color: #94a3b8; font-size: 13px;">Preg/semana</td><td style="padding: 8px 0; font-size: 14px; color: #34d399; font-weight: 600;">${this.escapeHtml(lead.weeklyQuestions)}</td></tr>
        </table>
        <a href="${process.env.APP_BASE_URL ?? 'http://localhost:5173'}/admin" style="display: inline-block; margin-top: 8px; padding: 10px 20px; background: #3b82f6; color: #fff; border-radius: 8px; text-decoration: none; font-size: 14px; font-weight: 600;">Ver en panel → Leads</a>
        <p style="font-size: 11px; color: #475569; margin-top: 20px; margin-bottom: 0;">MELI AI Assistant — notificación automática</p>
      </div>
    `;
    return this.sendMail(params.to, subject, html);
  }

  private escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  private async sendMail(to: string, subject: string, html: string): Promise<EmailSendResult> {
    if (!this.resend) {
      console.log(`📧 [Simulación Email Resend]`);
      console.log(`   De: ${this.fromEmail}`);
      console.log(`   Para: ${to}`);
      console.log(`   Asunto: ${subject}`);
      return { success: true, messageId: `simulated_${Date.now()}` };
    }

    try {
      const response = await this.resend.emails.send({
        from: this.fromEmail,
        to: [to],
        subject,
        html,
      });

      if (response.error) {
        console.error("❌ [ResendEmailClient] Error de Resend API:", response.error);
        return { success: false, error: response.error.message };
      }

      return { success: true, messageId: response.data?.id };
    } catch (err: any) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error("❌ [ResendEmailClient] Excepción al enviar email:", errorMsg);
      return { success: false, error: errorMsg };
    }
  }

  private buildQuestionAlertHtml(params: SendQuestionAlertParams): string {
    const portalUrl = params.portalUrl || "http://localhost:5173/questions";
    return `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background: #0f172a; color: #f8fafc; border-radius: 12px; border: 1px solid #334155;">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px;">
          <span style="background: #eab308; color: #000000; font-size: 12px; font-weight: bold; padding: 4px 10px; border-radius: 20px; text-transform: uppercase;">
            Revisión Requerida
          </span>
          <span style="color: #94a3b8; font-size: 13px;">MELI AI Assistant</span>
        </div>
        
        <h2 style="color: #f8fafc; margin-top: 0; font-size: 18px; line-height: 1.4;">
          ${params.itemTitle}
        </h2>
        
        <div style="background: #1e293b; padding: 16px; border-radius: 8px; margin: 16px 0; border: 1px solid #334155;">
          <p style="margin: 0 0 6px 0; font-size: 12px; color: #94a3b8; text-transform: uppercase; font-weight: 600;">Pregunta del comprador:</p>
          <p style="margin: 0; font-size: 15px; color: #f1f5f9; font-style: italic;">"${params.questionText}"</p>
        </div>

        ${
          params.suggestedAnswer
            ? `
        <div style="background: #022c22; padding: 16px; border-radius: 8px; margin: 16px 0; border: 1px solid #059669;">
          <p style="margin: 0 0 6px 0; font-size: 12px; color: #34d399; text-transform: uppercase; font-weight: 600;">💡 Sugerencia generada por IA:</p>
          <p style="margin: 0; font-size: 14px; color: #a7f3d0; line-height: 1.4;">"${params.suggestedAnswer}"</p>
        </div>
        `
            : ""
        }

        <p style="font-size: 13px; color: #cbd5e1; margin: 12px 0;">
          <strong>Motivo:</strong> ${params.reason}
        </p>

        <div style="margin-top: 24px; text-align: center;">
          <a href="${portalUrl}" style="display: inline-block; background: #3b82f6; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-weight: 600; font-size: 14px;">
            Aprobar o Responder en el Portal
          </a>
        </div>
      </div>
    `;
  }

  private buildClaimAlertHtml(params: SendClaimAlertParams): string {
    const portalUrl = params.portalUrl || "http://localhost:5173/claims";
    const isCritical = params.urgency === "critical";
    const badgeBg = isCritical ? "#ef4444" : "#f97316";

    return `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background: #0f172a; color: #f8fafc; border-radius: 12px; border: 1px solid #334155;">
        <div style="margin-bottom: 16px;">
          <span style="background: ${badgeBg}; color: #ffffff; font-size: 12px; font-weight: bold; padding: 4px 10px; border-radius: 20px; text-transform: uppercase;">
            ${isCritical ? "🚨 SLA Crítico" : "⏰ Alerta de Reclamo"}
          </span>
        </div>
        
        <h2 style="color: #f8fafc; margin-top: 0; font-size: 18px;">
          Reclamo #${params.claimId} ${params.orderId ? `(Orden #${params.orderId})` : ""}
        </h2>

        <div style="background: #1e293b; padding: 16px; border-radius: 8px; margin: 16px 0; border: 1px solid #334155;">
          <p style="margin: 0 0 6px 0; font-size: 12px; color: #94a3b8; text-transform: uppercase; font-weight: 600;">Motivo del comprador:</p>
          <p style="margin: 0; font-size: 15px; color: #f1f5f9;">${params.reason}</p>
        </div>

        <div style="background: ${isCritical ? "#450a0a" : "#431407"}; padding: 14px 16px; border-radius: 8px; margin: 16px 0; border: 1px solid ${isCritical ? "#b91c1c" : "#c2410c"};">
          <p style="margin: 0; font-size: 14px; font-weight: 600; color: ${isCritical ? "#fca5a5" : "#fed7aa"};">
            ⏳ Tiempo restante para responder: ${params.remainingHours} horas
          </p>
        </div>

        <div style="margin-top: 24px; text-align: center;">
          <a href="${portalUrl}" style="display: inline-block; background: ${badgeBg}; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-weight: 600; font-size: 14px;">
            Gestionar Reclamo Ahora
          </a>
        </div>
      </div>
    `;
  }

  private buildTenantInvitationHtml(params: SendTenantInvitationParams): string {
    return `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 28px; background: #0f172a; color: #f8fafc; border-radius: 16px; border: 1px solid #334155;">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px;">
          <span style="background: linear-gradient(135deg, #3b82f6, #6366f1); color: #ffffff; font-size: 11px; font-weight: 700; padding: 6px 12px; border-radius: 20px; text-transform: uppercase; letter-spacing: 0.5px;">
            🚀 Activación de Cuenta
          </span>
          <span style="color: #94a3b8; font-size: 13px; font-weight: 500;">MELI AI Assistant</span>
        </div>

        <h1 style="color: #f8fafc; font-size: 22px; font-weight: 700; margin: 0 0 12px 0; line-height: 1.3;">
          ¡Bienvenido/a a bordo, ${params.name}! 🎉
        </h1>

        <p style="font-size: 15px; color: #cbd5e1; line-height: 1.6; margin: 0 0 20px 0;">
          Tu cuenta de vendedor ha sido creada exitosamente. Con <strong>MELI AI Assistant</strong> vas a automatizar tus ventas en Mercado Libre, responder preguntas al instante y blindar tu reputación 24/7.
        </p>

        <div style="background: #1e293b; padding: 20px; border-radius: 12px; border: 1px solid #334155; margin-bottom: 24px;">
          <h3 style="margin: 0 0 12px 0; font-size: 13px; text-transform: uppercase; color: #60a5fa; letter-spacing: 0.5px; font-weight: 700;">
            Lo que podés hacer desde ahora:
          </h3>
          <ul style="margin: 0; padding-left: 18px; font-size: 14px; color: #e2e8f0; line-height: 1.8;">
            <li><strong>🤖 Respuestas con IA:</strong> Automatización precisa y personalizada de preguntas frecuentes.</li>
            <li><strong>🛡️ Moderación en tiempo real:</strong> Revisión rápida de consultas complejas antes de responder.</li>
            <li><strong>⏰ Guardián de Reclamos:</strong> Monitoreo constante de SLA y alertas de vencimiento.</li>
          </ul>
        </div>

        ${
          params.temporaryToken
            ? `
        <div style="background: #1e1b4b; border: 1px dashed #6366f1; padding: 12px 16px; border-radius: 8px; margin-bottom: 24px; text-align: center;">
          <p style="margin: 0; font-size: 13px; color: #c7d2fe;">Tu código temporal de activación:</p>
          <p style="margin: 4px 0 0 0; font-size: 18px; font-weight: 700; letter-spacing: 2px; color: #ffffff;">${params.temporaryToken}</p>
        </div>
        `
            : ""
        }

        <div style="text-align: center; margin: 28px 0;">
          <a href="${params.activationUrl}" style="display: inline-block; background: linear-gradient(135deg, #2563eb, #3b82f6); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 10px; font-weight: 700; font-size: 15px; box-shadow: 0 4px 12px rgba(37, 99, 235, 0.35);">
            Activar Cuenta y Conectar Mercado Libre →
          </a>
        </div>

        <p style="font-size: 12px; color: #64748b; text-align: center; margin: 0 0 6px 0;">
          Este enlace de activación es único y expira en 24 horas por motivos de seguridad.
        </p>
        <p style="font-size: 11px; color: #475569; text-align: center; margin: 0;">
          Si no esperabas esta invitación, podés desestimar este mensaje.
        </p>
      </div>
    `;
  }

  private buildPasswordResetHtml(params: SendPasswordResetParams): string {
    const minutes = params.expiresInMinutes || 60;
    const greeting = params.name ? `Hola <strong>${params.name}</strong>,` : "Hola,";

    return `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 28px; background: #0f172a; color: #f8fafc; border-radius: 16px; border: 1px solid #334155;">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px;">
          <span style="background: #334155; color: #94a3b8; font-size: 11px; font-weight: 700; padding: 6px 12px; border-radius: 20px; text-transform: uppercase; letter-spacing: 0.5px;">
            🔐 Seguridad de la Cuenta
          </span>
          <span style="color: #94a3b8; font-size: 13px; font-weight: 500;">MELI AI Assistant</span>
        </div>

        <h1 style="color: #f8fafc; font-size: 22px; font-weight: 700; margin: 0 0 12px 0; line-height: 1.3;">
          Restablecimiento de Contraseña
        </h1>

        <p style="font-size: 15px; color: #cbd5e1; line-height: 1.6; margin: 0 0 16px 0;">
          ${greeting}
        </p>

        <p style="font-size: 14px; color: #94a3b8; line-height: 1.6; margin: 0 0 24px 0;">
          Recibimos una solicitud para cambiar la contraseña de tu cuenta en <strong>MELI AI Assistant</strong>. Hacé clic en el siguiente botón para definir una nueva clave:
        </p>

        <div style="text-align: center; margin: 28px 0;">
          <a href="${params.resetUrl}" style="display: inline-block; background: linear-gradient(135deg, #2563eb, #3b82f6); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 10px; font-weight: 700; font-size: 15px; box-shadow: 0 4px 12px rgba(37, 99, 235, 0.35);">
            Restablecer Contraseña →
          </a>
        </div>

        <div style="background: #1e293b; padding: 14px 18px; border-radius: 10px; border-left: 4px solid #f59e0b; margin-bottom: 24px;">
          <p style="margin: 0; font-size: 13px; color: #e2e8f0; line-height: 1.5;">
            ⏳ <strong>Atención:</strong> Este enlace de recuperación expirará en <strong>${minutes} minutos</strong>.
          </p>
        </div>

        <p style="font-size: 12px; color: #64748b; line-height: 1.5; margin: 0 0 6px 0;">
          🔒 Si no solicitaste este cambio, ignorá este correo. Tu contraseña actual seguirá siendo segura y no se modificará.
        </p>
        <p style="font-size: 11px; color: #475569; margin: 0;">
          MELI AI Assistant • Sistema automatizado de seguridad
        </p>
      </div>
    `;
  }
}
