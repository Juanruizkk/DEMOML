import { ITenantRepository } from "../interfaces/ITenantRepository.js";
import { IEventRepository } from "../interfaces/IEventRepository.js";
import { IWhatsAppClient } from "../interfaces/IWhatsAppClient.js";
import { ITelegramClient } from "../interfaces/ITelegramClient.js";
import { IEmailClient } from "../interfaces/IEmailClient.js";
import { Tenant } from "../../domain/entities/Tenant.js";
import { EventLog } from "../../domain/entities/EventLog.js";

export interface WhatsAppAlertSpec {
  bodyText: string;
  buttons: { id: string; title: string }[];
  successLog?: { type: string; message: string };
}

export interface TelegramAlertSpec {
  text: string;
  buttons?: { text: string; callbackData: string }[][];
  /** Si es false, ignora preferredAlertChannel (ej: alertas post-venta que solo salen por Telegram). Default: true. */
  respectPreference?: boolean;
  successLog?: { type: string; buildMessage: (chatId: string) => string };
}

export interface EmailAlertSpec {
  kind: "question" | "claim";
  send: (client: IEmailClient, to: string) => Promise<{ success: boolean }>;
  successLog: { type: string; buildMessage: (to: string) => string };
}

export interface TenantAlertParams {
  sellerId: string;
  /** Tenant ya cargado por el caller; si no viene, se busca por sellerId. */
  tenant?: Tenant | null;
  /** Contexto que se propaga a todos los EventLog generados. */
  logContext?: { questionId?: string };
  whatsapp?: WhatsAppAlertSpec;
  telegram?: TelegramAlertSpec;
  email?: EmailAlertSpec;
}

/**
 * Centraliza la mecánica de alertas multi-canal al vendedor (WhatsApp, Telegram, Email):
 * gates por configuración del tenant, cuotas, credenciales y event logs.
 * El contenido de cada mensaje lo define el caso de uso que llama.
 * Los errores de envío son no-fatales: se loguean por consola y el flujo continúa.
 */
export class TenantNotificationService {
  constructor(
    private readonly tenantRepo: ITenantRepository,
    private readonly eventRepo: IEventRepository,
    private readonly whatsAppClient?: IWhatsAppClient,
    private readonly telegramClient?: ITelegramClient,
    private readonly emailClient?: IEmailClient
  ) {}

  public async notify(params: TenantAlertParams): Promise<void> {
    const { sellerId, logContext } = params;
    const tenant = params.tenant !== undefined
      ? params.tenant
      : await this.tenantRepo.findBySellerId(sellerId);

    if (!tenant) return;

    const channelPref = tenant.settings?.preferredAlertChannel || "whatsapp";

    if (params.whatsapp) {
      await this.sendWhatsApp(tenant, channelPref, sellerId, logContext, params.whatsapp);
    }

    if (params.telegram) {
      await this.sendTelegram(tenant, channelPref, sellerId, logContext, params.telegram);
    }

    if (params.email) {
      await this.sendEmail(tenant, sellerId, logContext, params.email);
    }
  }

  private async sendWhatsApp(
    tenant: Tenant,
    channelPref: string,
    sellerId: string,
    logContext: TenantAlertParams["logContext"],
    spec: WhatsAppAlertSpec
  ): Promise<void> {
    if (!this.whatsAppClient) return;
    const phone = tenant.settings?.whatsappAlertPhone;
    if (!phone || (channelPref !== "whatsapp" && channelPref !== "both")) return;

    if (!tenant.canSendWhatsAppAlert()) {
      await this.eventRepo.log(
        new EventLog({
          sellerId,
          ...logContext,
          type: "WHATSAPP_QUOTA_EXCEEDED",
          message: `Límite mensual de alertas alcanzado (${tenant.settings.alertsSentThisMonth}/${tenant.settings.monthlyAlertsLimit}). Alerta omitida.`,
        })
      );
      return;
    }

    const creds = tenant.getWhatsAppCredentials();
    await this.whatsAppClient
      .sendInteractiveButtons({
        to: phone,
        bodyText: spec.bodyText,
        buttons: spec.buttons,
        credentials: creds ?? undefined,
      })
      .catch((err) => console.error("[TenantNotificationService] Error WhatsApp:", err));

    if (tenant.settings.whatsappMode === "platform_shared") {
      tenant.incrementAlertsSent();
      await this.tenantRepo.save(tenant);
    }

    if (spec.successLog) {
      await this.eventRepo.log(
        new EventLog({
          sellerId,
          ...logContext,
          type: spec.successLog.type,
          message: spec.successLog.message,
        })
      );
    }
  }

  private async sendTelegram(
    tenant: Tenant,
    channelPref: string,
    sellerId: string,
    logContext: TenantAlertParams["logContext"],
    spec: TelegramAlertSpec
  ): Promise<void> {
    if (!this.telegramClient || !tenant.canSendTelegramAlert()) return;
    const respectPreference = spec.respectPreference !== false;
    if (respectPreference && channelPref !== "telegram" && channelPref !== "both") return;

    const creds = tenant.getTelegramCredentials();
    if (!creds?.chatId) return;

    await this.telegramClient
      .sendMessage({
        chatId: creds.chatId,
        text: spec.text,
        buttons: spec.buttons,
        botToken: creds.botToken,
      })
      .catch((err) => console.error("[TenantNotificationService] Error Telegram:", err));

    if (spec.successLog) {
      await this.eventRepo.log(
        new EventLog({
          sellerId,
          ...logContext,
          type: spec.successLog.type,
          message: spec.successLog.buildMessage(creds.chatId),
        })
      );
    }
  }

  private async sendEmail(
    tenant: Tenant,
    sellerId: string,
    logContext: TenantAlertParams["logContext"],
    spec: EmailAlertSpec
  ): Promise<void> {
    if (!this.emailClient || !tenant.canSendEmailAlert(spec.kind)) return;
    const emailTo = tenant.getEmailAlertAddress();
    if (!emailTo) return;

    await spec
      .send(this.emailClient, emailTo)
      .then(async (res) => {
        if (res.success) {
          await this.eventRepo.log(
            new EventLog({
              sellerId,
              ...logContext,
              type: spec.successLog.type,
              message: spec.successLog.buildMessage(emailTo),
            })
          );
        }
      })
      .catch((err) => console.error("[TenantNotificationService] Error Email:", err));
  }
}
