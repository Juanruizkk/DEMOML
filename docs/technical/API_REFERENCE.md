# Referencia de API: MELI AI Assistant

Todos los endpoints HTTP del backend Fastify. Autenticación: JWT Bearer Token (HMAC-SHA256).

---

## Resumen de Rutas

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| `POST` | `/api/auth/register` | No | Registro de usuario |
| `POST` | `/api/auth/login` | No | Login, devuelve JWT |
| `GET` | `/api/auth/me` | JWT | Perfil del usuario autenticado |
| `GET` | `/api/auth/onboarding-status` | JWT | Estado de conexión con MELI |
| `GET` | `/api/auth/meli-auth-url` | Opcional | URL de autorización OAuth |
| `GET` | `/oauth/login` | No | Inicia flujo OAuth (navegador) |
| `GET` | `/oauth/callback` | No | Callback OAuth de MELI |
| `POST` | `/api/auth/request-reset` | No | Solicita email de reset de contraseña |
| `POST` | `/api/auth/reset-password` | No | Resetea contraseña con token |
| `POST` | `/api/activate` | No | Activa cuenta por token de invitación |
| `GET` | `/api/admin/metrics` | super_admin | Métricas globales de la plataforma |
| `GET` | `/api/admin/tenants` | super_admin | Lista tenants con salud de tokens |
| `GET` | `/api/admin/tenants/:sellerId` | super_admin | Ficha técnica de un tenant |
| `POST` | `/api/admin/tenants` | super_admin | Crea tenant manualmente |
| `POST` | `/api/admin/tenants/:sellerId/toggle` | super_admin | Activar/pausar auto-responder |
| `POST` | `/api/admin/tenants/:sellerId/refresh-token` | super_admin | Forzar refresco OAuth |
| `PUT` | `/api/admin/tenants/:sellerId/permissions` | super_admin | Modificar permisos granulares |
| `PATCH` | `/api/admin/tenants/:sellerId/integrations` | super_admin | Actualizar integraciones del tenant |
| `GET` | `/api/admin/llm-usage` | super_admin | Estadísticas de uso LLM (global) |
| `GET` | `/api/admin/invitations` | super_admin | Invitaciones pendientes |
| `GET` | `/api/admin/unconnected` | super_admin | Tenants sin cuenta ML conectada |
| `POST` | `/api/admin/users/:userId/resend-invitation` | super_admin | Reenviar invitación |
| `POST` | `/api/admin/users/:userId/reset-password` | super_admin | Reset de contraseña de usuario |
| `POST` | `/api/admin/reset-password` | super_admin | Reset por email (como admin) |
| `GET` | `/api/admin/tenants/:sellerId/golden-dataset` | super_admin | Dataset de decisiones humanas del tenant |
| `GET` | `/api/admin/tenants/:sellerId/golden-dataset/metrics` | super_admin | Métricas de calidad del golden dataset |
| `GET` | `/api/questions` | JWT | Listado de preguntas paginado |
| `POST` | `/api/questions/:id/approve` | JWT | Aprobar y publicar respuesta en MELI |
| `POST` | `/api/questions/:id/reject` | JWT | Rechazar pregunta |
| `POST` | `/api/questions/:id/human-decision` | JWT | Guardar decisión humana en golden dataset |
| `POST` | `/api/whatsapp/reply` | No | Aprobador vía WhatsApp interactivo |
| `GET` | `/api/claims` | JWT | Listado de reclamos paginado |
| `POST` | `/api/claims/simulate` | JWT | Inyectar reclamo demo |
| `POST` | `/api/claims/:id/ack` | JWT | Acuse de recibo del reclamo |
| `POST` | `/api/claims/:id/unack` | JWT | Deshacer acuse |
| `POST` | `/api/claims/:id/close` | JWT | Cerrar reclamo |
| `POST` | `/api/claims/:id/reopen` | JWT | Reabrir reclamo |
| `GET` | `/api/order-messages` | JWT | Listado de mensajes post-venta |
| `POST` | `/api/order-messages/:id/reply` | JWT | Enviar respuesta al comprador |
| `POST` | `/api/order-messages/simulate` | JWT | Simular mensaje post-venta |
| `GET` | `/api/tenant/products` | JWT | Catálogo del tenant con paginación |
| `GET` | `/api/tenant/products/:itemId/knowledge` | JWT | Conocimiento personalizado del ítem |
| `PUT` | `/api/tenant/products/:itemId/knowledge` | JWT | Guardar conocimiento del ítem |
| `DELETE` | `/api/tenant/products/:itemId/knowledge` | JWT | Eliminar conocimiento del ítem |
| `POST` | `/api/tenant/products/:itemId/simulate` | JWT | Simular pregunta sobre el ítem |
| `POST` | `/api/tenant/products/:itemId/suggest-faqs` | JWT | Sugerir FAQs con LLM |
| `GET` | `/api/tenant/settings` | JWT | Configuración actual del tenant |
| `PUT` | `/api/tenant/settings` | JWT | Guardar preferencias del tenant |
| `POST` | `/api/config/auto-answer` | JWT | Actualizar modo de respuesta automática |
| `GET` | `/api/tenant/team` | JWT | Listado de colaboradores |
| `POST` | `/api/tenant/team/invite` | JWT | Invitar colaborador por email |
| `DELETE` | `/api/tenant/team/:memberId` | JWT | Eliminar colaborador |
| `GET` | `/api/tenant/llm-usage` | JWT | Uso LLM del tenant (tokens, costo) |
| `PATCH` | `/api/tenant/llm-usage/limit` | JWT | Configurar spending limit mensual |
| `GET` | `/api/tenant/telegram/info` | JWT | Info de vinculación Telegram |
| `POST` | `/api/tenant/telegram/test` | JWT | Enviar mensaje de prueba a Telegram |
| `POST` | `/api/tenant/channels/email/test` | JWT | Enviar email de prueba |
| `GET` | `/api/health` | No | Estado del servidor |
| `GET` | `/api/events` | JWT | Historial de eventos del tenant |
| `GET` | `/api/events/stream` | JWT | Stream SSE en tiempo real |
| `POST` | `/api/simulate-question` | No | Simular pregunta (sin llamar a MELI) |
| `POST` | `/api/demo/seed` | No | Seed de datos de demo |
| `POST` | `/webhook/ml` | No | Webhook de Mercado Libre |
| `GET` | `/webhook/whatsapp` | No | Verificación webhook Meta (challenge) |
| `POST` | `/webhook/whatsapp` | No | Recepción de mensajes y botones WhatsApp |
| `POST` | `/webhook/telegram` | No | Recepción de updates de Telegram |

