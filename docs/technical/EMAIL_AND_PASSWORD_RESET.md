# 📧 Email (Resend) & Password Reset — Documentación Técnica

Documentación completa de la integración de **Resend** para envío de emails transaccionales y el flujo de **restablecimiento de contraseña** implementado en MELI AI Assistant.

---

## 📑 Tabla de Contenidos

1. [Integración Resend](#1-integración-resend)
2. [Variables de Entorno](#2-variables-de-entorno)
3. [Arquitectura del Email Client](#3-arquitectura-del-email-client)
4. [Templates de Email Disponibles](#4-templates-de-email-disponibles)
5. [Flujo de Reset de Contraseña](#5-flujo-de-reset-de-contraseña)
6. [Use Cases de Autenticación](#6-use-cases-de-autenticación)
7. [Endpoints HTTP](#7-endpoints-http)
8. [Frontend — Páginas Nuevas](#8-frontend--páginas-nuevas)
9. [Panel de Admin — Reset Manual](#9-panel-de-admin--reset-manual)
10. [Decisiones de Diseño](#10-decisiones-de-diseño)
11. [Pruebas](#11-pruebas)

---

## 1. Integración Resend

**Resend** es el proveedor de email transaccional del proyecto. Se usa para:

| Evento | Template | Destinatario |
|--------|----------|--------------|
| Creación de tenant | `sendTenantInvitation()` | Nuevo vendedor |
| Pregunta requiere revisión | `sendQuestionReviewAlert()` | Tenant configurado |
| Reclamo SLA crítico | `sendClaimSlaAlert()` | Tenant configurado |
| Reset de contraseña | `sendPasswordReset()` | Usuario que lo solicitó |
| Test de conectividad | `sendTestEmail()` | Email configurado en el portal |

### Modo Sandbox (desarrollo)

En modo sandbox, Resend solo permite enviar **al email con el que te registraste** en resend.com. El remitente debe ser `onboarding@resend.dev`.

Para producción, verificar un dominio propio en el panel de Resend y cambiar `EMAIL_FROM`.

---

## 2. Variables de Entorno

```ini
# API Key de Resend (obtenida de https://resend.com/api-keys)
RESEND_API_KEY=re_...

# Remitente (sandbox: onboarding@resend.dev / producción: alertas@tudominio.com)
EMAIL_FROM=MELI AI Assistant <onboarding@resend.dev>

# Habilitación global
EMAIL_ENABLED=true

# URL base para links en emails (reset de contraseña, activación)
APP_BASE_URL=http://localhost:5173
```

---

## 3. Arquitectura del Email Client

Sigue Clean Architecture — el dominio y los use cases no conocen a Resend:

```
src/
├── application/
│   └── interfaces/
│       └── IEmailClient.ts          ← Contrato (interfaz)
└── infrastructure/
    └── email/
        └── ResendEmailClient.ts     ← Implementación con SDK Resend
```

### `IEmailClient` — Interfaz

```typescript
export interface IEmailClient {
  sendQuestionReviewAlert(params: SendQuestionAlertParams): Promise<EmailSendResult>;
  sendClaimSlaAlert(params: SendClaimAlertParams): Promise<EmailSendResult>;
  sendTestEmail(params: SendTestEmailParams): Promise<EmailSendResult>;
  sendTenantInvitation(params: SendTenantInvitationParams): Promise<EmailSendResult>;
  sendPasswordReset(params: SendPasswordResetParams): Promise<EmailSendResult>;
}
```

### `ResendEmailClient` — Implementación

- Si `RESEND_API_KEY` no está configurada, simula el envío en consola (no falla).
- Todos los templates son dark-mode, CSS inline, compatibles con Gmail/Outlook/Apple Mail.

---

## 4. Templates de Email Disponibles

### 4.1 Activación de Cuenta (`buildTenantInvitationHtml`)
Badge azul "Activación de Cuenta", bienvenida personalizada, lista de funcionalidades, botón de activación con expiración 24h.

### 4.2 Alerta de Pregunta (`buildQuestionAlertHtml`)
Badge amarillo "Revisión Requerida", pregunta del comprador, respuesta sugerida por IA, motivo de derivación, botón directo al portal.

### 4.3 Alerta de Reclamo (`buildClaimAlertHtml`)
Badge rojo/naranja según urgencia, número de reclamo/orden, motivo del comprador, contador de horas restantes, botón para gestionar.

### 4.4 Reset de Contraseña (`buildPasswordResetHtml`)
Badge "Seguridad de la Cuenta", saludo personalizado, botón CTA de reset, aviso de expiración (60 min), nota de seguridad si no lo solicitó.

### 4.5 Test de Conectividad (`sendTestEmail`)
Confirmación de enlace exitoso entre el portal y Resend.

---

## 5. Flujo de Reset de Contraseña

### Auto-servicio (usuario)

```
Login → "¿Olvidaste tu contraseña?" → /forgot-password
  → POST /api/auth/forgot-password { email }
  → RequestPasswordResetUseCase:
      1. Busca user por email
      2. Si no existe → { ok: true } (silencioso, no revela existencia)
      3. Genera token: {crypto.randomBytes(32).hex}|{Date.now() + 3_600_000}
      4. user.setResetToken(token) → guarda en columna activation_token
      5. Envía email con link /reset-password/{token}
      6. Retorna { ok: true }
  → Frontend muestra "Revisá tu casilla de correo" (siempre)

Usuario hace clic en el link → /reset-password/:token
  → POST /api/auth/reset-password/:token { password }
  → ResetPasswordUseCase:
      1. findByActivationToken(token) → si no existe, error
      2. Parsea token: split("|") → extrae expiresAt
      3. Si expirado → limpia token, guarda, error "El link expiró"
      4. Si password < 6 chars → error
      5. Hash password → user.activate(hash) → limpia token, status=active
      6. Genera JWT → retorna { token, user }
  → Frontend guarda JWT en localStorage → redirect a /
```

### Admin-triggered (super admin)

```
AdminPage → botón "🔑 Resetear contraseña" en panel de tenant activo
  → POST /api/admin/reset-password { email }
  → Requiere: JWT de super admin (requireSuperAdmin guard)
  → Internamente llama a RequestPasswordResetUseCase
  → Tenant recibe email con link de reset

AdminPage → botón "↺ Reenviar" en fila de invitación pendiente
  → POST /api/admin/users/:userId/reset-password
  → Requiere: JWT de super admin
  → Busca user por userId, extrae email, llama RequestPasswordResetUseCase
```

### Diagrama de secuencia

```
Usuario          Frontend          Backend                    Resend
   |                |                 |                         |
   |──click link──►|                 |                         |
   |                |──POST /forgot──►|                         |
   |                |                 |──findByEmail()          |
   |                |                 |──setResetToken()        |
   |                |                 |──save()                 |
   |                |                 |──sendPasswordReset()───►|
   |                |                 |                         |──email──►[inbox]
   |                |◄──{ ok: true }──|                         |
   |◄──"Revisá tu inbox"──|           |                         |
   |                |                 |                         |
   |──click email──►/reset-password/token                       |
   |                |──POST /reset────►|                        |
   |                |                 |──findByActivationToken()|
   |                |                 |──validateExpiry()       |
   |                |                 |──hash(password)         |
   |                |                 |──user.activate()        |
   |                |                 |──generateToken()        |
   |                |◄──{ token, user }|                        |
   |                |──localStorage.setItem("token")            |
   |◄──redirect /──|                 |                         |
```

---

## 6. Use Cases de Autenticación

### `RequestPasswordResetUseCase`
**Ubicación:** `src/application/use-cases/auth/RequestPasswordResetUseCase.ts`

**Dependencias:** `IUserRepository`, `IEmailClient`

**DTO de entrada:**
```typescript
interface RequestPasswordResetDTO {
  email: string;
  baseUrl?: string; // para construir el link del email
}
```

**Comportamiento:** Siempre retorna `{ ok: true }`. Si el email no existe, no hace nada (prevención de enumeración de usuarios). Los errores de envío de email se capturan con `.catch()` — el flujo de auth no se interrumpe.

---

### `ResetPasswordUseCase`
**Ubicación:** `src/application/use-cases/auth/ResetPasswordUseCase.ts`

**Dependencias:** `IUserRepository`, `IPasswordHasher`, `ITokenService`

**DTO de entrada:**
```typescript
interface ResetPasswordDTO {
  token: string;
  password: string;
}
```

**DTO de salida:**
```typescript
interface ResetPasswordResponseDTO {
  token: string; // JWT para auto-login
  user: { id, email, name, role, status };
}
```

**Errores posibles:**
- `"Token inválido o expirado."` — no encontrado en DB o formato incorrecto
- `"El link expiró. Solicitá uno nuevo."` — timestamp superado
- `"La contraseña debe tener al menos 6 caracteres."`

---

### Método `User.setResetToken()`
**Ubicación:** `src/domain/entities/User.ts`

```typescript
public setResetToken(token: string): void {
  this.activationToken = token;
  this.updatedAt = new Date();
}
```

Reutiliza el campo `activationToken` de la DB. No hay colisión con el flujo de activación porque:
- Un user `pending` tiene `activationToken` con el link de activación — no puede loguearse ni pedir reset.
- Un user `active` siempre tiene `activationToken = null` — puede loguearse y puede pedir reset.

**Formato del token:** `{64 chars hex}|{Unix ms timestamp de expiración}`

Ejemplo: `a3f8c2...b7e1|1789012345678`

---

## 7. Endpoints HTTP

### Auth (públicos)

| Método | Path | Body | Respuesta | Descripción |
|--------|------|------|-----------|-------------|
| POST | `/api/auth/forgot-password` | `{ email }` | `{ ok: true }` siempre | Solicitar reset |
| POST | `/api/auth/reset-password/:token` | `{ password }` | `{ token, user }` o 400 | Confirmar reset |

### Admin (requiere JWT super admin)

| Método | Path | Body | Respuesta | Descripción |
|--------|------|------|-----------|-------------|
| POST | `/api/admin/reset-password` | `{ email }` | `{ ok: true }` | Reset por email (tenants activos) |
| POST | `/api/admin/users/:userId/reset-password` | — | `{ ok: true, email }` | Reset por userId (invitaciones pendientes) |

### Tenant (requiere JWT)

| Método | Path | Body | Respuesta | Descripción |
|--------|------|------|-----------|-------------|
| POST | `/api/tenant/channels/email/test` | `{ email }` | `{ ok: true, messageId }` | Test de conectividad Resend |

---

## 8. Frontend — Páginas Nuevas

### `ForgotPasswordPage` (`/forgot-password`)
**Archivo:** `client/src/pages/ForgotPasswordPage.tsx`
**CSS:** Reutiliza `LoginPage.css` — mismo glass panel dark mode.

- Un campo email, botón "Enviar link de recuperación".
- Al submit: llama `POST /api/auth/forgot-password`, siempre muestra "Revisá tu casilla de correo" (sin revelar si el email existe).
- Link "← Volver al login".

### `ResetPasswordPage` (`/reset-password/:token`)
**Archivo:** `client/src/pages/ResetPasswordPage.tsx`
**CSS:** Reutiliza `ActivatePage.css`.

- Campos "Nueva contraseña" + "Repetir contraseña".
- Validación en cliente: min 6 chars, las dos deben coincidir.
- Al éxito: guarda JWT en `localStorage`, redirige a `/` (el router lleva al dashboard según el rol).

### Cambios en páginas existentes

**`LoginPage.tsx`:** Link "¿Olvidaste tu contraseña?" en el label del campo password, navega a `/forgot-password`.

**`App.tsx`:** Dos nuevas rutas públicas (sin `PrivateRoute`):
```tsx
<Route path="/forgot-password" element={<ForgotPasswordPage />} />
<Route path="/reset-password/:token" element={<ResetPasswordPage />} />
```

---

## 9. Panel de Admin — Reset Manual

**`AdminPage.tsx`** tiene dos puntos de acción:

### Invitaciones pendientes (izquierda)
Cada fila muestra el badge "Pendiente" + botón "↺ Reenviar". Al hacer clic:
- Llama `POST /api/admin/users/:userId/reset-password`
- Toast de confirmación 4 segundos

### Tenant activo seleccionado (derecha, panel de permisos)
Botón "🔑 Resetear contraseña" debajo de "Guardar permisos". Visible solo si el tenant tiene email. Al hacer clic:
- Llama `POST /api/admin/reset-password { email }`
- Toast de confirmación 4 segundos
- El toast se limpia automáticamente al seleccionar otro tenant

---

## 10. Decisiones de Diseño

### Por qué reutilizar `activationToken` en lugar de un campo nuevo

- Cero cambios en el schema de SQLite (sin migraciones).
- No hay colisión: users `pending` no pueden pedir reset, users `active` tienen el campo en null.
- La expiración va embebida en el token (`hex|timestamp`), no requiere columna extra.

**Trade-off aceptado:** Semánticamente el campo hace dos cosas. Registrado como deuda técnica para cuando se agregue una columna `reset_token` dedicada.

### Por qué `forgot-password` siempre responde `{ ok: true }`

Previene enumeración de usuarios: un atacante no puede saber si un email está registrado por la respuesta del endpoint. El frontend tampoco diferencia — siempre muestra el mismo mensaje.

### Por qué el token va en la URL path y no como query param

Simplicidad de implementación y consistencia con el flujo de activación (`/activate/:token`). Trade-off: el token aparece en logs de servidor. Mitigación: el token expira en 1 hora y se invalida al usarse.

### Auto-login post-reset

Después de resetear, el backend retorna el JWT directamente (igual que el flujo de activación). El frontend lo guarda y redirige — el usuario no necesita volver a loguearse. Esto reduce fricción y es el comportamiento esperado en aplicaciones modernas.

---

## 11. Pruebas

### Test rápido de Resend (standalone)

```powershell
# Con el servidor NO corriendo — script directo
npx tsx scripts/test-resend.ts
```

El script envía un email a `asistentemercadol@gmail.com` (el email registrado en Resend).

### Test del endpoint HTTP

```powershell
# Con el servidor corriendo (npm run dev)
Invoke-RestMethod -Method POST `
  -Uri "http://localhost:3000/api/tenant/channels/email/test" `
  -ContentType "application/json" `
  -Body '{"email": "asistentemercadol@gmail.com"}'
```

### Test del flujo de reset

```powershell
# 1. Pedir reset
Invoke-RestMethod -Method POST `
  -Uri "http://localhost:3000/api/auth/forgot-password" `
  -ContentType "application/json" `
  -Body '{"email": "asistentemercadol@gmail.com"}'

# 2. Revisar el email recibido, copiar el token del link
# 3. Confirmar el reset (reemplazar TOKEN con el token real)
Invoke-RestMethod -Method POST `
  -Uri "http://localhost:3000/api/auth/reset-password/TOKEN" `
  -ContentType "application/json" `
  -Body '{"password": "nuevaPassword123"}'
```

### Tests unitarios

```powershell
# Correr todos los tests
npx vitest run

# Tests específicos del reset
npx vitest run src/tests/User.resetToken.test.ts
npx vitest run src/tests/RequestPasswordResetUseCase.test.ts
npx vitest run src/tests/ResetPasswordUseCase.test.ts
```

**Total: 256 tests, 55 archivos — todos en verde.**

---

## Limitaciones conocidas y trabajo futuro

| Limitación | Impacto | Solución futura |
|------------|---------|-----------------|
| Token de reset en columna `activation_token` | Deuda semántica | Agregar columna `reset_token` + `reset_token_expires_at` |
| Sin rate limiting en `/forgot-password` | Riesgo de spam/abuso en producción | Agregar `@fastify/rate-limit` en ese endpoint |
| Token visible en URL y logs | Riesgo bajo (expira en 1h) | Mover token a query param o header |
| Sandbox Resend limita destinatario | Solo para desarrollo | Verificar dominio propio en Resend para producción |
