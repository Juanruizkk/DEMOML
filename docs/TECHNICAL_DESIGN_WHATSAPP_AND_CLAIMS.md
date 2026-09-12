# 📐 Especificación Técnica de Diseño: WhatsApp Real (Meta Cloud API) & Módulo de Reclamos (Claims)

Este documento define la arquitectura técnica, modelo de dominio, contratos de interfaces, endpoints y flujo de integración para implementar **WhatsApp Real vía Meta Cloud API** y el **Módulo de Reclamos Post-Venta de Mercado Libre** en **MELI AI Assistant**.

---

## 🎯 1. Objetivos del Sistema

1. **Meta WhatsApp Cloud API (Oficial y Directa)**:
   - Reemplazar el simulador web por envíos reales a los teléfonos de los vendedores (`tenant.settings.whatsappAlertPhone`).
   - Soportar notificaciones push salientes (plantillas oficiales y mensajes interactivos con botones).
   - Recibir respuestas entrantes vía webhook de Meta para aprobar/rechazar respuestas o acusar recibo de reclamos directamente desde el chat de WhatsApp.

2. **Módulo de Reclamos Post-Venta (Claims)**:
   - Ingestar webhooks de Mercado Libre con `topic: "claims"`.
   - Consultar la API de MELI (`/v1/claims/{id}`) para extraer: Tipo de reclamo (`PNR` = paquete no recibido, `PDD` = producto defectuoso), ID de la orden, motivo del comprador y fecha límite estricta de resolución (`due_date`).
   - Calcular el SLA y nivel de urgencia (`critical` < 12hs, `high` < 24hs, `normal` > 24hs).
   - Despachar alerta inmediata con cuenta regresiva a WhatsApp para evitar mediaciones automáticas y pérdida de reputación.

---

## 🏛️ 2. Arquitectura de Capas (Clean Architecture)

```mermaid
flowchart TD
    subgraph Webhooks_Inbound [Webhooks Entrantes]
        MELI_WH[Mercado Libre Webhook<br/><b>POST /webhook/ml</b><br/>topics: 'questions' & 'claims']
        META_WH[Meta WhatsApp Webhook<br/><b>GET /webhook/whatsapp</b> (Challenge)<br/><b>POST /webhook/whatsapp</b> (Respuestas)]
    end

    subgraph Presentation [Capa de Presentación]
        WC[WebhookController]
        WAC[WhatsAppWebhookController]
        CC[ClaimsController]
    end

    subgraph Application [Capa de Aplicación - Casos de Uso]
        IC[IngestClaimWebhookUseCase]
        PC[ProcessClaimUseCase]
        HWAR[HandleWhatsAppReplyUseCase]
        SWA[SendWhatsAppNotificationUseCase]
        LC[ListTenantClaimsUseCase]
    end

    subgraph Domain [Capa de Dominio]
        CE[Claim Entity]
        CVO[ClaimType & ClaimUrgency Value Objects]
        TE[Tenant Entity]
        QE[Question Entity]
    end

    subgraph Infrastructure [Capa de Infraestructura - Adaptadores]
        MWC[MetaWhatsAppClient<br/><b>Meta Graph API v21.0</b>]
        MELI_CLIENT[MeliApiClient<br/><b>GET /v1/claims/:id</b>]
        SQLITE_CLAIM[SqliteClaimRepository]
        SSE[FastifySseNotifier]
    end

    MELI_WH --> WC
    META_WH --> WAC
    
    WC --> IC
    IC --> PC
    PC --> CE
    PC --> MWC
    PC --> SQLITE_CLAIM
    PC --> SSE

    WAC --> HWAR
    HWAR --> MWC
```

---

## 📦 3. Modelo de Dominio (`src/domain/`)

### 3.1 Entidad `Claim` (`src/domain/entities/Claim.ts`)
```typescript
export type ClaimType = "med_pnr" | "med_pdd" | "return" | "cancel_purchase" | "other";
export type ClaimStage = "claim" | "dispute" | "closed";
export type ClaimStatus = "opened" | "closed";
export type ClaimUrgency = "critical" | "high" | "normal";

export interface ClaimAction {
  action: string;
  dueDate: Date;
  mandatory?: boolean;
}

export interface ClaimProps {
  id: string; // ID del reclamo en MELI (ej: "5000000000")
  sellerId: string;
  orderId: string;
  type: ClaimType;
  stage: ClaimStage;
  status: ClaimStatus;
  reason: string;
  buyerId?: string;
  buyerName?: string;
  actions: ClaimAction[];
  dueDate: Date; // Fecha límite más próxima de las acciones disponibles
  notifiedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export class Claim {
  public readonly id: string;
  public readonly sellerId: string;
  public readonly orderId: string;
  public readonly type: ClaimType;
  public stage: ClaimStage;
  public status: ClaimStatus;
  public readonly reason: string;
  public readonly buyerId?: string;
  public readonly buyerName?: string;
  public actions: ClaimAction[];
  public dueDate: Date;
  public notifiedAt?: Date;
  public readonly createdAt: Date;
  public updatedAt: Date;

  constructor(props: ClaimProps) {
    this.id = props.id;
    this.sellerId = props.sellerId;
    this.orderId = props.orderId;
    this.type = props.type;
    this.stage = props.stage;
    this.status = props.status;
    this.reason = props.reason;
    this.buyerId = props.buyerId;
    this.buyerName = props.buyerName;
    this.actions = props.actions;
    this.dueDate = props.dueDate;
    this.notifiedAt = props.notifiedAt;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  public getUrgency(now: Date = new Date()): ClaimUrgency {
    const remainingHours = (this.dueDate.getTime() - now.getTime()) / (1000 * 60 * 60);
    if (remainingHours <= 12) return "critical";
    if (remainingHours <= 24) return "high";
    return "normal";
  }

  public getRemainingHours(now: Date = new Date()): number {
    return Math.max(0, Math.round((this.dueDate.getTime() - now.getTime()) / (1000 * 60 * 60)));
  }

  public markNotified(): void {
    this.notifiedAt = new Date();
    this.updatedAt = new Date();
  }
}
```

