export interface SendWhatsAppTextDTO {
  to: string; // E.164, e.g. "+5491112345678"
  text: string;
}

export interface SendWhatsAppButtonsDTO {
  to: string;
  bodyText: string;
  buttons: Array<{ id: string; title: string }>; // title max 20 chars
}

export interface SendWhatsAppTemplateDTO {
  to: string;
  templateName: string;
  languageCode: string;
  parameters: string[];
}

export interface IWhatsAppClient {
  sendTextMessage(dto: SendWhatsAppTextDTO): Promise<void>;
  sendInteractiveButtons(dto: SendWhatsAppButtonsDTO): Promise<void>;
  sendTemplate(dto: SendWhatsAppTemplateDTO): Promise<void>;
}
