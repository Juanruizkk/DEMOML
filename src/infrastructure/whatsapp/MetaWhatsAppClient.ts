import {
  IWhatsAppClient,
  SendWhatsAppTextDTO,
  SendWhatsAppButtonsDTO,
  SendWhatsAppTemplateDTO,
  WhatsAppCredentialsOverride,
} from "../../application/interfaces/IWhatsAppClient.js";

const META_API_BASE = "https://graph.facebook.com/v21.0";

export class MetaWhatsAppClient implements IWhatsAppClient {
  private readonly defaultPhoneNumberId: string;
  private readonly defaultToken: string;

  constructor() {
    this.defaultPhoneNumberId = process.env.META_WA_PHONE_NUMBER_ID || "";
    this.defaultToken = process.env.META_WA_ACCESS_TOKEN || "";
  }

  private resolveCredentials(credentials?: WhatsAppCredentialsOverride): {
    apiUrl: string;
    token: string;
    configured: boolean;
  } {
    const phoneNumberId = credentials?.phoneNumberId || this.defaultPhoneNumberId;
    const token = credentials?.accessToken || this.defaultToken;
    const configured = Boolean(phoneNumberId && token);
    return {
      apiUrl: `${META_API_BASE}/${phoneNumberId}/messages`,
      token,
      configured,
    };
  }

  private formatPhone(phone: string): string {
    return phone.replace(/\D/g, "");
  }

  private async post(body: unknown, apiUrl: string, token: string): Promise<void> {
    const res = await fetch(apiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error(`[MetaWhatsAppClient] Error ${res.status}: ${err}`);
    }
  }

  public async sendTextMessage(dto: SendWhatsAppTextDTO): Promise<void> {
    const { apiUrl, token, configured } = this.resolveCredentials(dto.credentials);
    if (!configured) {
      console.warn("[MetaWhatsAppClient] No configurado. Mensaje de texto omitido.");
      return;
    }
    await this.post(
      {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: this.formatPhone(dto.to),
        type: "text",
        text: { body: dto.text },
      },
      apiUrl,
      token
    );
  }

  public async sendInteractiveButtons(dto: SendWhatsAppButtonsDTO): Promise<void> {
    const { apiUrl, token, configured } = this.resolveCredentials(dto.credentials);
    if (!configured) {
      console.warn("[MetaWhatsAppClient] No configurado. Mensaje con botones omitido.");
      return;
    }
    await this.post(
      {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: this.formatPhone(dto.to),
        type: "interactive",
        interactive: {
          type: "button",
          body: { text: dto.bodyText },
          action: {
            buttons: dto.buttons.map((b) => ({
              type: "reply",
              reply: { id: b.id, title: b.title.slice(0, 20) },
            })),
          },
        },
      },
      apiUrl,
      token
    );
  }

  public async sendTemplate(dto: SendWhatsAppTemplateDTO): Promise<void> {
    const { apiUrl, token, configured } = this.resolveCredentials(dto.credentials);
    if (!configured) {
      console.warn("[MetaWhatsAppClient] No configurado. Template omitido.");
      return;
    }
    await this.post(
      {
        messaging_product: "whatsapp",
        to: this.formatPhone(dto.to),
        type: "template",
        template: {
          name: dto.templateName,
          language: { code: dto.languageCode },
          components: dto.parameters.length
            ? [
                {
                  type: "body",
                  parameters: dto.parameters.map((p) => ({ type: "text", text: p })),
                },
              ]
            : [],
        },
      },
      apiUrl,
      token
    );
  }
}
