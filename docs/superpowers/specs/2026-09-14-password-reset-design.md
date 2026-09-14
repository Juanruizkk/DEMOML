# Password Reset — Spec

**Fecha:** 2026-09-14  
**Estado:** Aprobado

---

## Contexto

El flujo de creación de tenants desde el panel de super admin ya existe. Faltaba el reset de contraseña para usuarios que olvidan su clave, y la capacidad del admin de disparar ese reset manualmente.

---

## Alcance

- Auto-servicio: el usuario va al login, hace clic en "Olvidé mi contraseña", ingresa su email y recibe un link de reset.
- Admin-triggered: el super admin puede disparar un reset desde el panel de tenants, lo que envía el email al usuario automáticamente.
- Al resetear exitosamente, el usuario queda logueado directo (JWT en localStorage) y es redirigido al dashboard.

---

## Decisiones de Diseño

### Token de reset reutiliza `activationToken`

No se agrega ninguna columna nueva a SQLite. El campo `activationToken` de `User` se reutiliza con un formato que embebe la expiración:

```
{crypto.randomBytes(32).toString('hex')}|{Date.now() + 3_600_000}
```

**Sin colisión posible:** los usuarios `pending` tienen `activationToken` activo pero no pueden loguearse ni pedir reset. Los usuarios `active` siempre tienen `activationToken = null` hasta que se genere un reset.

Al verificar, se parsea el string, se compara `Date.now() > expiresAt` y si expiró se responde error. El método `user.activate()` ya existente limpia el token al resetear.

### Expiración: 1 hora

### Endpoint `forgot-password` siempre responde 200

No se revela si el email existe en el sistema (prevención de enumeración de usuarios).

---

## Backend

### Cambios en `User` (dominio)

Nuevo método `setResetToken(token: string)`:
```ts
public setResetToken(token: string): void {
  this.activationToken = token;
  this.updatedAt = new Date();
}
```

No se toca la interfaz `IUserRepository` ni `SqliteUserRepository` — `findByActivationToken` ya busca por esa columna y sirve para ambos casos.

### `RequestPasswordResetUseCase`

**Ubicación:** `src/application/use-cases/auth/RequestPasswordResetUseCase.ts`

**Dependencias:** `IUserRepository`, `IEmailClient`

**Lógica:**
1. Recibe `{ email: string }`.
2. Busca user por email. Si no existe, retorna OK sin error (silencioso).
3. Genera token: `{randomHex}|{Date.now() + 3_600_000}`.
4. Llama `user.setResetToken(token)`, guarda.
5. Llama `emailClient.sendPasswordReset({ to, name, resetUrl, expiresInMinutes: 60 })`.
6. Retorna `{ ok: true }`.

### `ResetPasswordUseCase`

**Ubicación:** `src/application/use-cases/auth/ResetPasswordUseCase.ts`

**Dependencias:** `IUserRepository`, `IPasswordHasher`, `ITokenService`

**Lógica:**
1. Recibe `{ token: string, password: string }`.
2. Valida `password.length >= 6`.
3. Busca user por `findByActivationToken(token)`. Si no existe → error "Token inválido o expirado."
4. Parsea el token: split por `|`, extrae `expiresAt`. Si `Date.now() > expiresAt` → limpia el token, guarda, error "El link expiró. Solicitá uno nuevo."
5. Hashea password, llama `user.activate(hash)` (limpia token, activa), guarda.
6. Genera JWT con `tokenService.generateToken(payload)`.
7. Retorna `{ token, user }` — misma forma que `ActivateTenantUseCase`.

### Endpoints en `AuthController`

| Método | Path | Auth | Body | Respuesta |
|--------|------|------|------|-----------|
| POST | `/api/auth/forgot-password` | ninguna | `{ email }` | `{ ok: true }` siempre |
| POST | `/api/auth/reset-password/:token` | ninguna | `{ password }` | `{ token, user }` o 400 |

### Endpoint en `AdminController`

| Método | Path | Auth | Respuesta |
|--------|------|------|-----------|
| POST | `/api/admin/users/:userId/reset-password` | super_admin | `{ ok: true, email }` |

**Lógica del admin endpoint:**
1. Busca user por `userId` via `userRepo.findById()`.
2. Si no existe → 404.
3. Llama `RequestPasswordResetUseCase.execute({ email: user.email })`.
4. Responde `{ ok: true, email: user.email }`.

`AdminController` recibe `RequestPasswordResetUseCase` como nueva dependencia en su constructor.