---

## 1. Autenticación (`/api/auth`)

### POST /api/auth/register
**Body:**
```json
{
  "email": "vendedor@tienda.com",
  "password": "PasswordSeguro123!",
  "name": "Juan Pérez"
}
```
**Respuesta 201:**
```json
{
  "token": "eyJ...",
  "user": { "id": "uuid", "email": "...", "name": "...", "role": "tenant", "sellerId": null }
}
```

### POST /api/auth/login
**Body:** `{ "email": "...", "password": "..." }`
**Respuesta 200:** igual al registro.

### GET /api/auth/me
**Headers:** `Authorization: Bearer <token>`
**Respuesta 200:** perfil sanitizado.

### GET /api/auth/onboarding-status
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
`tokenHealth`: `"healthy"` | `"expiring_soon"` | `"expired"`

### POST /api/auth/request-reset
**Body:** `{ "email": "...", "baseUrl": "https://app.ejemplo.com" }`
Envía email con link de reset. Responde `{ ok: true }` siempre (no expone si el email existe).

### POST /api/auth/reset-password
**Body:** `{ "token": "...", "newPassword": "..." }`
**Respuesta 200:** `{ "token": "eyJ...", "user": { ... } }` (nuevo JWT).

### POST /api/activate
**Body:** `{ "token": "...", "password": "...", "name": "..." }`
Activa una cuenta invitada. Responde con JWT.

---

## 2. Flujo OAuth Mercado Libre (`/oauth`)

### GET /oauth/login
**Query (Opcionales):** `?token=<jwt>` o `?userId=<userId>`
Redirige (302) a la pasarela OAuth de Mercado Libre Argentina.

### GET /oauth/callback
**Query:** `?code=...&state=...`
1. Intercambia `code` por tokens OAuth.
2. Consulta perfil en ML (`/users/:id`).
3. Crea o actualiza `Tenant`, vincula `sellerId` al `User`, emite JWT actualizado.
4. Redirige a `/onboarding?status=connected&sellerId=...&nickname=...&token=...`

---

## 3. Super Administrador (`/api/admin`)

> Todos requieren `Authorization: Bearer <token>` de `super_admin`. Retorna **403** si no.

