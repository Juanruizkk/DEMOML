## CONTEXTO

Estoy construyendo una demo funcional y de alto impacto visual de un sistema que responde automáticamente las preguntas pre-venta de publicaciones de Mercado Libre Argentina, con aprobación humana para preguntas sensibles o fuera de alcance. Es para mostrar en una llamada comercial con clientes, no es para producción.

Yo ya me encargo por fuera de: crear la app en el DevCenter de MELI, crear los usuarios de test (uno vendedor, uno comprador), publicar los ítems de prueba y levantar el túnel HTTPS (ej. ngrok/localtunnel). Vos construí la aplicación completa lista para ejecutar.

**El objetivo principal de la demo es visual y de velocidad:** durante la llamada se comparte pantalla con dos ventanas en paralelo: Mercado Libre a la izquierda, este panel a la derecha. Alguien escribe una pregunta en la publicación real (o usa el simulador interno de prueba) y en el panel se tiene que ver el evento entrando en tiempo real y la respuesta publicándose en segundos (< 1.5s total). Priorizá que ese recorrido se vea claro, fluido y profesional por encima de cualquier otra cosa.

## STACK

- **Backend:** Node.js 20+ con Express
- **LLM Engine:** LangChain.js (`@langchain/groq`, `@langchain/anthropic`, `@langchain/openai`, `@langchain/core`, `zod`) con **Groq (`llama-3.3-70b-versatile`) como proveedor predeterminado** por su velocidad extrema (<500ms) y tier gratuito, intercambiable a Anthropic u OpenAI mediante variables de entorno sin modificar código.
- **Base de Datos:** SQLite local con `better-sqlite3` (archivo local `data/meli_bot.db`, sin Docker, sin Postgres).
- **Tiempo Real:** Server-Sent Events (SSE) nativo (`GET /api/events/stream`) para actualización instantánea de la consola de eventos y estados en la UI, con fallback automático a polling cada 2s.
- **Frontend:** Single-page dashboard en `public/index.html`, `public/styles.css` y `public/app.js` (JavaScript vanilla moderno, sin frameworks pesados, sin build step, diseño oscuro premium con glassmorphism).
- **Ejecución:** Todo en un solo repositorio, arranca con `npm install && npm start`.
- **Cola:** Cola en memoria asíncrona (in-memory queue) para procesamiento background sin bloquear webhooks.

## VARIABLES DE ENTORNO (.env)

```env
# Servidor
PORT=3000
AUTO_ANSWER_ENABLED=true

# Mercado Libre API & OAuth
ML_CLIENT_ID=
ML_CLIENT_SECRET=
ML_REDIRECT_URI=http://localhost:3000/oauth/callback
ML_SELLER_ID=

# Configuración de LLM (LangChain)
# Proveedores soportados: "groq" | "anthropic" | "openai"
LLM_PROVIDER=groq

# API Keys según proveedor
GROQ_API_KEY=
ANTHROPIC_API_KEY=
OPENAI_API_KEY=

# Modelos (opcionales, tienen defaults inteligentes)
# Groq default: llama-3.3-70b-versatile
# Anthropic default: claude-3-5-sonnet-latest
# OpenAI default: gpt-4o-mini
LLM_MODEL=llama-3.3-70b-versatile
```

Incluí un `.env.example` completo y agregá `.env`, `*.db`, `*.db-journal` y `node_modules` al `.gitignore`.

## API DE MERCADO LIBRE — Datos exactos y comportamiento

Base API: `https://api.mercadolibre.com`. Todas las llamadas autenticadas van con header `Authorization: Bearer $ACCESS_TOKEN`.

### 1. Autenticación y OAuth 2.0
URL de autorización para el vendedor (generar helper en el README y en `/api/health`):
`https://auth.mercadolibre.com.ar/authorization?response_type=code&client_id=$ML_CLIENT_ID&redirect_uri=$ML_REDIRECT_URI`

