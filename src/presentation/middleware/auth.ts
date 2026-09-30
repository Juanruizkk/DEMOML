import { FastifyReply, FastifyRequest } from "fastify";
import { ITokenService } from "../../application/interfaces/ITokenService.js";

export interface AuthGuards {
  authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<unknown>;
  requireSuperAdmin: (request: FastifyRequest, reply: FastifyReply) => Promise<unknown>;
  requireDemo: (request: FastifyRequest, reply: FastifyReply) => Promise<unknown>;
  optionalAuthenticate: (request: FastifyRequest) => Promise<void>;
}

export function createAuthGuards(tokenService: ITokenService): AuthGuards {
  const authenticate = async (request: FastifyRequest, reply: FastifyReply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return reply.status(401).send({ error: "Token de autorización requerido." });
    }
    const token = authHeader.substring(7);
    try {
      const payload = tokenService.verifyToken(token);
      (request as any).user = payload;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return reply.status(401).send({ error: `Token inválido: ${message}` });
    }
  };

  const requireSuperAdmin = async (request: FastifyRequest, reply: FastifyReply) => {
    await authenticate(request, reply);
    if (reply.sent) return;
    const user = (request as any).user;
    if (!user || user.role !== "super_admin") {
      return reply.status(403).send({ error: "Acceso denegado: se requieren permisos de Super Administrador." });
    }
  };

  const requireDemo = async (request: FastifyRequest, reply: FastifyReply) => {
    await authenticate(request, reply);
    if (reply.sent) return;
    const user = (request as any).user;
    if (!user || (user.role !== "demo" && user.role !== "super_admin")) {
      return reply.status(403).send({ error: "Acceso denegado. Se requiere cuenta demo." });
    }
  };

  const optionalAuthenticate = async (request: FastifyRequest) => {
    const authHeader = request.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.substring(7);
      try {
        const payload = tokenService.verifyToken(token);
        (request as any).user = payload;
      } catch (err) {
        // ignored
      }
    }
  };

  return { authenticate, requireSuperAdmin, requireDemo, optionalAuthenticate };
}
