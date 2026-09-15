import { ILLMUsageRepository } from "../../interfaces/ILLMUsageRepository.js";

export class SetLLMSpendingLimitUseCase {
  constructor(private readonly usageRepo: ILLMUsageRepository) {}

  public async execute(sellerId: string, limitUsd: number | null): Promise<void> {
    if (limitUsd !== null && (limitUsd < 0 || !Number.isFinite(limitUsd))) {
      throw new Error("El límite debe ser un número positivo o null para eliminar.");
    }
    await this.usageRepo.setSpendingLimit(sellerId, limitUsd);
  }
}