- **Intercambio de code inicial (`GET /oauth/callback`):**
  ```http
  POST https://api.mercadolibre.com/oauth/token
  Content-Type: application/x-www-form-urlencoded

  grant_type=authorization_code&client_id=$ML_CLIENT_ID&client_secret=$ML_CLIENT_SECRET&code=$CODE&redirect_uri=$ML_REDIRECT_URI
  ```

- **Refresh Token (CRÍTICO):**
  ```http
  POST https://api.mercadolibre.com/oauth/token
  Content-Type: application/x-www-form-urlencoded

  grant_type=refresh_token&client_id=$ML_CLIENT_ID&client_secret=$ML_CLIENT_SECRET&refresh_token=$REFRESH_TOKEN
  ```
  *Regla estricta de MELI:* El `refresh_token` es de **un solo uso**. Cada refresh devuelve un par nuevo (`access_token`, `refresh_token`) y el anterior queda invalidado de inmediato.
  *Implementación:* Creá un módulo singleton `lib/meli-auth.js` con una única función `getValidToken()`. Debe usar un semáforo/promesa mutex en memoria para que múltiples llamadas concurrentes no disparen refrescos en paralelo. Guardá el nuevo par atómicamente en SQLite. Refrescá automáticamente si faltan menos de 10 minutos para la expiración.

### 2. Notificación entrante (Webhook)
Body que envía Mercado Libre:
```json
{
  "_id": "65123abc...",
  "resource": "/questions/5036111111",
  "user_id": 123456789,
  "topic": "questions",
  "application_id": 987654321,
  "attempts": 1,
  "sent": "2026-09-10T16:19:20.129Z",
  "received": "2026-09-10T16:19:20.106Z"
}
```
**Requisito de latencia:** Devolver `HTTP 200 { received: true }` en **menos de 50 ms**. El handler de `POST /webhook/ml` solo debe:
1. Validar que `topic === "questions"`.
2. Parsear el `question_id` de `resource`.
3. Emitir el evento de recepción a SQLite y SSE stream.
4. Responder 200 OK inmediatamente.
5. Encolar el `question_id` en el worker en memoria para procesamiento asíncrono.

### 3. Endpoints de MELI utilizados por el Worker
```http
GET  /questions/$QUESTION_ID
GET  /items/$ITEM_ID
GET  /items/$ITEM_ID/description
GET  /users/$ML_SELLER_ID/questions/response_time
POST /answers
     Body: {"question_id": 123456789, "text": "Hola! Sí, tenemos stock disponible en color negro. Saludos!"}
```
- `GET /questions/$ID` devuelve: `id`, `text`, `status`, `item_id`, `date_created`, `from.id`. Status relevantes: `UNANSWERED`, `ANSWERED`, `BANNED`, `CLOSED_UNANSWERED`.
- `GET /items/$ITEM_ID` devuelve: `title`, `price`, `available_quantity`, `condition`, `permalink`, `attributes[]` (cada uno con `name` y `value_name`), `variations[]`.
- `GET /items/$ITEM_ID/description` devuelve: `plain_text`.
- Límite estricto de respuesta en MELI: máximo 2000 caracteres.

---

## ARQUITECTURA DEL WORKER & LANGCHAIN INTEGRATION

Para cada `question_id` recibido encolado:

1. **Deduplicación:** Si la pregunta ya fue procesada o está en curso, ignorar.
2. **Chequeo de estado en MELI (`GET /questions/$ID`):** Si el status ya no es `UNANSWERED`, marcar como `skipped_already_answered` (alguien pudo haber respondido desde la app móvil).
3. **Cache de Ítem:** Consultar `GET /items/$ITEM_ID` y `GET /items/$ITEM_ID/description`. Cachear la información en SQLite por 5 minutos para no re-consultar el mismo ítem en ráfagas de preguntas.
4. **Clasificación y Generación con LangChain.js (`lib/llm-service.js`):**
   - Instanciar el modelo dinámicamente según `process.env.LLM_PROVIDER`:
     - `groq`: `new ChatGroq({ model: process.env.LLM_MODEL || "llama-3.3-70b-versatile", temperature: 0.1, apiKey: process.env.GROQ_API_KEY })`
     - `anthropic`: `new ChatAnthropic({ model: process.env.LLM_MODEL || "claude-3-5-sonnet-latest", temperature: 0.1, apiKey: process.env.ANTHROPIC_API_KEY })`
     - `openai`: `new ChatOpenAI({ model: process.env.LLM_MODEL || "gpt-4o-mini", temperature: 0.1, apiKey: process.env.OPENAI_API_KEY })`
   - Utilizar `.withStructuredOutput(questionSchema)` con **Zod**:
     ```javascript
     import { z } from "zod";

     export const questionSchema = z.object({
       intent: z.enum([
         "stock",
         "envio",
         "caracteristicas",
         "garantia",
         "facturacion",
         "precio_negociacion",
         "reclamo",
         "contacto_externo",
         "otro"
       ]).describe("Intención principal de la pregunta del comprador"),
       confidence: z.number().min(0).max(1).describe("Nivel de certeza de 0 a 1"),
       requires_human: z.boolean().describe("true si requiere intervención humana obligatoria"),
       reason: z.string().nullable().describe("Motivo de derivación humana o null si se auto-responde"),
       answer: z.string().max(2000).describe("Texto de la respuesta propuesta en tono cordial rioplatense")
     });
     ```

   - **Reglas del System Prompt:**
     - Responder **ÚNICAMENTE** basándose en los datos explícitos del ítem (título, precio, stock, atributos, descripción). Si un dato no figura en la publicación, marcar `requires_human: true` y `reason: "Dato no disponible en la publicación"`.
     - Marcar `requires_human: true` **SIEMPRE** para:
       - Pedidos de descuento, rebaja o negociación de precio.
       - Preguntas sobre garantía extendida no descrita o devoluciones conflictivas.
       - Reclamos o quejas.
       - Preguntas sobre facturación A si la publicación no especifica claramente condición fiscal.
       - Intentos de contacto o datos personales.
     - Tono: Cordial, argentino estándar / rioplatense profesional ("Hola! Sí, tenemos...", "Buenas! Por el momento..."), conciso (1 a 3 oraciones), sin emojis exagerados, sin prometer cosas no verificables.

5. **Validador Determinístico de Moderación (`lib/moderation.js`):**
   Corre **SIEMPRE** después del LLM y antes de publicar. Si detecta cualquiera de los siguientes patrones, anula la auto-respuesta y fuerza `requires_human: true` con `reason = "moderation_block: <detalle>"`:
   - Números de teléfono o secuencias numéricas sospechosas (regex para 8+ dígitos con o sin guiones/espacios/puntos).
   - Emails o patrones tipo `usuario [arroba] dominio`.
   - URLs, dominios sueltos (.com, .ar, .net, http, www, etc.).
   - Palabras clave de contacto externo o pago por fuera: `whatsapp`, `wsp`, `wapp`, `telegram`, `celular`, `instagram`, `ig`, `facebook`, `fb`, `por fuera`, `por fuera de ml`, `transferencia directa`, `mp fuera`.
   - Respuestas vacías o con longitud mayor a 2000 caracteres.
   *Nota:* Esto protege la cuenta de Mercado Libre de baneos inmediatos por infracción de políticas de contacto.

6. **Decisión de Publicación:**
   - Si `requires_human === false` && `confidence >= 0.75` && `AUTO_ANSWER_ENABLED === "true"`:
     - Ejecutar `POST /answers` a la API de MELI.
     - Marcar estado `auto_answered` y registrar `answered_at`.
   - En caso contrario:
     - Marcar estado `pending_review`.
     - Enviar notificación instantánea por SSE para que aparezca en la columna "Cola de Revisión" del panel.

