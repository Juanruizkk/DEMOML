# Referencia de API: MELI AI Assistant

Todos los endpoints HTTP del backend Fastify con TypeScript. Autenticación: JWT Bearer Token (HMAC-SHA256).

---

## Resumen de Rutas

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| `POST` | `/api/auth/register` | No | Registro de usuario |
| `POST` | `/api/auth/login` | No | Login, devuelve JWT |
| `GET` | `/api/auth/me` | JWT | Perfil del usuario en sesión |
| `GET` | `/api/auth/onboarding-status` | JWT | Estado de conexión con MELI |
| `GET` | `/api/auth/meli-auth-url` | Opcional | URL de autorización OAuth |
| `GET` | `/oauth/login` | No | Inicia flujo OAuth (navegador) |
| `GET` | `/oauth/callback` | No | Callback de retorno OAuth de MELI |
| `GET` | `/api/admin/metrics` | super_admin | Métricas globales del negocio |
| `GET` | `/api/admin/tenants` | super_admin | Listado de tenants con salud de tokens |
| `GET` | `/api/admin/tenants/:sellerId` | super_admin | Ficha técnica de un tenant |
| `POST` | `/api/admin/tenants/:sellerId/toggle` | super_admin | Activar/pausar auto-responder |
| `POST` | `/api/admin/tenants/:sellerId/refresh-token` | super_admin | Forzar refresco OAuth |
| `GET` | `/api/questions` | Opcional | Listado de preguntas (filtrado por tenant) |
| `POST` | `/api/questions/:id/approve` | Opcional | Aprobar y publicar respuesta en MELI |
| `POST` | `/api/questions/:id/reject` | Opcional | Rechazar pregunta |
| `POST` | `/api/whatsapp/reply` | No | Aprobador vía WhatsApp |
| `GET` | `/api/tenant/settings` | JWT (tenant) | Configuración actual del tenant |
| `PUT` | `/api/tenant/settings` | JWT (tenant) | Guardar preferencias del tenant |
| `GET` | `/api/tenant/claims` | JWT (tenant) | Listado de reclamos del tenant |
| `POST` | `/api/simulate-question` | No | Simular pregunta pre-venta (sin llamar a MELI) |
| `POST` | `/api/config/auto-answer` | No | Configurar modo de operación |
| `GET` | `/api/health` | No | Estado del servidor y conexiones |
| `GET` | `/api/events/stream` | No | Stream SSE de eventos en tiempo real |
| `POST` | `/webhook/ml` | No | Webhook de Mercado Libre (questions & claims) |
| `GET` | `/webhook/whatsapp` | No | Verificación de webhook Meta (challenge) |
| `POST` | `/webhook/whatsapp` | No | Recepción de mensajes y botones WhatsApp |

---

## 1. Autenticación (`/api/auth`)

### POST /api/auth/register
Crea usuario nuevo con rol `tenant` por defecto.

**Body:**
```json
{
  "email": "vendedor@tienda.com",
  "password": "PasswordSeguro123!",
  "name": "Juan Pérez",
  "role": "tenant",
  "sellerId": "MLA123456789"
}
```
**Respuesta 201:**
```json
{
  "token": "eyJ...",
  "user": { "id": "uuid", "email": "...", "name": "...", "role": "tenant", "sellerId": "..." }
}
```

---

### POST /api/auth/login
**Body:** `{ "email": "...", "password": "..." }`  
**Respuesta 200:** Igual al registro.

---

### GET /api/auth/me
**Headers:** `Authorization: Bearer <token>`  
**Respuesta 200:** Perfil sanitizado del usuario autenticado.

---

### GET /api/auth/onboarding-status
**Headers:** `Authorization: Bearer <token>`

**Respuesta 200:**
```json
{
  "user": { "id": "...", "email": "...", "role": "tenant", "sellerId": "3680586616" },
  "isMeliConnected": true,
  "tenant": {
    "sellerId": "3680586616",
    "nickname": "TIENDA_OFICIAL_ML",
    "tokenHealth": "healthy",
    "autoAnswerEnabled": true,
    "confidenceThreshold": 0.75,
    "tone": "casual_rioplatense"
  },
  "meliAuthUrl": "https://auth.mercadolibre.com.ar/authorization?..."
}
```
`tokenHealth` values: `"healthy"` | `"expiring_soon"` | `"expired"`

---

### GET /api/auth/meli-auth-url
**Headers (Opcional):** `Authorization: Bearer <token>`  
**Respuesta 200:** `{ "url": "https://auth.mercadolibre.com.ar/authorization?..." }`

---

## 2. Flujo OAuth Mercado Libre (`/oauth`)

### GET /oauth/login
**Query Params (Opcionales):** `?token=<jwt>` o `?userId=<userId>`  
Redirige (HTTP 302) a la pasarela OAuth de Mercado Libre Argentina.

### GET /oauth/callback
**Query Params:** `?code=...&state=...`  
1. Intercambia `code` por tokens OAuth vía MELI.
2. Consulta perfil en `GET https://api.mercadolibre.com/users/:id`.
3. Crea/actualiza entidad `Tenant` y vincula `sellerId` al `User`.
4. Redirige a `/onboarding.html?status=connected&sellerId=...&nickname=...&token=...`.

---

## 3. Super Administrador (`/api/admin`)

> Todos requieren `Authorization: Bearer <token>` de usuario `super_admin`. Retorna **403** si no.

### GET /api/admin/metrics
**Respuesta 200:**
```json
{
  "totalQuestions": 1420,
  "autoAnsweredCount": 1150,
  "approvedCount": 190,
  "pendingReviewCount": 60,
  "rejectedCount": 15,
  "errorCount": 5,
  "autoAnswerRatePercent": 94.3,
  "averageLatencyMs": 1120,
  "totalActiveTenants": 8,
  "intentDistribution": { "stock": 720, "envio": 310, "caracteristicas": 210 }
}
```

