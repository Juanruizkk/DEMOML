import crypto from "node:crypto";
import { IPasswordHasher } from "../../application/interfaces/IPasswordHasher.js";

export class CryptoPasswordHasher implements IPasswordHasher {
  private readonly keyLength = 64;

  public async hash(password: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const salt = crypto.randomBytes(16).toString("hex");
      crypto.scrypt(password, salt, this.keyLength, (err, derivedKey) => {
        if (err) return reject(err);
        resolve(`${salt}:${derivedKey.toString("hex")}`);
      });
    });
  }

  public async compare(password: string, hash: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const [salt, key] = hash.split(":");
      if (!salt || !key) return resolve(false);

      const keyBuffer = Buffer.from(key, "hex");
      crypto.scrypt(password, salt, this.keyLength, (err, derivedKey) => {
        if (err) return reject(err);
        resolve(crypto.timingSafeEqual(keyBuffer, derivedKey));
      });
    });
  }
}
