import { ILLMUsageRepository } from "../../interfaces/ILLMUsageRepository.js";

export class SetLLMSpendingLimitUseCase {
  constructor(private readonly usageRepo: ILLMUsageRepository) {}

  public execute(sellerId: string, limitUsd: number | null): void {
    if (limitUsd !== null && (limitUsd < 0 || !Number.isFinite(limitUsd))) {
      throw new Error("El límite debe ser un número positivo o null para eliminar.");
    }
    this.usageRepo.setSpendingLimit(sellerId, limitUsd);
  }
}
