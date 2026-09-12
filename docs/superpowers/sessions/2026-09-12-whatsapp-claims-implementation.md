# Sesión 2026-09-12 — WhatsApp Real (Meta Cloud API) & Módulo de Reclamos

## Resumen

En esta sesión se implementó completo el módulo de notificaciones WhatsApp reales via Meta Cloud API y el módulo de reclamos post-venta de Mercado Libre. Esto resuelve el problema principal: los vendedores no recibían notificaciones cuando ML abría un reclamo, perdían el plazo y ML forzaba reembolsos automáticos.

El trabajo se ejecutó con **Subagent-Driven Development**: 10 tareas, subagente fresco por tarea, revisión de spec + calidad por tarea.

---

## Problema resuelto

Antes: Las "notificaciones WhatsApp" del sistema eran solo eventos SSE (Server-Sent Events) que llegaban al tab del navegador abierto. Si el vendedor no tenía el panel abierto, no se enteraba de nada.

Ahora: Cuando ML abre un reclamo, el sistema llama directo a la Meta Graph API v21.0 y envía un mensaje real al celular del vendedor con botones interactivos.

---

## Commits del feature (11 commits)

```
e474579  feat: add Claim domain entity with urgency/SLA logic
b94e93b  feat: add IWhatsAppClient, IClaimRepository interfaces; extend IMeliClient with getClaim
1581c21  feat: implement MetaWhatsAppClient adapter for Meta Graph API v21.0
13a4d93  feat: add claims table schema and SqliteClaimRepository
6f88be9  feat: implement getClaim in MeliApiClient
861161b  feat: add IngestClaimWebhookUseCase and ProcessClaimUseCase with WA alerts
625e439  fix: remove unsafe type casts in claims use cases
5ccc330  feat: add HandleWhatsAppReplyUseCase for routing WA button replies
f9d6bb9  feat: add WhatsAppWebhookController (Meta challenge + message receiver)
2f73b0b  feat: wire IWhatsAppClient into ProcessQuestionUseCase for real WA alerts on human review
0e2596c  feat: wire claims and WhatsApp into WebhookController and app.ts
```

---

## Archivos creados

| Archivo | Responsabilidad |
|---------|----------------|
| `src/domain/entities/Claim.ts` | Entidad de dominio con lógica de urgencia/SLA |
| `src/application/interfaces/IWhatsAppClient.ts` | Puerto: sendTextMessage, sendInteractiveButtons, sendTemplate |
| `src/application/interfaces/IClaimRepository.ts` | Puerto: save, findById, listBySellerId |
| `src/infrastructure/whatsapp/MetaWhatsAppClient.ts` | Adaptador Meta Graph API v21.0 |
| `src/infrastructure/persistence/sqlite/SqliteClaimRepository.ts` | Implementación SQLite de IClaimRepository |
| `src/application/use-cases/IngestClaimWebhookUseCase.ts` | Recibe webhook ML, extrae claimId, dispara ProcessClaimUseCase |
| `src/application/use-cases/ProcessClaimUseCase.ts` | Fetch ML → persistir → alerta WhatsApp → SSE |
| `src/application/use-cases/HandleWhatsAppReplyUseCase.ts` | Rutea respuestas WA a approve/reject/ack |
| `src/presentation/controllers/WhatsAppWebhookController.ts` | GET challenge + POST receiver de Meta |
| `src/tests/Claim.test.ts` | 5 tests: urgencia, SLA, markNotified |
| `src/tests/ProcessClaimUseCase.test.ts` | 5 tests: fetch+persist, WA condicional, SSE, mapeo PDD |
| `src/tests/HandleWhatsAppReplyUseCase.test.ts` | 4 tests: approve, reject, claim_ack, fallback |

## Archivos modificados

| Archivo | Cambio |
|---------|--------|
| `src/application/interfaces/IMeliClient.ts` | Agrega `MeliClaimDTO`, `MeliClaimPlayer`, `MeliClaimPlayerAction`, `getClaim()` |
| `src/infrastructure/meli/MeliApiClient.ts` | Implementa `getClaim()` via `/post-purchase/v1/claims/{id}` |
| `src/infrastructure/persistence/sqlite/SqliteDatabase.ts` | Tabla `claims` + 2 índices |
| `src/application/use-cases/ProcessQuestionUseCase.ts` | Inyecta `IWhatsAppClient` como 8° param; envía WA real cuando `requiresHuman` |
| `src/application/use-cases/IngestWebhookUseCase.ts` | Agrega `actions?: string[]` a `WebhookPayload` |
| `src/presentation/controllers/WebhookController.ts` | Bifurca por topic: `claims`/`post_purchase` → claimUseCase, resto → questionUseCase |
| `src/app.ts` | Cablea todos los componentes nuevos |

