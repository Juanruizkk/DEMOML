# Referencia de API: MELI AI Assistant (Clean Architecture)

A continuación se detallan todos los endpoints disponibles en el backend Fastify.

---

## 🔐 Autenticación (`/api/auth`)

### 1. Registro de Usuario
* **Método / Ruta**: `POST /api/auth/register`
* **Body**:
  ```json
  {
    "email": "vendedor@tienda.com",
    "password": "PasswordSeguro123!",
    "name": "Juan Perez",
    "role": "tenant",
    "sellerId": "MLA123456789"
  }
  ```
* **Respuesta (201 Created)**:
  ```json
  {
    "token": "eyJhbGciOiJIUzI1NiIsIn...",
    "user": {
      "id": "uuid-...",
      "email": "vendedor@tienda.com",
      "name": "Juan Perez",
      "role": "tenant",
      "sellerId": "MLA123456789"
    }
  }
  ```

### 2. Login de Usuario
* **Método / Ruta**: `POST /api/auth/login`
* **Body**:
  ```json
  {
    "email": "vendedor@tienda.com",
    "password": "PasswordSeguro123!"
  }
  ```
* **Respuesta (200 OK)**: Retorna el JWT token y perfil.

### 3. Perfil Autenticado
* **Método / Ruta**: `GET /api/auth/me`
* **Headers**: `Authorization: Bearer <token>`
* **Respuesta (200 OK)**: Perfil sanitizado del usuario logueado.

---

## 👑 Super Administrador (`/api/admin`)
> **Nota:** Todos los endpoints de `/api/admin` requieren cabecera `Authorization: Bearer <token>` de un usuario con rol `super_admin`.

### 1. Métricas Globales
* **Método / Ruta**: `GET /api/admin/metrics`
* **Respuesta (200 OK)**:
  ```json
  {
    "totalQuestions": 1250,
    "autoAnsweredCount": 980,
    "approvedCount": 150,
    "pendingReviewCount": 90,
    "rejectedCount": 20,
    "errorCount": 10,
    "autoAnswerRatePercent": 90.4,
    "averageLatencyMs": 1180,
    "totalActiveTenants": 12,
    "intentDistribution": {
      "stock": 650,
      "envio": 300,
      "caracteristicas": 180,
      "precio_negociacion": 120
    }
  }
  ```

### 2. Listado de Tiendas / Inquilinos
* **Método / Ruta**: `GET /api/admin/tenants`
* **Respuesta (200 OK)**: Array con el estado de salud de tokens OAuth (🟢/🟡/🔴), volumen y configuración de cada cliente.

### 3. Detalle de una Tienda
* **Método / Ruta**: `GET /api/admin/tenants/:sellerId`
* **Respuesta (200 OK)**: Ficha técnica completa, preguntas recientes y logs de auditoría.

### 4. Pausar / Activar Auto-Responder de una Tienda
* **Método / Ruta**: `POST /api/admin/tenants/:sellerId/toggle`
* **Body**: `{ "enabled": false }` (o vacío para toggle)

### 5. Forzar Refresco de Token OAuth
* **Método / Ruta**: `POST /api/admin/tenants/:sellerId/refresh-token`

---

## 📨 Preguntas y Operaciones (`/api/questions`)

### 1. Listar Preguntas
* **Método / Ruta**: `GET /api/questions`
* **Headers (Opcional)**: `Authorization: Bearer <token>` (si es tenant, filtra automáticamente por su `sellerId`).
* **Respuesta**: Preguntas agrupadas por `pending_review`, `auto_answered`, `other`.

### 2. Aprobar Respuesta
* **Método / Ruta**: `POST /api/questions/:id/approve`
* **Body (Opcional)**: `{ "text": "Texto editado por el operador" }`

### 3. Rechazar Pregunta
* **Método / Ruta**: `POST /api/questions/:id/reject`

### 4. Aprobación vía WhatsApp
* **Método / Ruta**: `POST /api/whatsapp/reply`
* **Body**: `{ "question_id": "12345", "reply_text": "1" }`

---

## 🔔 Webhooks y Eventos en Vivo

* `POST /webhook/ml`: Recibe eventos de Mercado Libre (tópico `questions`). Responde 200 en <50ms y encola.
* `GET /api/events/stream?seller_id=MLA...`: Conexión Server-Sent Events en tiempo real.
* `POST /api/simulate-question`: Endpoint de simulación para pruebas interactivas.
