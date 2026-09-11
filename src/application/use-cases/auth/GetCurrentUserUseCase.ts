import { IUserRepository } from "../../interfaces/IUserRepository.js";
import { UserProps } from "../../../domain/entities/User.js";

export class GetCurrentUserUseCase {
  constructor(private readonly userRepo: IUserRepository) {}

  public async execute(userId: string): Promise<Omit<UserProps, "passwordHash">> {
    const user = await this.userRepo.findById(userId);
    if (!user) {
      throw new Error("Usuario no encontrado.");
    }
    return user.toJSON();
  }
}
