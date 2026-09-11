import { UserRoleType } from "../../domain/value-objects/UserRole.js";

export interface UserTokenPayload {
  userId: string;
  email: string;
  name: string;
  role: UserRoleType;
  sellerId?: string | null;
}

export interface ITokenService {
  generateToken(payload: UserTokenPayload): string;
  verifyToken(token: string): UserTokenPayload;
}
