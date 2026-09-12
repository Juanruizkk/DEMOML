# 📖 Referencia de API: MELI AI Assistant (Clean Architecture)

Documentación técnica exhaustiva de todos los endpoints HTTP disponibles en el backend Fastify con TypeScript, autenticación JWT y soporte Multi-Tenant.

---

## 🔐 1. Módulo de Autenticación (`/api/auth`)

### 1.1 Registro de Usuario
Crea un nuevo usuario en la plataforma. Por defecto se asigna rol `tenant`.

* **Método / Ruta**: `POST /api/auth/register`
* **Headers**: `Content-Type: application/json`
* **Body**:
  ```json
  {
    "email": "vendedor@tienda.com",
    "password": "PasswordSeguro123!",
    "name": "Juan Pérez",
    "role": "tenant",
    "sellerId": "MLA123456789"
  }
  ```
  *(El campo `sellerId` es opcional si aún no conectó su cuenta de Mercado Libre).*
* **Respuesta (201 Created)**:
  ```json
  {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "uuid-v4-1234",
      "email": "vendedor@tienda.com",
      "name": "Juan Pérez",
      "role": "tenant",
      "sellerId": "MLA123456789"
    }
  }
  ```

---

### 1.2 Inicio de Sesión (Login)
Valida credenciales y emite un token JWT firmado (HMAC-SHA256).

* **Método / Ruta**: `POST /api/auth/login`
* **Body**:
  ```json
  {
    "email": "admin@melibot.com",
    "password": "Admin123456!"
  }
  ```
* **Respuesta (200 OK)**:
  ```json
  {
    "token": "eyJhbGciOiJIUzI1NiIsIn...",
    "user": {
      "id": "admin-seed-id",
      "email": "admin@melibot.com",
      "name": "Super Administrator",
      "role": "super_admin",
      "sellerId": null
    }
  }
  ```

---

### 1.3 Perfil del Usuario en Sesión
* **Método / Ruta**: `GET /api/auth/me`
* **Headers**: `Authorization: Bearer <token>`
* **Respuesta (200 OK)**: Retorna el perfil sanitizado del usuario autenticado.

---

### 1.4 Estado de Onboarding & Diagnóstico
* **Método / Ruta**: `GET /api/auth/onboarding-status`
* **Headers**: `Authorization: Bearer <token>`
* **Respuesta (200 OK)**:
  ```json
  {
    "user": {
      "id": "uuid-123",
      "email": "vendedor@tienda.com",
      "name": "Juan Pérez",
      "role": "tenant",
      "sellerId": "3680586616"
    },
    "isMeliConnected": true,
    "tenant": {
      "sellerId": "3680586616",
      "nickname": "TIENDA_OFICIAL_ML",
      "email": "tienda@mercadolibre.com",
      "tokenHealth": "healthy",
      "autoAnswerEnabled": true,
      "confidenceThreshold": 0.75,
      "tone": "casual_rioplatense"
    },
    "meliAuthUrl": "https://auth.mercadolibre.com.ar/authorization?..."
  }
  ```

---

### 1.5 Obtener URL de Autorización OAuth
* **Método / Ruta**: `GET /api/auth/meli-auth-url`
* **Headers (Opcional)**: `Authorization: Bearer <token>`
* **Respuesta (200 OK)**:
  ```json
  {
    "url": "https://auth.mercadolibre.com.ar/authorization?response_type=code&client_id=...&redirect_uri=...&state=userId"
  }
  ```

---

## 🤝 2. Flujo OAuth Mercado Libre (`/oauth`)

### 2.1 Iniciar Autorización OAuth (Navegador)
* **Método / Ruta**: `GET /oauth/login`
* **Query Params (Opcionales)**: `?token=<jwt_token>` o `?userId=<userId>`
* **Comportamiento**: Redirige (HTTP 302) a la pasarela de consentimiento de Mercado Libre Argentina adjuntando el `state`.

### 2.2 Callback de Retorno OAuth
* **Método / Ruta**: `GET /oauth/callback`
* **Query Params**: `?code=...&state=...`
* **Comportamiento**:
  1. Intercambia `code` por tokens OAuth.
  2. Consulta el perfil en MELI (`/users/:id`).
  3. Crea o actualiza la entidad `Tenant`.
  4. Vincula el `sellerId` al `User`.
  5. Redirige al navegador a `/onboarding.html?status=connected&sellerId=...&nickname=...&token=...`.

---

## 👑 3. Panel de Super Administrador (`/api/admin`)
> ⚠️ **Seguridad**: Todos los endpoints requieren cabecera `Authorization: Bearer <token>` de un usuario con rol `super_admin` (**HTTP 403 Forbidden** en caso contrario).