---

## 🔌 4. Puertos e Interfaces (`src/application/interfaces/`)

### 4.1 `IWhatsAppClient.ts`
```typescript
export interface SendWhatsAppTextMessageDTO {
  to: string; // E.164 format: "+5491112345678"
  text: string;
}

export interface SendWhatsAppInteractiveButtonDTO {
  to: string;
  bodyText: string;
  buttons: Array<{
    id: string; // Ej: "approve_123" o "claim_ack_5000"
    title: string; // Máx 20 caracteres
  }>;
}

export interface SendWhatsAppTemplateDTO {
  to: string;
  templateName: string;
  languageCode: string; // "es_AR"
  parameters: string[]; // Variables {{1}}, {{2}}, etc.
}

export interface IWhatsAppClient {
  sendTextMessage(dto: SendWhatsAppTextMessageDTO): Promise<void>;
  sendInteractiveButtons(dto: SendWhatsAppInteractiveButtonDTO): Promise<void>;
  sendTemplate(dto: SendWhatsAppTemplateDTO): Promise<void>;
}
```

### 4.2 `IClaimRepository.ts`
```typescript
export interface IClaimRepository {
  save(claim: Claim): Promise<void>;
  findById(id: string): Promise<Claim | null>;
  listBySellerId(sellerId: string, status?: ClaimStatus): Promise<Claim[]>;
  getPendingAlerts(): Promise<Claim[]>;
}
```

---

## 🚀 5. Capa de Aplicación: Casos de Uso (`src/application/use-cases/`)

### 5.1 `ProcessClaimUseCase.ts`
1. Recibe el ID del reclamo (`claimId`) y `sellerId`.
2. Llama a `meliClient.getClaim(sellerId, claimId)`.
3. Mapea la respuesta a la entidad de dominio `Claim`.
4. Persiste el reclamo en `claimRepo.save(claim)`.
5. Busca el `Tenant` por `sellerId`.
6. Si el tenant tiene configurado `tenant.settings.whatsappAlertPhone`:
   - Construye el mensaje de alerta estructurado con:
     - ⚠️ Tipo de Reclamo (PNR / PDD / Devolución)
     - 📦 Número de Orden
     - ⏳ Tiempo restante antes de penalización automática (SLA)
     - 🔗 Enlace directo al panel de reclamos de Mercado Libre
   - Llama a `whatsAppClient.sendInteractiveButtons()` o `sendTemplate()`.
   - Marca `claim.markNotified()` y guarda en repositorio.
7. Emite evento en tiempo real vía `sseNotifier.notifySeller(sellerId, "claim_received", claim)`.

### 5.2 `HandleWhatsAppReplyUseCase.ts`
Procesa las respuestas y clicks de botones que los vendedores envían desde WhatsApp:
* Si el payload comienza con `approve_<questionId>` ➔ ejecuta `ApproveAnswerUseCase`.
* Si el payload comienza con `reject_<questionId>` ➔ ejecuta `RejectAnswerUseCase`.
* Si el payload comienza con `claim_ack_<claimId>` ➔ registra confirmación de lectura en auditoría.
* Si el vendedor responde con texto libre a una pregunta ➔ publica esa respuesta exacta en Mercado Libre.
* Envía un mensaje de confirmación por WhatsApp: *"✅ Respuesta publicada con éxito en Mercado Libre"*.

---

## 🛠️ 6. Adaptadores de Infraestructura (`src/infrastructure/`)

### 6.1 Adaptador Meta Cloud API: `MetaWhatsAppClient.ts`
* **URL Base**: `https://graph.facebook.com/v21.0/${process.env.META_WA_PHONE_NUMBER_ID}/messages`
* **Header**: `Authorization: Bearer ${process.env.META_WA_ACCESS_TOKEN}`
* **Formato de números**: Sanitiza y formatea a estándar E.164 (ej: `54911...`).