### Registro en `app.ts`

```ts
const requestPasswordResetUseCase = new RequestPasswordResetUseCase(userRepo, emailClient);
const resetPasswordUseCase = new ResetPasswordUseCase(userRepo, passwordHasher, tokenService);
```

Rutas nuevas:
```ts
app.post('/api/auth/forgot-password', authCtrl.forgotPassword);
app.post('/api/auth/reset-password/:token', authCtrl.resetPassword);
app.post('/api/admin/users/:userId/reset-password', { preHandler: requireSuperAdmin }, adminCtrl.resetUserPassword);
```

---

## Frontend

### `ForgotPasswordPage.tsx`

**Ruta:** `/forgot-password` (pública)

- Un campo email, botón "Enviar link".
- Al enviar, llama `POST /api/auth/forgot-password`.
- Siempre muestra: "Si el email está registrado, recibirás un link en los próximos minutos."
- Link "← Volver al login" debajo.
- Estética idéntica a `LoginPage.tsx`: glass panel, glows, mismo CSS reutilizado.

### `ResetPasswordPage.tsx`

**Ruta:** `/reset-password/:token` (pública)

- Estructura idéntica a `ActivatePage.tsx`.
- Título: "Restablecer contraseña", subtítulo: "Elegí una nueva contraseña para tu cuenta."
- Al éxito: guarda JWT en localStorage, redirige a `/` (el router lleva al dashboard según el rol).
- Diferencia con activate: no redirige a `/onboarding`.

### Cambios en `LoginPage.tsx`

En el `.field-label-row` del campo contraseña (ya existe en el JSX), agregar a la derecha:

```tsx
<a href="/forgot-password" className="forgot-link">¿Olvidaste tu contraseña?</a>
```

Estilo: `font-size: 12px; color: #64748b;` con hover `color: #94a3b8`.

### Cambios en `AdminPage.tsx`

En la lista/tabla de tenants, agregar botón "Resetear contraseña" por fila. Al hacer clic:
1. Llama `POST /api/admin/users/:userId/reset-password`.
2. Muestra toast: "Email de reset enviado a {email}".

### Cambios en `App.tsx`

```tsx
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage'))
const ResetPasswordPage  = lazy(() => import('./pages/ResetPasswordPage'))

// Rutas públicas:
<Route path="/forgot-password" element={<ForgotPasswordPage />} />
<Route path="/reset-password/:token" element={<ResetPasswordPage />} />
```

---

## Email

Ya implementado en `ResendEmailClient.buildPasswordResetHtml()` y `sendPasswordReset()`. No requiere cambios.

Asunto: `🔐 Restablecimiento de contraseña - MELI AI Assistant`  
Contenido: badge de seguridad, saludo personalizado, botón CTA, aviso de expiración 60min, nota de seguridad si no lo solicitó.

---

## Flujos completos

### Auto-servicio
```
Login → "¿Olvidaste tu contraseña?" → /forgot-password
→ POST /api/auth/forgot-password { email }
→ Email con link /reset-password/{token}
→ /reset-password/:token → POST /api/auth/reset-password/:token { password }
→ JWT guardado → redirect /
```

### Admin-triggered
```
AdminPage → botón "Resetear contraseña" en fila de tenant
→ POST /api/admin/users/:userId/reset-password
→ RequestPasswordResetUseCase → email al tenant
→ Toast de confirmación en el panel admin
→ Tenant recibe email con link /reset-password/{token}
```

---

## Archivos a crear

| Archivo | Tipo |
|---------|------|
| `src/application/use-cases/auth/RequestPasswordResetUseCase.ts` | nuevo |
| `src/application/use-cases/auth/ResetPasswordUseCase.ts` | nuevo |
| `client/src/pages/ForgotPasswordPage.tsx` | nuevo |
| `client/src/pages/ResetPasswordPage.tsx` | nuevo |

## Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| `src/domain/entities/User.ts` | agregar `setResetToken()` |
| `src/presentation/controllers/AuthController.ts` | agregar `forgotPassword`, `resetPassword` |
| `src/presentation/controllers/AdminController.ts` | agregar `resetUserPassword`, nueva dep |
| `src/app.ts` | instanciar use cases, registrar rutas |
| `client/src/App.tsx` | agregar rutas públicas |
| `client/src/pages/LoginPage.tsx` | agregar link "¿Olvidaste tu contraseña?" |
| `client/src/pages/AdminPage.tsx` | agregar botón por fila de tenant |
