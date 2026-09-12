import { Claim, ClaimStatus } from "../../domain/entities/Claim.js";

export interface IClaimRepository {
  save(claim: Claim): Promise<void>;
  findById(id: string): Promise<Claim | null>;
  listBySellerId(sellerId: string, status?: ClaimStatus): Promise<Claim[]>;
}
