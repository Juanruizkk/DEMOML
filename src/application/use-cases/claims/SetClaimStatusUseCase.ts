import { IClaimRepository } from "../../interfaces/IClaimRepository.js";
import { IEventRepository } from "../../interfaces/IEventRepository.js";
import { IRealtimeNotifier } from "../../interfaces/IRealtimeNotifier.js";
import { Claim } from "../../../domain/entities/Claim.js";
import { EventLog } from "../../../domain/entities/EventLog.js";

export type ClaimStatusAction = "acknowledge" | "unacknowledge" | "close" | "reopen";

const ACTION_CONFIG: Record<ClaimStatusAction, {
  apply: (claim: Claim) => void;
  eventType: string;
  eventMessage: (claimId: string) => string;
}> = {
  acknowledge: {
    apply: (claim) => claim.markNotified(),
    eventType: "claim_acknowledged",
    eventMessage: (id) => `✅ Operador marcó como en gestión el reclamo #${id}`,
  },
  unacknowledge: {
    apply: (claim) => claim.resetNotified(),
    eventType: "claim_unacknowledged",
    eventMessage: (id) => `↩ Operador devolvió a pendientes el reclamo #${id}`,
  },
  close: {
    apply: (claim) => claim.close(),
    eventType: "claim_closed",
    eventMessage: (id) => `🟢 Operador marcó como resuelto/cerrado el reclamo #${id}`,
  },
  reopen: {
    apply: (claim) => claim.reopen(),
    eventType: "claim_reopened",
    eventMessage: (id) => `🔄 Operador reabrió el reclamo #${id}`,
  },
};

export class SetClaimStatusUseCase {
  constructor(
    private readonly claimRepo: IClaimRepository,
    private readonly eventRepo: IEventRepository,
    private readonly sseNotifier: IRealtimeNotifier
  ) {}

  /** @returns el claim actualizado, o null si no existe. */
  public async execute(params: { claimId: string; action: ClaimStatusAction }): Promise<Claim | null> {
    const { claimId, action } = params;
    const claim = await this.claimRepo.findById(claimId);
    if (!claim) return null;

    const config = ACTION_CONFIG[action];
    config.apply(claim);
    await this.claimRepo.save(claim);

    await this.eventRepo.log(
      new EventLog({
        sellerId: claim.sellerId,
        type: config.eventType,
        message: config.eventMessage(claimId),
      })
    );

    this.sseNotifier.broadcastToSeller(claim.sellerId, "claim_updated", {
      claim_id: claimId,
      status: claim.status,
      ...(action === "acknowledge" ? { notified_at: claim.notifiedAt?.toISOString() } : {}),
      ...(action === "unacknowledge" ? { notified_at: null } : {}),
    });

    return claim;
  }
}
