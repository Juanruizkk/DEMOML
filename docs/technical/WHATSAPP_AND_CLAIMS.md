# WhatsApp (Meta Cloud API) & Módulo de Reclamos

Cubre la arquitectura técnica de la integración con Meta WhatsApp Cloud API y el módulo de reclamos post-venta de Mercado Libre, más el modelo de negocio y estructura de costos para el SaaS.

---

## 1. Objetivos

1. **Meta WhatsApp Cloud API**: Enviar alertas reales a los teléfonos de los vendedores cuando llegan preguntas que requieren intervención humana o reclamos con SLA. Recibir respuestas/botones para aprobar/rechazar desde el chat.
2. **Módulo de Reclamos**: Ingestar webhooks de MELI con `topic: "claims"`, calcular urgencia por SLA, despachar alerta WhatsApp con cuenta regresiva.

---

## 2. Arquitectura de Capas

```mermaid
flowchart TD
    subgraph Webhooks_Inbound [Webhooks Entrantes]
        MELI_WH[Mercado Libre Webhook<br/>POST /webhook/ml<br/>topics: 'questions' & 'claims']
        META_WH[Meta WhatsApp Webhook<br/>GET /webhook/whatsapp (Challenge)<br/>POST /webhook/whatsapp (Respuestas)]
    end

    subgraph Application [Casos de Uso]
        IC[IngestClaimWebhookUseCase]
        PC[ProcessClaimUseCase]
        HWAR[HandleWhatsAppReplyUseCase]
        SWA[SendWhatsAppNotificationUseCase]
        LC[ListTenantClaimsUseCase]
    end

    subgraph Infrastructure [Infraestructura]
        MWC[MetaWhatsAppClient<br/>Meta Graph API v21.0]
        MELI_CLIENT[MeliApiClient<br/>GET /v1/claims/:id]
        SQLITE_CLAIM[SqliteClaimRepository]
        SSE[FastifySseNotifier]
    end

    MELI_WH --> IC --> PC --> MWC
    META_WH --> HWAR --> MWC
    PC --> SQLITE_CLAIM
    PC --> SSE
```

---

## 3. Entidad `Claim` (Dominio)

```typescript
export type ClaimType = "med_pnr" | "med_pdd" | "return" | "cancel_purchase" | "other";
export type ClaimStage = "claim" | "dispute" | "closed";
export type ClaimUrgency = "critical" | "high" | "normal";

// urgency se calcula por remainingHours:
// <= 12h → "critical" | <= 24h → "high" | > 24h → "normal"
```

Tabla SQLite `claims`: `id`, `seller_id`, `order_id`, `type`, `stage`, `status`, `reason`, `buyer_id`, `buyer_name`, `actions_json`, `due_date`, `notified_at`, `created_at`, `updated_at`.

---

## 4. Flujo de Procesamiento de Reclamo

`ProcessClaimUseCase`:
1. Recibe `claimId` + `sellerId` desde el webhook.
2. Llama a `meliClient.getClaim(sellerId, claimId)` → `GET /v1/claims/:id`.
3. Mapea a entidad `Claim`, calcula urgencia por `dueDate`.
4. Persiste en `SqliteClaimRepository`.
5. Si el tenant tiene `whatsappAlertPhone` configurado: envía alerta con `sendInteractiveButtons()` (tipo de reclamo, orden, tiempo restante, link a MELI).
6. Emite evento SSE `"claim_received"` al panel del vendedor.

---

## 5. Flujo de Respuesta WhatsApp

`HandleWhatsAppReplyUseCase` — procesa mensajes entrantes del vendedor:

| Payload | Acción |
|---|---|
| `approve_<questionId>` | Ejecuta `ApproveAnswerUseCase` |
| `reject_<questionId>` | Ejecuta `RejectAnswerUseCase` |
| `claim_ack_<claimId>` | Registra confirmación de lectura en auditoría |
| Texto libre | Publica esa respuesta exacta en Mercado Libre |

Responde al vendedor por WhatsApp: `"✅ Respuesta publicada con éxito en Mercado Libre"`.

---

## 6. Adaptador Meta Cloud API (`MetaWhatsAppClient`)

- **URL Base:** `https://graph.facebook.com/v21.0/{META_WA_PHONE_NUMBER_ID}/messages`
- **Auth:** `Authorization: Bearer {META_WA_ACCESS_TOKEN}`
- **Números:** Sanitiza a E.164 (ej: `54911...`)
- **Modo BYO:** Si el tenant tiene `byoPhoneNumberId` + `byoAccessToken` configurados, usa esas credenciales en lugar de las de la plataforma.

**Variables de entorno requeridas:**
```ini
META_WA_PHONE_NUMBER_ID=109283746501928
META_WA_ACCESS_TOKEN=EAAG...token_permanente...
META_WA_VERIFY_TOKEN=meli_bot_webhook_secret_token_123456
META_WA_WABA_ID=987654321098765
```

---

## 7. Modelo de Negocio: Modos de WhatsApp

### Modo A — Bot Centralizado de la Plataforma (Default, 95% de clientes)

El SaaS opera un único número oficial de WhatsApp. El vendedor solo escribe su celular en el panel y recibe alertas instantáneamente.

| Plan | Alertas WP/mes | Costo Meta | Precio al cliente | Margen |
|---|---|---|---|---|
| Starter | 150 | ~$1.50 USD | $29 USD/mes | 95% |
| Pro | 600 | ~$6.00 USD | $59 USD/mes | 90% |
| Enterprise | 2.000 | ~$20.00 USD | $119 USD/mes | 83% |

Control de riesgo: contador `whatsapp_messages_this_month` por tenant. Al 100% del cupo, el bot avisa al vendedor pero la IA sigue respondiendo en MELI normalmente (sin pérdida para el SaaS).

### Modo B — BYO-WABA (Bring Your Own — 5% Enterprise)

El vendedor ingresa sus propias credenciales de Meta en el panel (`byoPhoneNumberId` + `byoAccessToken`). Ellos absorben el costo de Meta directamente.

**Ventajas:** Costo cero de infraestructura WA para el SaaS, número corporativo propio con tilde verde.  
**Desventajas:** Fricción alta de onboarding (validación CUIT, cuenta Meta Business, ~3-7 días).

### Decisión estratégica

Lanzar con **Modo A** para maximizar conversión. Habilitar **Modo B** como opción enterprise desde el panel de configuración del tenant (campo `whatsappMode: "platform" | "byo"`).

---

## 8. Interfaces Clave

### IWhatsAppClient
```typescript
interface IWhatsAppClient {
  sendTextMessage(dto: { to: string; text: string }): Promise<void>;
  sendInteractiveButtons(dto: {
    to: string;
    bodyText: string;
    buttons: Array<{ id: string; title: string }>;  // title máx 20 chars
  }): Promise<void>;
  sendTemplate(dto: {
    to: string;
    templateName: string;
    languageCode: string;  // "es_AR"
    parameters: string[];
  }): Promise<void>;
}
```

### IClaimRepository
```typescript
interface IClaimRepository {
  save(claim: Claim): Promise<void>;
  findById(id: string): Promise<Claim | null>;
  listBySellerId(sellerId: string, status?: ClaimStatus): Promise<Claim[]>;
  getPendingAlerts(): Promise<Claim[]>;
}
```
