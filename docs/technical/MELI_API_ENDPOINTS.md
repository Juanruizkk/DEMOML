# Endpoints de Mercado Libre que consume la app

Todos los endpoints externos de la API de Mercado Libre y MercadoPago que el backend llama.  
Base URL: `https://api.mercadolibre.com`

---

## Resumen

| Método | Endpoint | Caso de Uso | Descripción |
|---|---|---|---|
| `POST` | `/oauth/token` | ConnectMeliAccountUseCase | Intercambiar código OAuth por access/refresh token |
| `GET` | `/users/me` | Verificación manual | Verificar que un access token es válido |
| `GET` | `/users/:id` | ConnectMeliAccountUseCase | Obtener perfil del vendedor (nickname, email) |
| `GET` | `/questions/:questionId` | ProcessQuestionUseCase | Obtener detalle de una pregunta pre-venta |
| `POST` | `/answers` | ApproveAnswerUseCase | Publicar respuesta a una pregunta |
| `GET` | `/items/:itemId` | ProcessQuestionUseCase (cache) | Obtener ficha técnica de una publicación |
| `GET` | `/v1/claims/:claimId` | ProcessClaimUseCase | Obtener detalle de un reclamo post-venta |
| `POST` | `/users/test_user` | Setup sandbox | Crear usuarios de prueba en sandbox |

---

## Detalle de Endpoints

### POST /oauth/token
Intercambia el código de autorización por tokens OAuth 2.0.

**Headers:** `Content-Type: application/x-www-form-urlencoded`  
**Body:**
```
grant_type=authorization_code
&client_id={ML_CLIENT_ID}
&client_secret={ML_CLIENT_SECRET}
&code={code_from_callback}
&redirect_uri={ML_REDIRECT_URI}
```
**Respuesta:**
```json
{
  "access_token": "APP_USR-...",
  "token_type": "bearer",
  "expires_in": 21600,
  "refresh_token": "TG-...",
  "user_id": 3680586616
}
```

Para renovar con refresh token: `grant_type=refresh_token&refresh_token={token}`

---

### GET /users/me
Verificación de token. Retorna el perfil del usuario autenticado.

**Headers:** `Authorization: Bearer {access_token}`

---

### GET /users/:id
Obtiene el perfil público de un vendedor. Usado en el flujo OAuth para capturar `nickname`.

**Headers:** `Authorization: Bearer {access_token}`  
**Respuesta relevante:** `{ "id": 3680586616, "nickname": "TIENDA_OFICIAL", "email": "...", "site_id": "MLA" }`

---

### GET /questions/:questionId
Obtiene el detalle de una pregunta pre-venta recibida via webhook.

**Headers:** `Authorization: Bearer {seller_access_token}`  
**Respuesta relevante:**
```json
{
  "id": 12345,
  "text": "Hola, ¿tenés stock?",
  "status": "UNANSWERED",
  "item_id": "MLA3935560592",
  "seller_id": 3680586616,
  "from": { "id": 3677130936 }
}
```

---

### POST /answers
Publica la respuesta a una pregunta en la ficha del producto.

**Headers:** `Authorization: Bearer {seller_access_token}` · `Content-Type: application/json`  
**Body:**
```json
{
  "question_id": 12345,
  "text": "¡Hola! Sí, contamos con stock disponible."
}
```
**Respuesta 200:** `{ "id": 12345, "text": "...", "status": "ANSWERED" }`

---

### GET /items/:itemId
Obtiene la ficha técnica de una publicación. Resultado se cachea en `ItemCacheRepository` con TTL.

**Headers:** `Authorization: Bearer {seller_access_token}`  
**Respuesta relevante:** `{ "id": "MLA3935560592", "title": "...", "price": 15000, "available_quantity": 5, "condition": "new", "attributes": [...] }`

---

### GET /v1/claims/:claimId
Obtiene el detalle de un reclamo post-venta. Llamado desde `ProcessClaimUseCase` al recibir webhook `topic: "claims"`.

**Headers:** `Authorization: Bearer {seller_access_token}`  
**Respuesta relevante:**
```json
{
  "id": "5000000000",
  "status": "opened",
  "stage": "claim",
  "type": "med_pnr",
  "reason_id": "BUYER_NOT_RECEIVED",
  "resource": { "order_id": "123456789" },
  "players": [
    { "role": "complainant", "type": "buyer", "user_id": 3677130936 }
  ],
  "resolution": { "due_date": "2026-09-15T18:00:00.000-04:00" }
}
```

**Tipos de reclamo (`type`):**
- `med_pnr` — Paquete no recibido (PNR)
- `med_pdd` — Producto defectuoso o diferente (PDD)
- `return` — Devolución
- `cancel_purchase` — Cancelación

---

### POST /users/test_user
Crea un usuario de prueba en sandbox. Solo disponible con tokens de aplicaciones de prueba.

**Headers:** `Authorization: Bearer {access_token}` · `Content-Type: application/json`  
**Body:** `{ "site_id": "MLA" }`  
**Respuesta:** `{ "id": 3680586616, "nickname": "TESTUSER...", "password": "...", "email": "..." }`

---

## Webhooks entrantes desde MELI

MELI hace POST al endpoint `{ngrok_url}/webhook/ml` cuando hay eventos.

**Payload de webhook de pregunta:**
```json
{
  "resource": "/questions/12345",
  "user_id": 3680586616,
  "topic": "questions",
  "application_id": 4321332576904880,
  "attempts": 1,
  "sent": "2026-09-13T14:00:00.000Z",
  "received": "2026-09-13T14:00:00.000Z"
}
```

**Payload de webhook de reclamo:**
```json
{
  "resource": "/post-purchase/v1/claims/5000000000",
  "user_id": 3680586616,
  "topic": "claims",
  "application_id": 4321332576904880,
  "attempts": 1
}
```

---

## Endpoints de Reclamos (Post-Purchase API)

Para operaciones manuales o de testing sobre reclamos.  
Base URL: `https://api.mercadolibre.com/post-purchase/v1`

| Método | Endpoint | Descripción |
|---|---|---|
| `GET` | `/claims/search?order_id={orderId}` | Buscar reclamos de una orden |
| `POST` | `/claims/{claimId}/actions/open-dispute` | Escalar a disputa (mediación de ML) |
| `POST` | `/claims/{claimId}/expected-resolutions/refund` | Solicitar resolución con reembolso |

**Ciclo de vida del reclamo:** `claim` (comprador-vendedor) → `dispute` (interviene ML) → `closed`

---

## Configuración OAuth requerida en DevCenter de MELI

- **App ID (Client ID):** `4321332576904880`
- **Redirect URI:** `https://{ngrok_domain}/oauth/callback`
- **Scopes:** `read`, `write`, `offline_access`
- **Notificaciones Callback URL:** `https://{ngrok_domain}/webhook/ml`
- **Tópicos habilitados:** `questions`, `claims`