### 3.1 Métricas Globales del Negocio
* **Método / Ruta**: `GET /api/admin/metrics`
* **Respuesta (200 OK)**:
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
    "intentDistribution": {
      "stock": 720,
      "envio": 310,
      "caracteristicas": 210,
      "precio_negociacion": 130,
      "facturacion": 50
    }
  }
  ```

---

### 3.2 Listado y Semáforo de Tenants
* **Método / Ruta**: `GET /api/admin/tenants`
* **Respuesta (200 OK)**:
  ```json
  [
    {
      "sellerId": "3680586616",
      "nickname": "TESTUSER4327702539",
      "email": "test_seller@meli.com",
      "tokenHealth": "healthy",
      "expiresInMinutes": 350,
      "autoAnswerEnabled": true,
      "confidenceThreshold": 0.75,
      "tone": "casual_rioplatense",
      "totalQuestions": 84,
      "autoAnsweredQuestions": 72,
      "createdAt": "2026-09-10T14:30:00.000Z",
      "updatedAt": "2026-09-12T16:00:00.000Z"
    }
  ]
  ```

---

### 3.3 Ficha Técnica de un Tenant
* **Método / Ruta**: `GET /api/admin/tenants/:sellerId`
* **Respuesta (200 OK)**: Ficha técnica completa, últimas preguntas procesadas y logs de auditoría de esa tienda.

---

### 3.4 Control Remoto: Toggle Auto-Responder
* **Método / Ruta**: `POST /api/admin/tenants/:sellerId/toggle`
* **Body (Opcional)**: `{ "enabled": false }`
* **Respuesta (200 OK)**: `{ "sellerId": "3680586616", "autoAnswerEnabled": false }`

---

### 3.5 Control Remoto: Forzar Refresco de Token OAuth
* **Método / Ruta**: `POST /api/admin/tenants/:sellerId/refresh-token`
* **Respuesta (200 OK)**: `{ "sellerId": "3680586616", "refreshed": true, "expiresInMinutes": 360 }`

---

## 📨 4. Preguntas y Operaciones (`/api/questions`)

### 4.1 Listado de Preguntas
* **Método / Ruta**: `GET /api/questions`
* **Headers (Opcional)**: `Authorization: Bearer <token>`
* **Comportamiento**: Si se envía token de un `tenant`, filtra estrictamente por su `seller_id`.
* **Respuesta (200 OK)**:
  ```json
  {
    "pending_review": [ ... ],
    "auto_answered": [ ... ],
    "other": [ ... ]
  }
  ```

---

### 4.2 Aprobar y Publicar Respuesta
* **Método / Ruta**: `POST /api/questions/:id/approve`
* **Headers (Opcional)**: `Authorization: Bearer <token>`
* **Body (Opcional para edición)**:
  ```json
  {
    "text": "¡Hola! Sí, contamos con stock disponible para entrega inmediata."
  }
  ```
* **Respuesta (200 OK)**: `{ "ok": true, "question_id": "123", "status": "APPROVED" }`

---

### 4.3 Rechazar Respuesta
* **Método / Ruta**: `POST /api/questions/:id/reject`
* **Respuesta (200 OK)**: `{ "ok": true, "question_id": "123", "status": "REJECTED" }`

---

### 4.4 Aprobador vía WhatsApp
* **Método / Ruta**: `POST /api/whatsapp/reply`
* **Body**:
  ```json
  {
    "question_id": "123",
    "reply_text": "1"
  }
  ```
  *(Opciones: `1` = Aprobar sugerencia, `2` = Rechazar, texto libre = respuesta personalizada).*

---

## ⚙️ 5. Configuración & Simulador

### 5.1 Simular Pregunta Pre-Venta
* **Método / Ruta**: `POST /api/simulate-question`
* **Body**:
  ```json
  {
    "text": "Hola, ¿tenés stock para enviar a Córdoba hoy?",
    "seller_id": "3680586616"
  }
  ```

### 5.2 Configuración del Modo de Operación
* **Método / Ruta**: `POST /api/config/auto-answer`
* **Body**:
  ```json
  {
    "enabled": true,
    "operating_mode": "schedule"
  }
  ```

### 5.3 Health Check & Estado
* **Método / Ruta**: `GET /api/health`
* **Respuesta (200 OK)**: Retorna estado del servidor, base de datos, modo de operación y estado de conexión con MELI.

### 5.4 Stream de Telemetría (Server-Sent Events)
* **Método / Ruta**: `GET /api/events/stream`
* **Query Params (Opcional)**: `?seller_id=3680586616`
* **Headers de Respuesta**: `Content-Type: text/event-stream`
* **Eventos transmitidos**: `question_received`, `question_processed`, `answer_published`, `audit_event`.
