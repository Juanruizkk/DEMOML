import { Resend } from "resend";
import {
  IEmailClient,
  SendQuestionAlertParams,
  SendClaimAlertParams,
  SendTestEmailParams,
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
}
