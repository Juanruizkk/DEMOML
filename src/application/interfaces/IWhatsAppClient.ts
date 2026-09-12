export interface WhatsAppCredentialsOverride {
  phoneNumberId?: string;
  accessToken?: string;
}

export interface SendWhatsAppTextDTO {
  to: string;
  text: string;
  credentials?: WhatsAppCredentialsOverride;
}

export interface SendWhatsAppButtonsDTO {
  to: string;
  bodyText: string;
  buttons: Array<{ id: string; title: string }>;
  credentials?: WhatsAppCredentialsOverride;
}

export interface SendWhatsAppTemplateDTO {
  to: string;
  templateName: string;
  languageCode: string;
  parameters: string[];
  credentials?: WhatsAppCredentialsOverride;
}

export interface IWhatsAppClient {
  sendTextMessage(dto: SendWhatsAppTextDTO): Promise<void>;
  sendInteractiveButtons(dto: SendWhatsAppButtonsDTO): Promise<void>;
  sendTemplate(dto: SendWhatsAppTemplateDTO): Promise<void>;
}