7. **Registro de Telemetría:** Cada fase del pipeline registra un evento en la tabla `events` (ej. `webhook_received`, `item_fetched`, `llm_classified`, `moderation_passed`, `answer_published`) con timestamp exacto y duración en ms (`duration_ms`), enviándose por SSE al frontend.

---

## MODELO DE BASE DE DATOS (SQLite)

Crear las tablas automáticamente al iniciar `lib/db.js`:

```sql
CREATE TABLE IF NOT EXISTS tokens (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS questions (
  question_id TEXT PRIMARY KEY,
  item_id TEXT NOT NULL,
  buyer_id TEXT,
  text TEXT NOT NULL,
  ml_status TEXT,
  intent TEXT,
  confidence REAL,
  requires_human INTEGER DEFAULT 0,
  reason TEXT,
  suggested_answer TEXT,
  final_answer TEXT,
  app_status TEXT NOT NULL, -- 'received'|'processing'|'auto_answered'|'pending_review'|'approved'|'rejected'|'error'|'skipped_already_answered'
  received_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  answered_at DATETIME,
  latency_ms INTEGER,
  ml_error TEXT
);

CREATE TABLE IF NOT EXISTS items_cache (
  item_id TEXT PRIMARY KEY,
  payload_json TEXT NOT NULL,
  cached_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  question_id TEXT,
  type TEXT NOT NULL,
  message TEXT NOT NULL,
  duration_ms INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS app_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
```

---

## RUTAS HTTP & API

```
# Webhook & OAuth
POST /webhook/ml                   → Recibe notificación de MELI (<50ms ack)
GET  /oauth/callback               → Intercambia code OAuth y almacena tokens
GET  /oauth/login                  → Redirecciona a la URL de login de Mercado Libre

# SSE & Eventos en Vivo
GET  /api/events/stream            → Stream SSE nativo (logs y updates en tiempo real)
GET  /api/events?since=            → Historial reciente de eventos (fallback)

# Panel & Operaciones
GET  /api/questions                → Lista todas las preguntas agrupadas por estado
POST /api/questions/:id/approve    → Body { text? } - Publica la respuesta en MELI y pasa a 'approved'
POST /api/questions/:id/reject     → Marca como 'rejected' (ignora en panel)
GET  /api/response-time            → Proxy a /users/$SELLER_ID/questions/response_time de MELI
GET  /api/health                   → Estado de tokens, modelo LLM activo y conectividad
POST /api/config/auto-answer       → Body { enabled: boolean } - Toggle en caliente de respuesta automática
POST /api/simulate-question        → Body { text, item_title, item_price, intent_hint } - Dispara flujo simulado
```

---

## DISEÑO DEL PANEL (public/index.html + CSS + JS)

Diseño **oscuro premium** (paleta Slate / Indigo / Emerald / Amber / Rose), tipografía moderna (Inter vía Google Fonts), optimizado para legibilidad a distancia en videollamada comercial.

### Estructura de la Pantalla:
1. **Header Superior:**
   - Título: **MELI AI Assistant • Live Auto-Responder**
   - Badges de estado: `Provider: Groq (Llama 3.3 70B)` | `Token: Activo (expira en 5h)` | `SSE: Conectado`
   - Switch interactivo destacado: **"Respuesta Automática: [ ON / OFF ]"** (al hacer click, cambia la configuración por API y actualiza el badge visualmente).
   - Botón **"⚡ Simular Pregunta"** (abre un modal/drawer con 4 botones rápidos: *Stock simple*, *Descuento/Rebaja*, *Contacto ilegal/WSP*, *Pregunta técnica*).

2. **Fila de Métricas (Tiempos de Respuesta MELI):**
   - 4 tarjetas con métricas de `/api/response-time`:
     - Promedio Total (minutos)
     - Días hábiles horario laboral
     - Días hábiles fuera de hora
     - Fines de semana
   - Si la API reporta `sales_percent_increase`, mostrar un badge destacado de oportunidad comercial.

