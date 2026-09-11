import crypto from "node:crypto";
import { ITokenService, UserTokenPayload } from "../../application/interfaces/ITokenService.js";

export class JwtTokenService implements ITokenService {
  private readonly secret: string;

  constructor(secret?: string) {
    this.secret = secret || process.env.JWT_SECRET || "default_meli_bot_super_secret_key_123456";
  }

  private base64UrlEncode(str: string): string {
    return Buffer.from(str).toString("base64url");
  }

  private base64UrlDecode(str: string): string {
    return Buffer.from(str, "base64url").toString("utf8");
  }

  public generateToken(payload: UserTokenPayload, expiresInSeconds: number = 7 * 24 * 3600): string {
    const header = { alg: "HS256", typ: "JWT" };
    const exp = Math.floor(Date.now() / 1000) + expiresInSeconds;
    const body = { ...payload, exp };

    const encodedHeader = this.base64UrlEncode(JSON.stringify(header));
    const encodedBody = this.base64UrlEncode(JSON.stringify(body));
    const data = `${encodedHeader}.${encodedBody}`;

    const signature = crypto
      .createHmac("sha256", this.secret)
      .update(data)
      .digest("base64url");

    return `${data}.${signature}`;
  }

  public verifyToken(token: string): UserTokenPayload {
    const parts = token.split(".");
    if (parts.length !== 3) {
      throw new Error("Formato de token inválido.");
    }

    const [encodedHeader, encodedBody, signature] = parts;
    const data = `${encodedHeader}.${encodedBody}`;

    const expectedSignature = crypto
      .createHmac("sha256", this.secret)
      .update(data)
      .digest("base64url");

    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
      throw new Error("Firma de token inválida.");
    }

    const body = JSON.parse(this.base64UrlDecode(encodedBody));
    if (body.exp && body.exp < Math.floor(Date.now() / 1000)) {
      throw new Error("El token ha expirado.");
    }

    return {
      userId: body.userId,
      email: body.email,
      name: body.name,
      role: body.role,
      sellerId: body.sellerId,
    };
  }
}