---

## Arquitectura del flujo de reclamos

```
ML Webhook POST /webhook/ml
        ↓
WebhookController
  topic === "claims" | "post_purchase"
        ↓
IngestClaimWebhookUseCase
  - extrae claimId de resource URL via regex /claims\/(\d+)/
  - responde 200 a ML
  - fire-and-forget → ProcessClaimUseCase
        ↓
ProcessClaimUseCase
  1. meliClient.getClaim(sellerId, claimId)
  2. Mapea a entidad Claim (tipo PNR/PDD, dueDate, actions)
  3. claimRepo.save(claim)
  4. tenantRepo.findBySellerId(sellerId)
  5. si tenant.settings.whatsappAlertPhone:
       whatsAppClient.sendInteractiveButtons(...)
       claim.markNotified()
       claimRepo.save(claim)
  6. sseNotifier.broadcastToSeller(...)
```

## Arquitectura del flujo de respuestas WhatsApp

```
Meta Webhook POST /webhook/whatsapp
        ↓
WhatsAppWebhookController.receive
  - responde 200 a Meta inmediatamente
  - parsea entry[0].changes[0].value.messages
        ↓
HandleWhatsAppReplyUseCase
  payload.startsWith("approve_")  → ApproveAnswerUseCase
  payload.startsWith("reject_")   → RejectAnswerUseCase
  payload.startsWith("claim_ack_") → eventRepo.log("claim_ack")
  otro texto libre               → mensaje de ayuda
```

---

## Variables de entorno requeridas

Agregar al `.env`:

```ini
# Meta WhatsApp Business Cloud API
META_WA_PHONE_NUMBER_ID=109283746501928
META_WA_ACCESS_TOKEN=EAAG...token_permanente_de_sistema...
META_WA_VERIFY_TOKEN=meli_bot_webhook_secret_token_123456
META_WA_WABA_ID=987654321098765
```

Configurar en el tenant (por vendedor):

```json
{ "whatsappAlertPhone": "+5491112345678" }
```

Este campo se guarda en `tenant.settings_json` y se expone via `PUT /api/tenant/settings`.

---

## Nuevos endpoints

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/webhook/whatsapp` | Verificación inicial de Meta (hub challenge) |
| POST | `/webhook/whatsapp` | Recepción de mensajes y clicks de botones de Meta |

---

## Lógica de urgencia (SLA)

| Horas restantes | Urgencia | Emoji |
|----------------|----------|-------|
| ≤ 12h | `critical` | 🔴 |
| ≤ 24h | `high` | 🟠 |
| > 24h | `normal` | 🟡 |

La `dueDate` del reclamo se calcula tomando la fecha más próxima entre las `available_actions` del vendedor respondente. Si no hay acciones con fecha, fallback: 48h desde ahora.

---

## Mapeo de tipos de reclamo

| `reason_id` prefix | `ClaimType` | Descripción |
|--------------------|-------------|-------------|
| `PNR*` | `med_pnr` | Paquete no recibido |
| `PDD*` | `med_pdd` | Producto defectuoso |
| otro | `other` | Otros motivos |

---

## Tests finales

**57 tests en 14 archivos — todos passing, 0 errores TypeScript**

```
src/tests/Claim.test.ts                    5 tests
src/tests/ProcessClaimUseCase.test.ts      5 tests
src/tests/HandleWhatsAppReplyUseCase.test.ts  4 tests
(+ 43 tests previos sin cambios)
```

---

## Decisiones de diseño tomadas

**¿Por qué no Twilio?** Se optó por Meta Cloud API directamente (gratis hasta 1000 conversaciones/mes, sin markup de Twilio).

**¿Por qué fire-and-forget en IngestClaimWebhookUseCase?** ML espera 200 en menos de 5 segundos. El procesamiento (fetch ML + DB + WA) puede tardar más. La respuesta 200 se envía antes de procesar.

**¿Por qué no usar la cola (InMemoryQueueBroker) para claims?** Los reclamos son time-sensitive (SLA de 12-48h). La cola agrega latencia innecesaria. El procesamiento va directo, fire-and-forget.

**Graceful degradation de MetaWhatsAppClient:** Si `META_WA_ACCESS_TOKEN` o `META_WA_PHONE_NUMBER_ID` no están configurados, el cliente loguea un `console.warn` y retorna sin error. El sistema funciona sin WA configurado.
