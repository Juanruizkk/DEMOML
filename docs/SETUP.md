# MELI AI Assistant — Guía de setup y runbook

Demo de auto-respuesta de preguntas pre-venta de Mercado Libre con LangChain.js,
moderación determinística y aprobación humana.

## 1. Prerrequisitos

- Node.js 24+
- Cuenta de ngrok (plan free alcanza) con dominio estático reservado
- Cuenta de Mercado Libre developer con la app ya creada en el DevCenter

https://developers.mercadolibre.com.ar/devcenter

## 2. Clonar y configurar

```powershell
git clone <repo>
cd ProyectoML
npm install
copy .env.example .env
```

Completá `.env` con estos valores (el Client Secret y la Groq API key **no están en este
documento a propósito** — son secretos reales y este archivo se sube al repo. Pedímelos
por un canal seguro, o generá una Groq key nueva gratis en https://console.groq.com/keys
y una nueva Client Secret desde el DevCenter si preferís rotarlas):

```
PORT=3000
AUTO_ANSWER_ENABLED=true

ML_CLIENT_ID=4321332576904880
ML_CLIENT_SECRET=<pedir / rotar>
ML_REDIRECT_URI=https://<tu-dominio-ngrok>.ngrok-free.dev/oauth/callback
ML_SELLER_ID=

LLM_PROVIDER=groq
GROQ_API_KEY=<pedir / rotar>
LLM_MODEL=openai/gpt-oss-120b
```

## 3. Levantar ngrok

```powershell
ngrok http --domain=<tu-dominio-reservado>.ngrok-free.dev 3000
```

Si el dominio estático cambió respecto al que tenías, actualizá:
- `ML_REDIRECT_URI` en `.env`
- **Redirect URIs** en el DevCenter de la app
- **Notificaciones callbacks URL** en el DevCenter (`.../webhook/ml`)

## 4. Levantar el servidor

```powershell
npm run dev
```

Con `--watch`, así los cambios de código reinician el server solo. Vas a ver:

```
🚀 MELI AI Assistant corriendo en http://localhost:3000
   Panel:            http://localhost:3000
   OAuth login:      http://localhost:3000/oauth/login
   Health check:     http://localhost:3000/api/health
```

## 5. Autorizar la app contra Mercado Libre

El token vive en la base SQLite local (`data/meli_bot.db`, gitignoreada) — no viaja con
el `git pull`, así que hay que regenerarlo en cada máquina nueva:

1. Logueate en el navegador con el usuario **vendedor de test** (ver credenciales abajo).
2. Andá a `http://localhost:3000/oauth/login`.
3. Aceptá el consentimiento (si aparece) — el server captura el `code` en
   `/oauth/callback` y guarda el token automáticamente.
4. Confirmá con `GET http://localhost:3000/api/health` que `tokenStatus.connected: true`.

⚠️ Importante: la base solo guarda **un** token a la vez. Loguearte con otro usuario
(por ejemplo tu cuenta real) pisa el token del vendedor. Para que el bot conteste
preguntas necesitás que el token guardado sea el del **vendedor de test**, no el
comprador ni tu cuenta real.

## 6. Usuarios de test

| Rol | User ID | Nickname | Password |
|---|---|---|---|
| Vendedor | `3680586616` | `TESTUSER4327702539223624795` | `QFxIljwqcj` |
| Comprador | `3677130936` | `TESTUSER2533156973119126771` | `0PZfM1kGU1` |

Notas:
- Site: `MLA` (Argentina).
- Mercado Libre no tiene sandbox: estos son usuarios reales pero aislados — solo
  pueden operar (comprar/vender/preguntar) entre sí y sobre publicaciones de test.
- **Expiran a los 60 días sin actividad.** Si dejan de funcionar, recrealos:
  ```powershell
  $ACCESS_TOKEN = "<token vigente de tu cuenta real, con permiso Usuarios activo>"
  Invoke-RestMethod -Method Post -Uri "https://api.mercadolibre.com/users/test_user" `
    -Headers @{ "Authorization" = "Bearer $ACCESS_TOKEN"; "Content-Type" = "application/json" } `
    -Body '{"site_id":"MLA"}'
  ```
  Guardá `id`, `nickname`, `password` de la respuesta — no se pueden recuperar después.

## 7. Publicación de prueba activa

- **Item ID**: `MLA2079747751`
- **Link**: https://articulo.mercadolibre.com.ar/MLA-2079747751-auriculares-bluetooth-auriculares-inalambricos-auriculares-auriculares-auriculares-auriculares-micro-sd-negros-negro-_JM
- Categoría: Auriculares (`MLA3697`), asociado a un **producto real del catálogo**
  (`catalog_product_id: MLA73670546`) — ver sección de troubleshooting sobre por qué.

Para republicar uno nuevo (por ejemplo si este expira o se pausa), con el token del
vendedor ya autorizado (paso 5):