### GET /api/admin/tenants
**Respuesta 200:** Array de tenants con `sellerId`, `nickname`, `tokenHealth`, `expiresInMinutes`, `autoAnswerEnabled`, `totalQuestions`, etc.

### GET /api/admin/tenants/:sellerId
**Respuesta 200:** Ficha técnica completa con preguntas recientes y logs de auditoría.

### POST /api/admin/tenants/:sellerId/toggle
**Body (Opcional):** `{ "enabled": false }`  
**Respuesta 200:** `{ "sellerId": "...", "autoAnswerEnabled": false }`

### POST /api/admin/tenants/:sellerId/refresh-token
**Respuesta 200:** `{ "sellerId": "...", "refreshed": true, "expiresInMinutes": 360 }`

---

## 4. Preguntas (`/api/questions`)

### GET /api/questions
**Headers (Opcional):** `Authorization: Bearer <token>`  
Si hay token de `tenant`, filtra estrictamente por su `seller_id`.

**Respuesta 200:**
```json
{
  "pending_review": [ ... ],
  "auto_answered": [ ... ],
  "other": [ ... ]
}
```

### POST /api/questions/:id/approve
**Headers (Opcional):** `Authorization: Bearer <token>`  
**Body (Opcional):** `{ "text": "¡Hola! Sí, contamos con stock." }`  
**Respuesta 200:** `{ "ok": true, "question_id": "123", "status": "APPROVED" }`

### POST /api/questions/:id/reject
**Respuesta 200:** `{ "ok": true, "question_id": "123", "status": "REJECTED" }`

### POST /api/whatsapp/reply
Aprobador vía chat de WhatsApp (recibe mensajes del vendedor).

**Body:**
```json
{ "question_id": "123", "reply_text": "1" }
```
Opciones: `"1"` = Aprobar sugerencia · `"2"` = Rechazar · texto libre = respuesta personalizada.

---

## 5. Configuración del Tenant (`/api/tenant`)

> Requieren `Authorization: Bearer <token>` de un usuario con rol `tenant`.

### GET /api/tenant/settings
**Respuesta 200:**
```json
{
  "sellerId": "3680586616",
  "autoAnswerEnabled": true,
  "confidenceThreshold": 0.75,
  "tone": "casual_rioplatense",
  "businessInstructions": "...",
  "whatsappAlertPhone": "+5491112345678",
  "whatsappMode": "platform",
  "byoPhoneNumberId": null,
  "byoAccessToken": null,
  "whatsappQuotaUsed": 12,
  "whatsappQuotaLimit": 150
}
```
`tone` values: `"casual_rioplatense"` | `"formal_profesional"` | `"conciso_directo"`  
`whatsappMode` values: `"platform"` (bot centralizado) | `"byo"` (credenciales propias de Meta)

### PUT /api/tenant/settings
**Body (parcial, cualquier combinación):**
```json
{
  "autoAnswerEnabled": true,
  "confidenceThreshold": 0.80,
  "tone": "formal_profesional",
  "businessInstructions": "Somos una tienda de electrónica...",
  "whatsappAlertPhone": "+5491112345678",
  "whatsappMode": "platform",
  "byoPhoneNumberId": "109283746501928",
  "byoAccessToken": "EAAG..."
}
```
**Respuesta 200:** Settings actualizados completos.

### GET /api/tenant/claims
**Respuesta 200:** Array de reclamos activos del tenant con `id`, `orderId`, `type`, `stage`, `urgency`, `dueDate`, `remainingHours`.

---

## 6. Simulador y Utilidades

### POST /api/simulate-question
Simula el pipeline completo sin llamadas reales a MELI.

**Body:**
```json
{ "text": "Hola, ¿tenés stock para enviar a Córdoba hoy?", "seller_id": "3680586616" }
```

### POST /api/config/auto-answer
**Body:** `{ "enabled": true, "operating_mode": "schedule" }`

### GET /api/health
**Respuesta 200:** Estado del servidor, base de datos, modo de operación y conexión con MELI.

### GET /api/events/stream
Stream Server-Sent Events en tiempo real.  
**Query Params (Opcional):** `?seller_id=3680586616`  
**Eventos:** `question_received` · `question_processed` · `answer_published` · `audit_event` · `claim_received`

---

## 7. Webhooks

### POST /webhook/ml
Receptor de webhooks de Mercado Libre. Bifurca según `topic`:
- `"questions"` → `IngestWebhookUseCase`
- `"claims"` / `"post_purchase"` → `IngestClaimWebhookUseCase`

Responde **200 OK** en < 50ms (el procesamiento es asíncrono en cola).

### GET /webhook/whatsapp
Verificación del webhook de Meta (challenge handshake).  
**Query Params:** `hub.mode`, `hub.verify_token`, `hub.challenge`  
Responde el challenge si `hub.verify_token === META_WA_VERIFY_TOKEN`.

### POST /webhook/whatsapp
Recepción de mensajes entrantes de Meta Graph API.  
Extrae sender, texto libre o `button_reply.id`, ejecuta `HandleWhatsAppReplyUseCase`.  
Responde **200 OK** inmediato a Meta.

---

## Guards de Seguridad

| Guard | Efecto |
|---|---|
| `authenticate` | Verifica JWT válido. **401** si no. |
| `requireSuperAdmin` | Exige rol `super_admin`. **403** si no. |
| `optionalAuthenticate` | No exige auth, pero usa el contexto si hay token. |
