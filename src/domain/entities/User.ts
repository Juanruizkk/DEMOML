import { UserRoleType } from "../value-objects/UserRole.js";

export interface UserProps {
  id: string;
  email: string;
  passwordHash: string;
  name: string;
  role: UserRoleType;
  sellerId?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export class User {
  public readonly id: string;
  public email: string;
  public passwordHash: string;
  public name: string;
  public role: UserRoleType;
  public sellerId?: string | null;
  public readonly createdAt: Date;
  public updatedAt: Date;

  constructor(props: UserProps) {
    this.id = props.id;
    this.email = this.normalizeEmail(props.email);
    this.passwordHash = props.passwordHash;
    this.name = props.name.trim();
    this.role = props.role;
    this.sellerId = props.sellerId || null;
    this.createdAt = props.createdAt || new Date();
    this.updatedAt = props.updatedAt || new Date();

    this.validate();
  }

  private normalizeEmail(email: string): string {
    return email.toLowerCase().trim();
  }

  private validate(): void {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(this.email)) {
      throw new Error(`Email inválido: ${this.email}`);
    }

    if (!this.name || this.name.length < 2) {
      throw new Error("El nombre debe tener al menos 2 caracteres.");
    }

    if (this.role === "tenant" && !this.sellerId) {
      // Un tenant puede crearse inicialmente sin sellerId hasta que vincula su cuenta con OAuth
    }
  }

  public isSuperAdmin(): boolean {
    return this.role === "super_admin";
  }

  public isDemo(): boolean {
    return this.role === "demo";
  }

  public canAccessSeller(sellerId: string): boolean {
    if (this.isSuperAdmin()) return true;
    return this.sellerId === sellerId;
  }

  public linkSeller(sellerId: string): void {
    this.sellerId = sellerId;
    this.updatedAt = new Date();
  }

  public toJSON(): Omit<UserProps, "passwordHash"> {
    return {
      id: this.id,
      email: this.email,
      name: this.name,
      role: this.role,
      sellerId: this.sellerId,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
