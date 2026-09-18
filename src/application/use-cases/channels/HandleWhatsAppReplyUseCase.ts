import { IWhatsAppClient } from "../interfaces/IWhatsAppClient.js";
import { IEventRepository } from "../interfaces/IEventRepository.js";
import { ApproveAnswerUseCase } from "./ApproveAnswerUseCase.js";
import { RejectAnswerUseCase } from "./RejectAnswerUseCase.js";
import { EventLog } from "../../domain/entities/EventLog.js";

export interface IncomingWhatsAppMessage {
  from: string;          // phone number E.164
  buttonReplyId?: string; // set when a quick-reply button was clicked
  text?: string;          // set when a free-text message was sent
}

export class HandleWhatsAppReplyUseCase {
  constructor(
    private readonly approveUseCase: ApproveAnswerUseCase,
    private readonly rejectUseCase: RejectAnswerUseCase,
    private readonly eventRepo: IEventRepository,
    private readonly whatsAppClient: IWhatsAppClient
  ) {}

  public async execute(msg: IncomingWhatsAppMessage): Promise<void> {
    const payload = msg.buttonReplyId || msg.text || "";

    if (payload.startsWith("approve_")) {
      const questionId = payload.replace("approve_", "");
      await this.approveUseCase.execute({ questionId, isViaWhatsapp: true });
      await this.whatsAppClient.sendTextMessage({
        to: msg.from,
        text: "✅ Respuesta publicada en Mercado Libre.",
      });
      return;
    }

    if (payload.startsWith("reject_")) {
      const questionId = payload.replace("reject_", "");
      await this.rejectUseCase.execute(questionId);
      await this.whatsAppClient.sendTextMessage({
        to: msg.from,
        text: "🗑️ Respuesta descartada.",
      });
      return;
    }

    if (payload.startsWith("claim_ack_")) {
      const claimId = payload.replace("claim_ack_", "");
      await this.eventRepo.log(
        new EventLog({
          sellerId: msg.from,
          type: "claim_ack",
          message: `📲 Vendedor acusó recibo del reclamo ${claimId} vía WhatsApp`,
        })
      );
      await this.whatsAppClient.sendTextMessage({
        to: msg.from,
        text: "✅ Recibido. Recordá responder el reclamo en Mercado Libre para evitar penalizaciones.",
      });
      return;
    }

    // Unrecognized payload — acknowledge receipt
    await this.whatsAppClient.sendTextMessage({
      to: msg.from,
      text: "Hola! Para gestionar preguntas y reclamos, usá los botones del mensaje anterior.",
    });
  }
}
