# MELI AI Assistant — Live Auto-Responder

Demo funcional de un sistema que responde automáticamente las preguntas pre-venta de publicaciones de Mercado Libre Argentina, con aprobación humana para preguntas sensibles o fuera de alcance. Pensada para mostrarse en una llamada comercial, con dos ventanas en paralelo (Mercado Libre + este panel) y respuestas visibles en segundos.

> **No apta para producción.** No tiene autenticación de usuarios del panel, rate limiting, ni manejo de errores de nivel productivo.

## 1. Instalación

```bash
npm install
cp .env.example .env
```

Completá `.env` con tus credenciales (ver sección 3). Luego:

```bash
npm start
```

El panel queda disponible en `http://localhost:3000`.

## 2. Stack

- **Backend:** Node.js 20+ / Express
- **LLM:** LangChain.js con Groq (`llama-3.3-70b-versatile`) por defecto — intercambiable a Anthropic u OpenAI vía `.env`, sin tocar código.
- **DB:** SQLite local (`better-sqlite3`), archivo en `data/meli_bot.db`.
- **Tiempo real:** Server-Sent Events nativo (`/api/events/stream`).
- **Frontend:** HTML/CSS/JS vanilla, sin build step.

## 3. Configuración con ngrok + DevCenter de Mercado Libre

Mercado Libre necesita una URL HTTPS pública para mandar los webhooks de preguntas. Este proyecto asume que vos ya creaste la app en el DevCenter, los usuarios de test y publicaste los ítems de prueba — acá va solo la parte de conectar el túnel:

1. Levantá el túnel:
   ```bash
   ngrok http 3000
   ```
   Copiá la URL HTTPS que te da (ej. `https://abcd1234.ngrok-free.app`).

2. En el [DevCenter de Mercado Libre](https://developers.mercadolibre.com.ar/devcenter), en tu aplicación:
   - Configurá el **Webhook de notificaciones** apuntando a `https://TU_URL_NGROK/webhook/ml`, con el tópico `questions` habilitado.
   - Configurá la **Redirect URI** igual a la que tenés en `ML_REDIRECT_URI` (por defecto `http://localhost:3000/oauth/callback` — si usás ngrok también para el callback, actualizá esta variable).

3. Completá en `.env`:
   ```env
   ML_CLIENT_ID=<tu client_id>
   ML_CLIENT_SECRET=<tu client_secret>
   ML_REDIRECT_URI=http://localhost:3000/oauth/callback
   ML_SELLER_ID=<user_id del vendedor de test>
   ```

4. Autorizá la cuenta vendedora entrando a:
   ```
   http://localhost:3000/oauth/login
   ```
   Esto te redirige a Mercado Libre para loguearte con el **usuario vendedor de test** y aceptar los permisos. Al volver, el panel queda conectado (podés confirmarlo en `GET /api/health`, que también expone el link de autorización directo).

5. Cargá una API key de LLM (`GROQ_API_KEY` es la más rápida y tiene tier gratuito) y arrancá el servidor.

## 4. Guión de la demo comercial (5 pasos)

Compartí pantalla con dos ventanas: **Mercado Libre** a la izquierda (logueado como comprador de test), **este panel** a la derecha.

### Paso 1 — Velocidad inmediata (Stock simple)
Escribí en la publicación de MELI:
> "Hola, tenés stock para retirar hoy?"

En ~1 segundo el evento entra en la consola en vivo, Groq genera la respuesta, y se publica sola en Mercado Libre. El contador **`⚡ Respondido en 1.1s`** en la columna central es el momento más fuerte de la demo.

### Paso 2 — Criterio y seguridad (Negociación → humano)
Preguntá:
> "Hola, me hacés un 15% de descuento si compro 5 unidades?"

El sistema clasifica `intent: precio_negociacion`, **no responde solo**, y la pregunta aparece en la "Cola de Revisión" con el motivo exacto. El operador puede editar la respuesta sugerida en el `<textarea>` y hacer click en "✓ Aprobar y Publicar".

### Paso 3 — Blindaje contra sanciones de MELI (Moderación)
Preguntá:
> "Pasame tu celular o whatsapp así coordinamos por afuera"

La capa de moderación determinística (regex, corre siempre después del LLM) intercepta el intento **antes de cualquier publicación**, evitando el baneo de la cuenta por infracción de políticas de contacto.

### Paso 4 — Modo semi-automático (switch OFF)
Apagá el switch **"Respuesta Automática"** en el header. Enviá una pregunta de stock: ahora incluso las preguntas simples pasan a la cola de revisión, con aprobación en 1 click.

### Paso 5 — Simulador integrado
Si no tenés a mano una cuenta compradora activa durante la llamada, usá el botón **"⚡ Simular Pregunta"** (arriba a la derecha) con los 4 escenarios rápidos: Stock simple, Descuento/Rebaja, Contacto ilegal/WSP, Pregunta técnica. Corre el mismo pipeline (clasificación + moderación) sin llamar a la API real de Mercado Libre.

## 5. Estructura del proyecto

```
server.js               Rutas HTTP, webhook, OAuth, SSE
lib/db.js                Setup SQLite + esquema
lib/meli-auth.js         OAuth + refresh de tokens (mutex, un solo uso)
lib/meli-api.js          Cliente MELI (items, preguntas, respuestas, cache)
lib/llm-service.js       LangChain.js + Zod, clasificación y generación
lib/moderation.js        Validador determinístico de moderación
lib/worker.js            Cola en memoria y pipeline por pregunta
lib/events.js            Telemetría (SQLite + SSE)
lib/sse.js               Hub de Server-Sent Events
public/index.html        Panel
public/styles.css        Diseño oscuro premium
public/app.js            Lógica del panel (SSE, board, simulador)
```

## 6. Variables de entorno

Ver `.env.example`. Los proveedores de LLM soportados son `groq`, `anthropic` y `openai`, seleccionables con `LLM_PROVIDER` sin cambiar código.
