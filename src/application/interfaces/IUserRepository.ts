import { User } from "../../domain/entities/User.js";

export interface IUserRepository {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  findBySellerId(sellerId: string): Promise<User | null>;
  findAllBySellerId(sellerId: string): Promise<User[]>;
  findByActivationToken(token: string): Promise<User | null>;
  findPendingTenants(): Promise<User[]>;
  findActiveUnconnectedTenants(): Promise<User[]>;
  save(user: User): Promise<void>;
  delete(id: string): Promise<void>;
  getAll(): Promise<User[]>;
  count(): Promise<number>;
}
