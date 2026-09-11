# Walkthrough: Fase 2 — Módulo de Autenticación & Roles (Super Admin vs Tenant)

En esta fase se implementó la capa de seguridad, autenticación y control de acceso multi-tenant basada en JWT.

---

## 🎯 Objetivos Cumplidos

1. **Entidad `User` y Roles en Dominio**:
   - Soporte para roles `super_admin` (acceso global a toda la plataforma) y `tenant` (acceso restringido a su propia tienda).
   - Métodos de validación y chequeo de permisos (`canAccessSeller()`).
2. **Casos de Uso de Autenticación**:
   - `RegisterUserUseCase`: Registro con hashing de contraseñas y emisión de JWT.
   - `LoginUserUseCase`: Verificación de credenciales y generación de claims.
   - `GetCurrentUserUseCase`: Perfil del usuario en sesión.
   - `SeedSuperAdminUseCase`: Inicialización automática del Super Admin (`admin@melibot.com` / `Admin123456!`).
3. **Seguridad e Infraestructura**:
   - `CryptoPasswordHasher`: Hashing nativo con `scrypt` y sal aleatoria.
   - `JwtTokenService`: Emisión y validación de tokens firmados HMAC-SHA256.
   - `SqliteUserRepository`: Tabla `users` con índices en `email` y `seller_id`.
4. **Guards y Aislamiento Multi-Tenant**:
   - Decoradores `authenticate` y `optionalAuthenticate` en Fastify.
   - `QuestionsController` bloquea con **HTTP 403 Forbidden** cualquier intento de un tenant de modificar o leer preguntas de otra tienda.
5. **Endpoints**:
   - `POST /api/auth/register`
   - `POST /api/auth/login`
   - `GET /api/auth/me`
