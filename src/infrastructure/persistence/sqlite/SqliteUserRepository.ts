import { Database as DatabaseType } from "better-sqlite3";
import { IUserRepository } from "../../../application/interfaces/IUserRepository.js";
import { User } from "../../../domain/entities/User.js";
import { UserRoleType } from "../../../domain/value-objects/UserRole.js";

export class SqliteUserRepository implements IUserRepository {
  constructor(private readonly db: DatabaseType) {}

  public async findById(id: string): Promise<User | null> {
    const row = this.db.prepare("SELECT * FROM users WHERE id = ?").get(id) as any;
    if (!row) return null;
    return this.mapToDomain(row);
  }

  public async findByEmail(email: string): Promise<User | null> {
    const normalized = email.toLowerCase().trim();
    const row = this.db.prepare("SELECT * FROM users WHERE email = ?").get(normalized) as any;
    if (!row) return null;
    return this.mapToDomain(row);
  }

  public async findBySellerId(sellerId: string): Promise<User | null> {
    const row = this.db.prepare("SELECT * FROM users WHERE seller_id = ?").get(sellerId) as any;
    if (!row) return null;
    return this.mapToDomain(row);
  }

  public async save(user: User): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO users (id, email, password_hash, name, role, seller_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        email = excluded.email,
        password_hash = excluded.password_hash,
        name = excluded.name,
        role = excluded.role,
        seller_id = excluded.seller_id,
        updated_at = excluded.updated_at
    `);

    stmt.run(
      user.id,
      user.email,
      user.passwordHash,
      user.name,
      user.role,
      user.sellerId || null,
      user.createdAt.toISOString(),
      user.updatedAt.toISOString()
    );
  }

  public async getAll(): Promise<User[]> {
    const rows = this.db.prepare("SELECT * FROM users ORDER BY created_at DESC").all() as any[];
    return rows.map((r) => this.mapToDomain(r));
  }

  public async count(): Promise<number> {
    const row = this.db.prepare("SELECT COUNT(*) as count FROM users").get() as any;
    return row?.count || 0;
  }

  private mapToDomain(row: any): User {
    return new User({
      id: row.id,
      email: row.email,
      passwordHash: row.password_hash,
      name: row.name,
      role: row.role as UserRoleType,
      sellerId: row.seller_id || null,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    });
  }
}
