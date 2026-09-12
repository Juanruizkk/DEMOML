# 🚀 Plan Maestro de Ejecución: WhatsApp Híbrido (Opción A: Bot Centralizado con Cuotas + Opción B: BYO-WABA)

Este documento es la **guía técnica de desarrollo y ejecución paso a paso** para que el sistema soporte simultáneamente:
1. **Opción A (Bot Centralizado del SaaS)**: Envío desde el número oficial de la plataforma con medición de consumo y cuotas por plan (Starter: 150, Pro: 600, Enterprise: 2000).
2. **Opción B (BYO-WABA / Bring Your Own WhatsApp)**: Conexión de credenciales propias de Meta (`Phone Number ID`, `Access Token`) por cliente para cuentas Enterprise.

---

## 🏛️ 1. Especificación del Modelo de Dominio

### [MODIFY] `src/domain/entities/Tenant.ts`
Actualizar la interfaz `TenantSettings` y la entidad `Tenant`:

```typescript
export type WhatsAppMode = "platform_shared" | "custom_byo";

export interface TenantSettings {
  autoAnswerEnabled: boolean;
  confidenceThreshold: number; // e.g. 0.75
  tone: "casual_rioplatense" | "formal" | "concise";
  customInstructions?: string;
  whatsappAlertPhone?: string; // Celular del vendedor donde recibe alertas

  // ── Configuración de WhatsApp Híbrida ──
  whatsappMode: WhatsAppMode; // "platform_shared" (Opción A) | "custom_byo" (Opción B)
  customPhoneNumberId?: string; // Para Opción B
  customAccessToken?: string;   // Para Opción B
  customWabaId?: string;        // Para Opción B

  // ── Control de Cuota y Facturación ──
  planId: "starter" | "pro" | "enterprise";
  monthlyAlertsLimit: number;   // 150 (Starter), 600 (Pro), 2000 (Enterprise)
  alertsSentThisMonth: number;  // Contador de alertas consumidas en el ciclo
  cycleResetDate: string;       // Fecha ISO del próximo reseteo mensual
}
```

Añadir métodos de ayuda en la clase `Tenant`:
* `canSendWhatsAppAlert(): boolean`:
  - Si `whatsappMode === "custom_byo"`, retorna `true` siempre (el cliente asume el costo directo con Meta).
  - Si `whatsappMode === "platform_shared"`, retorna `this.settings.alertsSentThisMonth < this.settings.monthlyAlertsLimit`.
* `incrementAlertsSent(): void`:
  - Incrementa `alertsSentThisMonth` en `+1` y actualiza `updatedAt`.
* `getWhatsAppCredentials(): { phoneNumberId?: string; accessToken?: string } | null`:
  - Si `whatsappMode === "custom_byo"`, retorna `{ phoneNumberId: this.settings.customPhoneNumberId, accessToken: this.settings.customAccessToken }`.
  - Si `whatsappMode === "platform_shared"`, retorna `null` (para que use las variables globales de `.env`).

---

## 🔌 2. Capa de Infraestructura: Adaptador Dinámico de Meta

### [MODIFY] `src/application/interfaces/IWhatsAppClient.ts`
Actualizar la interfaz para permitir credenciales opcionales:

```typescript
export interface WhatsAppCredentialsOverride {
  phoneNumberId?: string;
  accessToken?: string;
}

export interface SendWhatsAppButtonsDTO {
  to: string;
  bodyText: string;
  buttons: Array<{ id: string; title: string }>;
  credentials?: WhatsAppCredentialsOverride; // Opcional para Opción B
}

export interface SendWhatsAppTextDTO {
  to: string;
  text: string;
  credentials?: WhatsAppCredentialsOverride;
}

export interface SendWhatsAppTemplateDTO {
  to: string;
  templateName: string;
  languageCode: string;
  parameters: string[];
  credentials?: WhatsAppCredentialsOverride;
}
```

### [MODIFY] `src/infrastructure/whatsapp/MetaWhatsAppClient.ts`
Ajustar los métodos para despachar dinámicamente según las credenciales recibidas:
* Si `dto.credentials?.phoneNumberId` y `dto.credentials?.accessToken` están presentes ➔ utiliza esa URL y token específico (Opción B).
* Si no están presentes ➔ utiliza `process.env.META_WA_PHONE_NUMBER_ID` y `process.env.META_WA_ACCESS_TOKEN` (Opción A).

---

## 🚀 3. Capa de Aplicación: Control de Cuota en Casos de Uso

### [MODIFY] `src/application/use-cases/claims/ProcessClaimUseCase.ts` & `ProcessQuestionUseCase.ts`
Al despachar una alerta de WhatsApp:

```typescript
if (tenant.settings.whatsappAlertPhone) {
  // 1. Verificar si tiene cupo o es cliente BYO
  if (tenant.canSendWhatsAppAlert()) {
    const creds = tenant.getWhatsAppCredentials();
    
    await this.whatsAppClient.sendInteractiveButtons({
      to: tenant.settings.whatsappAlertPhone,
      bodyText: alertText,
      buttons: [...],
      credentials: creds || undefined,
    });

    // 2. Si usa el bot compartido, descontar del cupo
    if (tenant.settings.whatsappMode === "platform_shared") {
      tenant.incrementAlertsSent();
      await this.tenantRepo.save(tenant);
    }
  } else {
    // 3. Cupo excedido: loguear auditoría y notificar en tiempo real
    await this.eventRepo.log(new EventLog({
      sellerId: tenant.sellerId,
      type: "WHATSAPP_QUOTA_EXCEEDED",
      message: `Límite mensual de alertas alcanzado (${tenant.settings.alertsSentThisMonth}/${tenant.settings.monthlyAlertsLimit}). Alerta omitida.`,
    }));
  }
}
```

---

## 🌐 4. Capa de Presentación & Frontend

### [MODIFY] `public/tenant.html`, `public/tenant.js`, `public/tenant.css`
En la pestaña **📱 WhatsApp & Alertas**:

1. **Selector de Modo de Integración**:
   - `🔘 Bot Oficial MeliBot (Recomendado - Incluido en tu Plan)`
   - `🔘 Conectar mi propia cuenta de Meta (Enterprise / BYO-WABA)`

2. **Vista Modo Bot Oficial (Opción A)**:
   - Input: Teléfono donde recibe las alertas (`whatsappAlertPhone`).
   - **Barra de Progreso de Consumo del Mes**:
     - Visual: `[██████████░░░░░░░░] 45 / 150 alertas utilizadas este mes (Plan Starter)`.
     - Badge de alerta si supera el 80% de uso.

3. **Vista Modo BYO-WABA (Opción B)**:
   - Input: `Phone Number ID de Meta`.
   - Input: `Access Token Permanente de Meta`.
   - Input: `WABA ID`.
   - Botón: *"🧪 Probar y Validar Credenciales"*.

---

## 🧪 5. Tests Automatizados

Crear / actualizar pruebas unitarias con Vitest:
1. `Tenant.test.ts`: Validación de `canSendWhatsAppAlert()`, cuotas de `platform_shared` y bypass para `custom_byo`.
2. `ProcessClaimUseCase.test.ts`: Verificar que descuente el contador en modo compartido y no lo descuente en modo BYO.
3. `MetaWhatsAppClient.test.ts`: Verificar despacho con credenciales globales vs credenciales dinámicas.
