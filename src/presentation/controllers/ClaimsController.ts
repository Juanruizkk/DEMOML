import { FastifyRequest, FastifyReply } from "fastify";
import { ListClaimsUseCase } from "../../application/use-cases/claims/ListClaimsUseCase.js";
import { SimulateClaimUseCase, SimulateClaimParams } from "../../application/use-cases/claims/SimulateClaimUseCase.js";
import { SetClaimStatusUseCase, ClaimStatusAction } from "../../application/use-cases/claims/SetClaimStatusUseCase.js";
import { ClaimType } from "../../domain/entities/Claim.js";
import { paginateArray } from "../../domain/value-objects/Pagination.js";

export class ClaimsController {
  constructor(
    private readonly listClaimsUseCase: ListClaimsUseCase,
    private readonly simulateClaimUseCase: SimulateClaimUseCase,
    private readonly setClaimStatusUseCase: SetClaimStatusUseCase
  ) {}

  public getClaims = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = (request as any).user;
      const query = request.query as {
        seller_id?: string;
        status?: "opened" | "closed";
        sync?: string;
        page?: string | number;
        limit?: string | number;
      };

      const sellerId = user?.role === "tenant"
        ? (user.sellerId || "")
        : (query.seller_id || process.env.ML_SELLER_ID || "3680586616");

      if (!sellerId) {
        return reply.status(400).send({ error: "No hay una tienda vinculada a este usuario." });
      }
      const page = Number(query.page) || 1;
      const limit = Number(query.limit) || 20;

      const { claims, metrics } = await this.listClaimsUseCase.execute({
        sellerId,
        status: query.status,
        sync: query.sync === "true",
      });

      const { data: paginatedClaims, pagination } = paginateArray(claims, page, limit);

      return reply.send({
        success: true,
        pagination,
        claims: paginatedClaims,
        metrics,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return reply.status(500).send({ error: `Error al obtener reclamos: ${msg}` });
    }
  };

  public simulate = async (
    request: FastifyRequest<{ Body: Omit<SimulateClaimParams, "sellerId"> & { sellerId?: string; type?: ClaimType } }>,
    reply: FastifyReply
  ) => {
    try {
      const body = request.body || {};
      const sellerId = body.sellerId || process.env.ML_SELLER_ID || "3680586616";

      const claim = await this.simulateClaimUseCase.execute({ ...body, sellerId });

      const now = new Date();
      return reply.status(201).send({
        success: true,
        claim: {
          id: claim.id,
          orderId: claim.orderId,
          type: claim.type,
          reason: claim.reason,
          dueDate: claim.dueDate.toISOString(),
          remainingHours: claim.getRemainingHours(now),
          urgency: claim.getUrgency(now),
        },
        message: "Reclamo simulado exitosamente",
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return reply.status(500).send({ error: `Error al simular reclamo: ${msg}` });
    }
  };

  private setStatus = (action: ClaimStatusAction, errorLabel: string) =>
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id: claimId } = (request.params as any) || {};
        const claim = await this.setClaimStatusUseCase.execute({ claimId, action });
        if (!claim) {
          return reply.status(404).send({ error: "Reclamo no encontrado." });
        }

        const response: Record<string, unknown> = { success: true, claimId, status: claim.status };
        if (action === "acknowledge") response.notifiedAt = claim.notifiedAt?.toISOString();
        if (action === "unacknowledge") response.notifiedAt = null;
        return reply.send(response);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return reply.status(500).send({ error: `${errorLabel}: ${msg}` });
      }
    };

  public acknowledge = this.setStatus("acknowledge", "Error al confirmar reclamo");
  public unacknowledge = this.setStatus("unacknowledge", "Error al devolver reclamo a pendientes");
  public closeClaim = this.setStatus("close", "Error al cerrar reclamo");
  public reopenClaim = this.setStatus("reopen", "Error al reabrir reclamo");
}
