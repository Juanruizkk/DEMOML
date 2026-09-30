import { ITenantRepository } from "../../interfaces/ITenantRepository.js";
import { IEventRepository } from "../../interfaces/IEventRepository.js";
import { IEmailClient } from "../../interfaces/IEmailClient.js";
import { EventLog } from "../../../domain/entities/EventLog.js";

export type SendTestEmailResult =
  | { ok: true; targetEmail: string; messageId?: string }
  | { ok: false; status: 400 | 403 | 500; error: string };

export class SendTestEmailUseCase {
  constructor(
    private readonly tenantRepo: ITenantRepository,
    private readonly eventRepo: IEventRepository,
    private readonly emailClient?: IEmailClient
  ) {}

  public async execute(params: {
    sellerId: string;
    /** Email explícito del request; si falta se resuelve desde el tenant o el usuario. */
    requestedEmail?: string;
    fallbackEmail?: string;
    fallbackName?: string;
  }): Promise<SendTestEmailResult> {
    const { sellerId, requestedEmail, fallbackEmail, fallbackName } = params;

    const tenant = sellerId ? await this.tenantRepo.findBySellerId(sellerId) : null;
    if (tenant && !tenant.effectivePermissions.emailEnabled) {
      return { ok: false, status: 403, error: "Las alertas por email no están habilitadas para este tenant en el Super Admin." };
    }

    const targetEmail = requestedEmail || tenant?.settings.emailAlertAddress || tenant?.email || fallbackEmail;
    if (!targetEmail) {
      return { ok: false, status: 400, error: "Dirección de correo requerida para la prueba." };
    }

    if (!this.emailClient) {
      return { ok: false, status: 500, error: "Cliente de correo no configurado en el servidor." };
    }

    const result = await this.emailClient.sendTestEmail({
      to: targetEmail,
      tenantName: tenant?.nickname || fallbackName || "Vendedor",
    });

    if (!result.success) {
      return { ok: false, status: 400, error: result.error || "Fallo al enviar correo de prueba." };
    }

    if (sellerId) {
      await this.eventRepo.log(
        new EventLog({
          sellerId,
          type: "email_test_sent",
          message: `📧 Email de prueba enviado exitosamente a ${targetEmail}`,
        })
      );
    }

    return { ok: true, targetEmail, messageId: result.messageId };
  }
}