### GET /api/admin/metrics
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
  "intentDistribution": { "stock": 720, "envio": 310 }
}
```

### GET /api/admin/tenants
Array de tenants con `sellerId`, `nickname`, `tokenHealth`, `expiresInMinutes`, `autoAnswerEnabled`, `totalQuestions`.

### POST /api/admin/tenants
**Body:** `{ "email": "...", "name": "...", "sellerId": "..." }`
Crea tenant directamente (sin flujo OAuth).

### PUT /api/admin/tenants/:sellerId/permissions
**Body (parcial):**
```json
{ "multiUserEnabled": true, "claimsEnabled": true, "orderMessagesEnabled": true }
```

### PATCH /api/admin/tenants/:sellerId/integrations
**Body (parcial):** campos de WhatsApp BYO, Telegram, email config.

### GET /api/admin/llm-usage
Estadísticas globales de tokens, costo y uso por modelo para todos los tenants.

### GET /api/admin/tenants/:sellerId/golden-dataset
Lista todas las `GoldenDatasetEntry` del tenant: `questionId`, `humanDecision`, `qualityRating`, `intent`, `timestamp`.

### GET /api/admin/tenants/:sellerId/golden-dataset/metrics
```json
{
  "totalEntries": 120,
  "approveRate": 0.72,
  "rejectRate": 0.28,
  "averageQualityRating": 4.1,
  "intentDistribution": { "stock": 45, "envio": 30 }
}
```

---

## 4. Preguntas (`/api/questions`)

### GET /api/questions
**Query (Opcionales):** `?page=1&limit=20&status=pending_review`
**Respuesta 200:**
```json
{
  "ok": true,
  "questions": [ ... ],
  "pagination": {
    "page": 1, "limit": 20, "total": 85, "totalPages": 5,
    "hasNext": true, "hasPrev": false
  }
}
```

### POST /api/questions/:id/approve
**Body (Opcional):** `{ "text": "¡Hola! Sí, contamos con stock." }`
**Respuesta 200:** `{ "ok": true, "question_id": "123", "status": "APPROVED" }`

### POST /api/questions/:id/reject
**Respuesta 200:** `{ "ok": true, "question_id": "123", "status": "REJECTED" }`

### POST /api/questions/:id/human-decision
**Body:**
```json
{
  "humanIntent": "stock",
  "humanDecision": "approve",
  "qualityRating": 5
}
```
Guarda la decisión en el golden dataset y ejecuta approve/reject en MELI.
**Respuesta 200:** `{ "ok": true, "entryId": "..." }`

### POST /api/whatsapp/reply
Aprobador por WhatsApp interactivo.
**Body:** `{ "question_id": "123", "reply_text": "1" }`
`"1"` = Aprobar · `"2"` = Rechazar · texto libre = respuesta personalizada.

---

## 5. Reclamos (`/api/claims`)

### GET /api/claims
**Query:** `?page=1&limit=10`
**Respuesta 200:**
```json
{
  "success": true,
  "claims": [ ... ],
  "pagination": { "page": 1, "limit": 10, "total": 15, "totalPages": 2, "hasNext": true, "hasPrev": false },
  "metrics": { "total": 15, "urgent": 3, "medPdd": 5 }
}
```

### POST /api/claims/simulate
Inyecta un reclamo demo y dispara todas las alertas configuradas (WA, Telegram, Email).
**Respuesta 200:** `{ "success": true, "claim": { ... } }`

### POST /api/claims/:id/ack | /unack | /close | /reopen
Transiciones de estado del reclamo.
**Respuesta 200:** `{ "success": true, "claim": { ... } }`

---

## 6. Mensajería Post-Venta (`/api/order-messages`)

### GET /api/order-messages
**Query:** `?page=1&limit=10`
**Respuesta 200:** Array paginado de mensajes con `id`, `orderId`, `buyerId`, `text`, `suggestedAnswer`, `status`.

### POST /api/order-messages/:id/reply
**Body:** `{ "replyText": "Hola, tu pedido está en camino." }`
Envía la respuesta a la API de MELI.

### POST /api/order-messages/simulate
Simula un mensaje post-venta con respuesta sugerida por LLM.

---

## 7. Productos (`/api/tenant/products`)

### GET /api/tenant/products
**Query:** `?page=1&limit=20&search=auricular`
**Respuesta 200:** Catálogo paginado con `hasCustomKnowledge` por ítem.

### GET/PUT/DELETE /api/tenant/products/:itemId/knowledge
Gestión de conocimiento personalizado por producto (instrucciones, FAQ, condiciones especiales).

### POST /api/tenant/products/:itemId/suggest-faqs
Genera FAQs sugeridas para el ítem usando LLM.
**Respuesta 200:** `{ "faqs": [ { "question": "...", "answer": "..." } ] }`

---

## 8. Configuración del Tenant (`/api/tenant`)

### GET /api/tenant/settings
```json
{
  "sellerId": "3680586616",
  "autoAnswerEnabled": true,
  "confidenceThreshold": 0.75,
  "tone": "casual_rioplatense",
  "businessInstructions": "...",
  "whatsappAlertPhone": "+5491112345678",
  "whatsappMode": "platform_shared",
  "byoPhoneNumberId": null,
  "byoAccessToken": null,
  "whatsappQuotaUsed": 12,
  "whatsappQuotaLimit": 150,
  "telegramEnabled": false,
  "telegramAlertChatId": null,
  "preferredAlertChannel": "whatsapp",
  "emailAlertAddress": null
}
```
`tone`: `"casual_rioplatense"` | `"formal_profesional"` | `"conciso_directo"`
`whatsappMode`: `"platform_shared"` | `"byo"`
`preferredAlertChannel`: `"whatsapp"` | `"telegram"` | `"both"` | `"email"`

### PUT /api/tenant/settings
**Body (parcial):** cualquier combinación de los campos anteriores.

### GET /api/tenant/llm-usage
```json
{
  "currentMonth": { "tokens": 42000, "cost": 0.38, "calls": 215 },
  "spendingLimit": 5.00,
  "limitReached": false,
  "history": [ { "month": "2026-08", "tokens": 38000, "cost": 0.34 } ]
}
```

### PATCH /api/tenant/llm-usage/limit
**Body:** `{ "limitUsd": 10.00 }`

### GET /api/tenant/telegram/info
Info de vinculación: `chatId`, `botToken` (parcial), `enabled`, `linkUrl` para nuevo vinculado.

### POST /api/tenant/telegram/test
Envía un mensaje de prueba al chat vinculado.

### POST /api/tenant/channels/email/test
**Body:** `{ "to": "vendedor@empresa.com" }`
Envía email de prueba vía Resend.

---

## 9. Equipo (`/api/tenant/team`)

### GET /api/tenant/team
```json
{
  "multiUserEnabled": true,
  "members": [
    { "id": "usr-123", "name": "Laura Gómez", "email": "laura@empresa.com",
      "role": "tenant", "status": "active", "createdAt": "2026-09-01T12:00:00.000Z" }
  ]
}
```

### POST /api/tenant/team/invite
**Body:** `{ "name": "Martín Palermo", "email": "vendedor@empresa.com" }`
**Respuesta 201:** `{ "userId": "...", "name": "...", "email": "...", "activationUrl": "..." }`

### DELETE /api/tenant/team/:memberId
**Respuesta 200:** `{ "ok": true, "message": "Colaborador eliminado correctamente." }`

---

## 10. Simulador y Utilidades

### POST /api/simulate-question
**Body:** `{ "text": "¿Tenés stock?", "seller_id": "3680586616" }`
Pipeline completo sin llamadas reales a MELI.

### POST /api/demo/seed
Siembra preguntas y reclamos demo. No requiere autenticación.

### GET /api/health
Estado del servidor, conexión DB, modo de operación.

### GET /api/events
**Query:** `?limit=50` — historial de eventos del tenant autenticado.

### GET /api/events/stream
Stream SSE en tiempo real.
**Eventos:** `question_received` · `question_processed` · `answer_published` · `audit_event` · `claim_received` · `order_message_received`

---

## 11. Webhooks

### POST /webhook/ml
Receptor de webhooks de Mercado Libre. Bifurca según `topic`:
- `"questions"` → `IngestWebhookUseCase` → cola de procesamiento
- `"claims"` / `"post_purchase"` → `IngestClaimWebhookUseCase`
- `"packs"` / `"orders_v2"` → `IngestOrderMessageWebhookUseCase`

Responde **200 OK** en < 50ms (procesamiento asíncrono).

### GET /webhook/whatsapp
Verificación Meta challenge: `hub.mode`, `hub.verify_token`, `hub.challenge`.

### POST /webhook/whatsapp
Recepción de mensajes y botones interactivos de Meta Graph API → `HandleWhatsAppReplyUseCase`.

### POST /webhook/telegram
Recepción de updates de Telegram Bot API → `HandleTelegramWebhookUseCase`.
Soporta mensajes de texto, `/start tenant_<sellerId>`, y callbacks de botones inline (approve, reject, msg_approve, claim_ack, claim_detail).

---

## Guards de Seguridad

| Guard | Efecto |
|---|---|
| `authenticate` | JWT obligatorio. **401** si no. |
| `requireSuperAdmin` | Rol `super_admin`. **403** si no. |
| `requireDemo` | Acceso demo o con token válido. |
| `optionalAuthenticate` | No exige auth, adjunta contexto si hay token. |
