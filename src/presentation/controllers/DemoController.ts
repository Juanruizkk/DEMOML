import { FastifyRequest, FastifyReply } from "fastify";
import { SimulateQuestionUseCase } from "../../application/use-cases/SimulateQuestionUseCase.js";
import { IClaimRepository } from "../../application/interfaces/IClaimRepository.js";
import { IEventRepository } from "../../application/interfaces/IEventRepository.js";
import { IRealtimeNotifier } from "../../application/interfaces/IRealtimeNotifier.js";
import { Claim, ClaimType, ClaimAction } from "../../domain/entities/Claim.js";
import { EventLog } from "../../domain/entities/EventLog.js";

interface DemoControllerDeps {
  simulateQuestionUseCase: SimulateQuestionUseCase;
  claimRepo: IClaimRepository;
  eventRepo: IEventRepository;
  sseNotifier: IRealtimeNotifier;
  sellerId: string;
}

export class DemoController {
  private readonly simulateQuestion: SimulateQuestionUseCase;
  private readonly claimRepo: IClaimRepository;
  private readonly eventRepo: IEventRepository;
  private readonly sseNotifier: IRealtimeNotifier;
  private readonly sellerId: string;

  constructor(deps: DemoControllerDeps) {
    this.simulateQuestion = deps.simulateQuestionUseCase;
    this.claimRepo = deps.claimRepo;
    this.eventRepo = deps.eventRepo;
    this.sseNotifier = deps.sseNotifier;
    this.sellerId = deps.sellerId;
  }

  seed = async (_req: FastifyRequest, reply: FastifyReply) => {
    const questionPresets = [
      "Hola, ¿tienen stock disponible para enviar hoy a CABA?",
      "¿El producto viene con garantía oficial? ¿Cuánto tiempo?",
      "¿Cuál es el precio final con envío incluido a Rosario?",
      "¿Hacen factura A para empresa?",
      "¿Tiene manual en español?",
      "Pasame tu número de WhatsApp para coordinar la entrega",
    ];

    const claimPresets: Array<{ type: ClaimType; reason: string; hoursUntilDue: number }> = [
      { type: "med_pdd", reason: "Producto defectuoso — no enciende al conectar la corriente", hoursUntilDue: 8 },
      { type: "med_pnr", reason: "Paquete demorado — no recibí el envío después de 12 días", hoursUntilDue: 20 },
      { type: "return",  reason: "El producto llegó diferente al de la publicación",           hoursUntilDue: 48 },
    ];

    const seededQuestions: string[] = [];
    for (const text of questionPresets) {
      try {
        await this.simulateQuestion.execute({ text, sellerId: this.sellerId });
        seededQuestions.push(text);
      } catch (err) {
        console.error(`[DemoController] Error simulando pregunta: ${text}`, err);
      }
    }

    const seededClaims: string[] = [];
    const now = new Date();
    for (const preset of claimPresets) {
      try {
        const claimId = String(5100000000 + Math.floor(Math.random() * 90000000));
        const orderId = String(2000000000 + Math.floor(Math.random() * 900000000));
        const dueDate = new Date(now.getTime() + preset.hoursUntilDue * 60 * 60 * 1000);
        const actions: ClaimAction[] = [{ action: "respond_claim", dueDate, mandatory: true }];

        const claim = new Claim({
          id: claimId,
          sellerId: this.sellerId,
          orderId,
          type: preset.type,
          stage: "claim",
          status: "opened",
          reason: preset.reason,
          buyerId: "3677130936",
          actions,
          dueDate,
          createdAt: now,
          updatedAt: now,
        });

        await this.claimRepo.save(claim);
        await this.eventRepo.log(new EventLog({
          sellerId: this.sellerId,
          type: "claim_received",
          message: `🎬 [Demo] Reclamo #${claimId} — ${preset.type.toUpperCase()}, SLA: ${preset.hoursUntilDue}hs`,
        }));
        this.sseNotifier.broadcastToSeller(this.sellerId, "claim_received", {
          claim_id: claimId, order_id: orderId, type: claim.type,
          urgency: claim.getUrgency(now), remaining_hours: claim.getRemainingHours(now),
        });
        seededClaims.push(claimId);
      } catch (err) {
        console.error(`[DemoController] Error simulando reclamo:`, err);
      }
    }

    return reply.send({
      ok: true,
      message: `${seededQuestions.length} preguntas y ${seededClaims.length} reclamos demo generados`,
      questions: seededQuestions,
      claims: seededClaims,
    });
  };
}
