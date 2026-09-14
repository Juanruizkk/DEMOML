import { User } from "../../domain/entities/User.js";

export interface IUserRepository {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  findBySellerId(sellerId: string): Promise<User | null>;
  findByActivationToken(token: string): Promise<User | null>;
  findPendingTenants(): Promise<User[]>;
  save(user: User): Promise<void>;
  getAll(): Promise<User[]>;
  count(): Promise<number>;
}