```powershell
Invoke-RestMethod -Method Post -Uri "http://localhost:3000/api/test/publish-item" `
  -Headers @{ "Content-Type" = "application/json" } -Body '{}'
```

Devuelve el `id` y `permalink` del ítem nuevo.

## 8. Probar el flujo completo

1. En una ventana **incógnito**, logueate como el usuario **comprador** de test.
2. Entrá directo al link del ítem (paso 7) — **no lo busques**, los ítems de test no
   aparecen en el buscador de Mercado Libre.
3. Hacé una pregunta real desde la página del producto.
4. En el panel (`http://localhost:3000`) debería aparecer en la cola de revisión
   (o auto-respondida, según el umbral de confianza) en menos de 15 segundos.
5. Aprobá la respuesta desde el panel y verificá que se publique de verdad en
   Mercado Libre (recargá la página del ítem del lado del comprador).

## 9. Troubleshooting — problemas ya resueltos

### "La aplicación no está preparada para conectarse" / no autoriza
Causas típicas: `client_id` mal copiado, `redirect_uri` que no coincide exacto con el
configurado en el DevCenter, o estar logueado con un usuario que no es el dueño/admin
de la app.

### El ítem redirige a `listado.mercadolibre.com.ar/...#redirectedFromVip`
El ítem quedó en `status: under_review, sub_status: waiting_for_patch`. Pasa cuando se
publica con `family_name`/marca/modelo inventados en una categoría con
`catalog_domain` real: la moderación automática de ML lo tumba unos segundos después
de crearlo porque no matchea ningún producto de catálogo. Solución: publicar con
`catalog_product_id` de un producto real existente (ver `lib/meli-api.js`,
`publishTestItem`), no con atributos inventados. La categoría genérica "Otros"
(`MLA3530`, dominio `MLA-UNCLASSIFIED_PRODUCTS`) es la peor opción para esto porque
requiere revisión manual.

### El webhook de `questions` nunca llega (pero `items` sí)
Confirmado con el inspector de ngrok (`http://127.0.0.1:4040`) y con
`GET /missed_feeds?app_id=...&topic=questions` (0 intentos registrados, ni exitosos ni
fallidos) — Mercado Libre nunca generó la notificación pese a que el tópico aparecía
tildado y guardado en el DevCenter. No se llegó a la causa raíz.

**Workaround implementado**: `lib/worker.js` → `startQuestionsPoller()` hace polling a
`/my/received_questions/search` cada 15 segundos como respaldo, sin depender del
webhook. Se arranca solo al levantar el server (`server.js`, `app.listen`). Si en algún
momento el webhook empieza a andar, este poller no estorba (dedupe por `question_id`).

### Las respuestas se marcaban "approved" en el panel pero nunca llegaban a Mercado Libre
Bug en `server.js`, endpoint `POST /api/questions/:id/approve`: la condición para
detectar preguntas simuladas (`Number(id) >= 900000000`) también matcheaba los IDs
reales de Mercado Libre (que son números de 11+ dígitos, muy por encima de 900 millones),
así que el `POST /answers` real nunca se ejecutaba — quedaba todo silenciosamente
simulado. Ya corregido: ahora solo se considera simulada una pregunta si
`item_id === "SIMULATED"` o `buyer_id === "simulador"`.

### `npm start` tira `EADDRINUSE :::3000`
Ya hay un proceso corriendo en el puerto 3000 (probablemente `npm run dev` de una
sesión anterior). Buscalo y matalo antes de levantar uno nuevo:

```powershell
Get-NetTCPConnection -LocalPort 3000 -State Listen | Select-Object OwningProcess
Stop-Process -Id <PID> -Force
```

## 10. Endpoints propios de la demo

| Método | Ruta | Qué hace |
|---|---|---|
| `GET` | `/oauth/login` | Inicia el flujo OAuth contra Mercado Libre |
| `GET` | `/oauth/callback` | Recibe el `code`, canjea por token y lo guarda |
| `POST` | `/webhook/ml` | Recibe notificaciones de ML (topic `questions`) |
| `GET` | `/api/health` | Estado del token, proveedor LLM, auto-respuesta |
| `GET` | `/api/questions` | Preguntas agrupadas por estado |
| `POST` | `/api/questions/:id/approve` | Publica la respuesta (real o simulada) |
| `POST` | `/api/questions/:id/reject` | Descarta la respuesta sugerida |
| `POST` | `/api/simulate-question` | Dispara una pregunta fake para probar el pipeline sin tocar ML |
| `POST` | `/api/test/publish-item` | Publica un ítem de test nuevo con el vendedor autorizado |
| `GET` | `/api/test/last-item` | Último ítem publicado por el endpoint anterior |
| `GET` | `/api/response-time` | Tiempo de respuesta del vendedor (requiere `ML_SELLER_ID`) |
