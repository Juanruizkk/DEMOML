import {
  IWhatsAppClient,
  SendWhatsAppTextDTO,
  SendWhatsAppButtonsDTO,
  SendWhatsAppTemplateDTO,
} from "../../application/interfaces/IWhatsAppClient.js";

export class MetaWhatsAppClient implements IWhatsAppClient {
  private readonly apiUrl: string;
  private readonly token: string;

  constructor() {
    const phoneNumberId = process.env.META_WA_PHONE_NUMBER_ID || "";
    this.apiUrl = `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`;
    this.token = process.env.META_WA_ACCESS_TOKEN || "";
  }

  private isConfigured(): boolean {
    return Boolean(this.token && process.env.META_WA_PHONE_NUMBER_ID);
  }

  private formatPhone(phone: string): string {
    return phone.replace(/\D/g, "");
  }

  private async post(body: unknown): Promise<void> {
    const res = await fetch(this.apiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.token}`,
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
    if (!this.isConfigured()) {
      console.warn("[MetaWhatsAppClient] No configurado. Mensaje de texto omitido.");
      return;
    }
    await this.post({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: this.formatPhone(dto.to),
      type: "text",
      text: { body: dto.text },
    });
  }

  public async sendInteractiveButtons(dto: SendWhatsAppButtonsDTO): Promise<void> {
    if (!this.isConfigured()) {
      console.warn("[MetaWhatsAppClient] No configurado. Mensaje con botones omitido.");
      return;
    }
    await this.post({
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
    });
  }

  public async sendTemplate(dto: SendWhatsAppTemplateDTO): Promise<void> {
    if (!this.isConfigured()) {
      console.warn("[MetaWhatsAppClient] No configurado. Template omitido.");
      return;
    }
    await this.post({
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
    });
  }
}