3. **Cuerpo Principal (Grid de 3 Columnas):**
   - **Columna Izquierda — Cola de Revisión Humana (`pending_review`):**
     - Tarjetas destacadas con borde ámbar/amarillo.
     - Muestra: Pregunta del comprador, badge de intención (`precio_negociacion`, `contacto_externo`, etc.), motivo de bloqueo humano, `<textarea>` editable con la respuesta sugerida por el LLM, y botones **"✓ Aprobar y Publicar"** y **"✗ Descartar"**.
     - Al aprobar, animación suave y transición de la tarjeta a publicada.
   - **Columna Central — Respondidas Automáticamente (`auto_answered`):**
     - Tarjetas con acento verde/emerald.
     - Contador gigante de latencia: **`⚡ Respondido en 1.1s`** (el elemento visual más impactante de la demo).
     - Muestra pregunta original, ítem y respuesta publicada.
   - **Columna Derecha — Consola de Eventos en Vivo (Live Stream):**
     - Estilo terminal oscuro con autoscroll y timestamps en verde fosforescente.
     - Desglose paso a paso de cada pregunta:
       ```
       [09:15:02.100] 📥 Webhook recibido (question_id: 5036111111) [2ms]
       [09:15:02.180] 📦 Ítem obtenido de MELI cacheado [78ms]
       [09:15:02.650] 🧠 Clasificado por Groq (Llama 3.3 70B) -> intent: stock, conf: 0.98 [470ms]
       [09:15:02.655] 🛡️ Moderación determinística: APROBADA [5ms]
       [09:15:03.210] 🚀 Publicado en Mercado Libre API (200 OK) [555ms]
       [09:15:03.212] ✅ Flujo completado en 1.112s
       ```

---

## GUIÓN DE LA DEMO COMERCIAL (Incluir en README.md)

El `README.md` debe incluir el paso a paso exacto para el presentador:
1. **Paso 1: Demostrar Velocidad Inmediata (Stock simple)**
   - Escribir en la publicación de MELI: *"Hola, tenés stock para retirar hoy?"*
   - Ver cómo en ~1 segundo entra el evento en la consola, Groq genera la respuesta y se publica sola en Mercado Libre con el contador `Respondido en 1.1s`.
2. **Paso 2: Demostrar Criterio y Seguridad (Negociación/Humano)**
   - Preguntar: *"Hola, me hacés un 15% de descuento si compro 5 unidades?"*
   - Mostrar cómo el sistema identifica `intent: precio_negociacion`, no responde solo, lo deriva a la "Cola de Revisión" con el motivo exacto, y el operador puede editar la respuesta sugerida y hacer click en "Aprobar".
3. **Paso 3: Demostrar Blindaje contra Sanciones de MELI (Moderación)**
   - Preguntar: *"Pasame tu celular o whatsapp así coordinamos por afuera"*
   - Mostrar cómo la capa de moderación determinística intercepta el intento antes de cualquier publicación y previene el baneo de la cuenta.
4. **Paso 4: Demostrar Modo Semi-Automático (Switch OFF)**
   - Apagar el switch "Respuesta Automática".
   - Enviar una pregunta de stock: ahora todas pasan a la cola para revisión con 1-click approval.
5. **Paso 5: Simulador Integrado para práctica offline**
   - Mostrar el botón de simulación rápida en caso de no tener una cuenta compradora activa a mano durante la llamada.

---

## ENTREGABLES ESPERADOS

1. Todo el código fuente funcional (`package.json`, `server.js`, `lib/`, `public/`).
2. `.env.example` completo con variables para Groq, Anthropic y OpenAI.
3. `README.md` detallado con:
   - Instrucciones de instalación (`npm install && npm start`).
   - Guía de configuración con ngrok (`ngrok http 3000`) para configurar el webhook en DevCenter de Mercado Libre.
   - Enlace directo de autorización OAuth.
   - Guión comercial en 5 pasos.

Empezá por presentar la estructura de archivos y arrancá la implementación paso a paso.
