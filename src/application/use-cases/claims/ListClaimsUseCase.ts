import { IClaimRepository } from "../../interfaces/IClaimRepository.js";
import { IMeliClient } from "../../interfaces/IMeliClient.js";
import { ProcessClaimUseCase } from "./ProcessClaimUseCase.js";

export interface EnrichedClaim {
  id: string;
  sellerId: string;
  orderId: string;
  type: string;
  stage: string;
  status: string;
  reason?: string;
  reasonDetail?: string;
  complainantMessage?: string;
  buyerId?: string;
  buyerNickname?: string;
  itemId?: string;
  itemTitle?: string;
  itemPrice?: number;
  itemQuantity?: number;
  actions: unknown[];
  dueDate: string;
  remainingHours: number;
  urgency: string;
  notifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ListClaimsResult {
  claims: EnrichedClaim[];
  metrics: {
    total: number;
    critical: number;
    high: number;
    normal: number;
    closed: number;
  };
}

export class ListClaimsUseCase {
  constructor(
    private readonly claimRepo: IClaimRepository,
    private readonly meliClient: IMeliClient,
    private readonly processClaimUseCase: ProcessClaimUseCase
  ) {}

  public async execute(params: {
    sellerId: string;
    status?: "opened" | "closed";
    sync?: boolean;
  }): Promise<ListClaimsResult> {
    const { sellerId, status, sync } = params;

    // Sincronización manual con MELI sólo si se solicita explícitamente
    if (sync) {
      try {
        const meliClaims = await this.meliClient.searchClaims(sellerId, "opened");
        for (const raw of meliClaims) {
          await this.processClaimUseCase.execute({ claimId: String(raw.id), sellerId });
        }
      } catch (syncErr) {
        // Si no tiene token o falla, continuar con los reclamos de la base de datos
      }
    }

    const claims = await this.claimRepo.listBySellerId(sellerId, status);

    const now = new Date();
    const enriched: EnrichedClaim[] = claims.map((c) => ({
      id: c.id,
      sellerId: c.sellerId,
      orderId: c.orderId,
      type: c.type,
      stage: c.stage,
      status: c.status,
      reason: c.reason,
      reasonDetail: c.reasonDetail,
      complainantMessage: c.complainantMessage,
      buyerId: c.buyerId,
      buyerNickname: c.buyerNickname,
      itemId: c.itemId,
      itemTitle: c.itemTitle,
      itemPrice: c.itemPrice,
      itemQuantity: c.itemQuantity,
      actions: c.actions,
      dueDate: c.dueDate.toISOString(),
      remainingHours: c.getRemainingHours(now),
      urgency: c.getUrgency(now),
      notifiedAt: c.notifiedAt ? c.notifiedAt.toISOString() : null,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
    }));

    // Sort by urgency/due date ascending
    enriched.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

    return {
      claims: enriched,
      metrics: {
        total: enriched.length,
        critical: enriched.filter((c) => c.urgency === "critical" && c.status === "opened").length,
        high: enriched.filter((c) => c.urgency === "high" && c.status === "opened").length,
        normal: enriched.filter((c) => c.urgency === "normal" && c.status === "opened").length,
        closed: enriched.filter((c) => c.status === "closed").length,
      },
    };
  }
}