```typescript
export class MetaWhatsAppClient implements IWhatsAppClient {
  private readonly apiUrl: string;
  private readonly token: string;

  constructor() {
    const phoneNumberId = process.env.META_WA_PHONE_NUMBER_ID || "";
    this.apiUrl = `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`;
    this.token = process.env.META_WA_ACCESS_TOKEN || "";
  }

  public async sendInteractiveButtons(dto: SendWhatsAppInteractiveButtonDTO): Promise<void> {
    if (!this.token) {
      console.warn("[MetaWhatsAppClient] META_WA_ACCESS_TOKEN no configurado. Mensaje omitido.");
      return;
    }

    const payload = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: this.formatPhone(dto.to),
      type: "interactive",
      interactive: {
        type: "button",
        body: { text: dto.bodyText },
        action: {
          buttons: dto.buttons.map((b) => ({
            type: "reply",
            reply: { id: b.id, title: b.title.slice(0, 20) },
          })),
        },
      },
    };

    const res = await fetch(this.apiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error(`[MetaWhatsAppClient] Error enviando WhatsApp: ${res.status} ${err}`);
    }
  }

  private formatPhone(phone: string): string {
    return phone.replace(/\D/g, "");
  }
}
```

### 6.2 Repositorio SQLite: `SqliteClaimRepository.ts`
Nueva tabla en SQLite (`meli_bot.db`):
```sql
CREATE TABLE IF NOT EXISTS claims (
  id TEXT PRIMARY KEY,
  seller_id TEXT NOT NULL,
  order_id TEXT NOT NULL,
  type TEXT NOT NULL,
  stage TEXT NOT NULL,
  status TEXT NOT NULL,
  reason TEXT NOT NULL,
  buyer_id TEXT,
  buyer_name TEXT,
  actions_json TEXT NOT NULL,
  due_date DATETIME NOT NULL,
  notified_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_claims_seller ON claims(seller_id);
CREATE INDEX IF NOT EXISTS idx_claims_due_date ON claims(due_date);
```

---

## 🌐 7. Rutas & Webhooks en Fastify (`src/presentation/`)

### 7.1 Webhook de Mercado Libre: `POST /webhook/ml`
Actualizar `WebhookController` para bifurcar según el `topic`:
```typescript
if (body.topic === "questions") {
  await this.ingestQuestionUseCase.execute(body);
} else if (body.topic === "claims" || body.topic === "post_purchase") {
  await this.ingestClaimUseCase.execute(body);
}
```

### 7.2 Webhook de Meta WhatsApp: `GET & POST /webhook/whatsapp`
* **GET `/webhook/whatsapp`** (Verificación inicial de Meta):
  ```typescript
  app.get("/webhook/whatsapp", async (request, reply) => {
    const mode = (request.query as any)["hub.mode"];
    const token = (request.query as any)["hub.verify_token"];
    const challenge = (request.query as any)["hub.challenge"];

    if (mode === "subscribe" && token === process.env.META_WA_VERIFY_TOKEN) {
      return reply.status(200).send(challenge);
    }
    return reply.status(403).send("Forbidden");
  });
  ```
* **POST `/webhook/whatsapp`** (Recepción de mensajes y botones):
  - Recibe el evento JSON de Meta Graph API.
  - Extrae el número del remitente y el payload del botón clickeado (`button_reply.id`) o texto libre.
  - Ejecuta `HandleWhatsAppReplyUseCase`.
  - Responde `HTTP 200 OK` inmediato a Meta.

---

## 🔑 8. Variables de Entorno Requeridas (`.env`)

```ini
# Meta WhatsApp Business Cloud API
META_WA_PHONE_NUMBER_ID=109283746501928
META_WA_ACCESS_TOKEN=EAAG...tu_token_permanente_de_sistema...
META_WA_VERIFY_TOKEN=meli_bot_webhook_secret_token_123456
META_WA_WABA_ID=987654321098765
```

---

## 📋 9. Checklist de Tareas para Desarrollo

1. [ ] **Dominio**:
   - Crear entidad `Claim` (`src/domain/entities/Claim.ts`).
2. [ ] **Interfaces**:
   - Crear `IWhatsAppClient.ts` y `IClaimRepository.ts`.
   - Extender `IMeliClient.ts` con `getClaim(sellerId: string, claimId: string): Promise<any>`.
3. [ ] **Infraestructura**:
   - Implementar `MetaWhatsAppClient.ts`.
   - Implementar `SqliteClaimRepository.ts` y migración de tabla `claims` en `SqliteDatabase.ts`.
   - Añadir `getClaim` en `MeliApiClient.ts`.
4. [ ] **Casos de Uso**:
   - `IngestClaimWebhookUseCase.ts` & `ProcessClaimUseCase.ts`.
   - `HandleWhatsAppReplyUseCase.ts`.
   - Conectar `ProcessQuestionUseCase` para despachar WhatsApp real cuando `requiresHuman === true`.
5. [ ] **Presentación / Webhooks**:
   - Agregar endpoints `/webhook/whatsapp` (GET challenge & POST receiver).
   - Bifurcar tópico `claims` en `/webhook/ml`.
6. [ ] **Tests Unitarios**:
   - Tests para `Claim` entity, `ProcessClaimUseCase` y `HandleWhatsAppReplyUseCase`.
