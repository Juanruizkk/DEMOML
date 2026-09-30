import { eq, desc, sql, and } from 'drizzle-orm';
import { DrizzleDB } from '../drizzle/db.js';
import { users } from '../drizzle/schema.js';
import { IUserRepository } from '../../../application/interfaces/IUserRepository.js';
import { User } from '../../../domain/entities/User.js';
import { UserRoleType } from '../../../domain/value-objects/UserRole.js';

export class PostgresUserRepository implements IUserRepository {
  constructor(private readonly db: DrizzleDB) {}

  public async findById(id: string): Promise<User | null> {
    const [row] = await this.db.select().from(users).where(eq(users.id, id));
    return row ? this.map(row) : null;
  }

  public async findByEmail(email: string): Promise<User | null> {
    const [row] = await this.db.select().from(users).where(eq(users.email, email.toLowerCase().trim()));
    return row ? this.map(row) : null;
  }

  public async findBySellerId(sellerId: string): Promise<User | null> {
    const [row] = await this.db.select().from(users).where(eq(users.sellerId, sellerId));
    return row ? this.map(row) : null;
  }

  public async findAllBySellerId(sellerId: string): Promise<User[]> {
    const rows = await this.db.select().from(users)
      .where(eq(users.sellerId, sellerId))
      .orderBy(desc(users.createdAt));
    return rows.map(r => this.map(r));
  }

  public async findByActivationToken(token: string): Promise<User | null> {
    const [row] = await this.db.select().from(users).where(eq(users.activationToken, token));
    return row ? this.map(row) : null;
  }

  public async findPendingTenants(): Promise<User[]> {
    const rows = await this.db.select().from(users)
      .where(and(eq(users.role, 'tenant'), eq(users.status, 'pending')))
      .orderBy(desc(users.createdAt));
    return rows.map(r => this.map(r));
  }

  public async findActiveUnconnectedTenants(): Promise<User[]> {
    const rows = await this.db.select().from(users)
      .where(and(eq(users.role, 'tenant'), eq(users.status, 'active'), sql`${users.sellerId} IS NULL`))
      .orderBy(desc(users.createdAt));
    return rows.map(r => this.map(r));
  }

  public async save(user: User): Promise<void> {
    await this.db.insert(users).values({
      id: user.id,
      email: user.email,
      passwordHash: user.passwordHash,
      name: user.name,
      role: user.role,
      sellerId: user.sellerId ?? null,
      status: user.status,
      activationToken: user.activationToken ?? null,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    }).onConflictDoUpdate({
      target: users.id,
      set: {
        email: user.email,
        passwordHash: user.passwordHash,
        name: user.name,
        role: user.role,
        sellerId: user.sellerId ?? null,
        status: user.status,
        activationToken: user.activationToken ?? null,
        updatedAt: user.updatedAt,
      },
    });
  }

  public async delete(id: string): Promise<void> {
    await this.db.delete(users).where(eq(users.id, id));
  }

  public async getAll(): Promise<User[]> {
    const rows = await this.db.select().from(users).orderBy(desc(users.createdAt));
    return rows.map(r => this.map(r));
  }

  public async count(): Promise<number> {
    const [{ count }] = await this.db.select({ count: sql<number>`count(*)::int` }).from(users);
    return count;
  }

  private map(row: typeof users.$inferSelect): User {
    return new User({
      id: row.id,
      email: row.email,
      passwordHash: row.passwordHash,
      name: row.name,
      role: row.role as UserRoleType,
      sellerId: row.sellerId ?? null,
      status: (row.status ?? 'active') as any,
      activationToken: row.activationToken ?? null,
      createdAt: row.createdAt ?? new Date(),
      updatedAt: row.updatedAt ?? new Date(),
    });
  }
}
