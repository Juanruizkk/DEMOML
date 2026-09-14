# Plan de Implementación: Configuración Avanzada de IA del Tenant (Automatización, Horarios, Tono y Políticas Globales)

Este plan describe la arquitectura y los pasos de ejecución para que **Claude Code** implemente el sistema integral de configuración de IA para el vendedor (**Tenant**), permitiendo configurar modos de automatización (100% auto, híbrido, 100% manual, por horarios de guardia nocturna), personalización del tono de respuesta, saludos, firmas y políticas comerciales de toda la tienda.

> **Preparado para ejecución directa por Claude Code.**

---

## 1. Alcance y Requerimientos del Vendedor

### A. Modos de Automatización Operativa
1. **⚡ 100% Automático (`always_auto`)**:
   - Publica inmediatamente en Mercado Libre toda pregunta cuya respuesta pase el filtro de moderación determinística.
2. **🧠 Híbrido Inteligente (`smart_hybrid`)** *(Recomendado)*:
   - Auto-publica solo si la certeza/confianza del modelo supera el umbral configurable ($\ge \text{umbral}$, ej: 75%).
   - Si la confianza es baja, hay negociación de precios o contacto externo, la envía a revisión humana por WhatsApp, Telegram y la campana web.
3. **✋ 100% Manual (`always_manual`)**:
   - La IA genera la respuesta sugerida pero **nunca** publica en MELI de forma autónoma. Todas las preguntas requieren aprobación humana.
4. **⏰ Piloto Automático por Horarios / Guardia Nocturna (`schedule`)**:
   - Permite definir el horario comercial de la tienda (ej: Lunes a Viernes de 09:00 a 18:00).
   - **En horario comercial**: Opera en modo Manual o Híbrido (el equipo humano atiende o supervisa).
   - **Fuera de horario comercial (Noches y Fines de semana)**: Opera en modo 100% Automático para mantener el tiempo de respuesta y no perder ventas nocturnas.

---

### B. Personalización de Tono y Estilo de Respuesta
1. **Selector de Tono de Voz**:
   - 🧉 `casual_rioplatense`: Cordial, cercano y rioplatense estándar (*"¡Hola! Sí, tenemos stock..."*).
   - 👔 `formal`: Protocolar y respetuoso (*"Estimado/a, le confirmamos que disponemos de stock..."*).
   - ⚡ `concise`: Directo al grano y breve, máximo 1 o 2 oraciones (*"Hola, sí tenemos stock para despacho inmediato."*).
   - 🚀 `sales_oriented`: Comercial y persuasivo (*"¡Hola! Sí, tenemos stock disponible. Si comprás ahora despachamos hoy mismo. ¡Esperamos tu compra!"*).
2. **Estructura de Respuesta (Saludo y Firma)**:
   - **Saludo Inicial**: Template opcional (ej: *"¡Hola! Gracias por consultar en [Nombre de Tienda]."*).
   - **Firma / Despedida**: Template opcional (ej: *"Saludos, equipo de [Tienda] | MercadoLíder Platinum."*).
3. **Políticas Comerciales Globales (Store Policies)**:
   - 🧾 **Facturación**: Regla global (ej: *"Emitimos Factura A y B automáticamente según los datos registrados al momento de la compra."*).
   - 🚚 **Envíos y Entregas**: Regla global (ej: *"Envíos en el día por Mercado Envíos Flex comprando antes de las 14:00 hs."*).
   - 🛡️ **Garantía**: Regla global (ej: *"Garantía oficial de 6 meses con cambio directo."*).
   - 📝 **Instrucciones Adicionales**: Campo de texto libre para directivas específicas.

---

## 2. Diagrama de Arquitectura y Flujo

```mermaid
flowchart TD
    subgraph Frontend [Portal del Vendedor /settings]
        UI[TenantPage: Configuración IA]
        UI -->|Modo de Operación| SET_MODE[always_auto | smart_hybrid | always_manual | schedule]
        UI -->|Horario de Atención| SET_SCH[Lun-Vie 09:00-18:00]
        UI -->|Tono y Estilo| SET_TONE[casual | formal | concise | sales_oriented]
        UI -->|Políticas Globales| SET_POL[Facturación, Envíos, Garantía, Saludo, Firma]
        UI -->|PUT /api/tenant/settings| API[Backend API]
    end

    subgraph Backend [Flujo de Pregunta Entrante]
        Q[Pregunta recibida en MELI] --> PROC[ProcessQuestionUseCase]
        PROC --> LLM[LangChainLLMService]
        SET_POL -.->|Inyectar en System Prompt| LLM
        SET_TONE -.->|Inyectar en System Prompt| LLM
        
        LLM --> CLAS[Clasificación + Respuesta Sugerida]
        CLAS --> MOD{Moderación Determinística}
        MOD -->|Bloqueada| REV[Revisión Humana]
        
        MOD -->|Aprobada| DECISION{Evaluar AutomationMode}
        DECISION -->|100% Manual| REV
        DECISION -->|100% Auto| PUB[Publicar en Mercado Libre 🚀]
        DECISION -->|Híbrido| CONF_CHECK{Confianza >= Umbral?}
        CONF_CHECK -->|Sí| PUB
        CONF_CHECK -->|No| REV
        
        DECISION -->|Por Horarios| SCH_CHECK{¿Dentro de Horario Comercial?}
        SCH_CHECK -->|Dentro de Horario| DAY_ACT[Acción Diurna: Manual / Híbrido]
        SCH_CHECK -->|Fuera de Horario / Noche| NIGHT_ACT[Guardia Nocturna: Auto 🌙]
        NIGHT_ACT --> PUB
    end
```

---

## 3. Especificación de Archivos a Modificar

### A. Backend

#### 1. `src/domain/entities/Tenant.ts`
- **Extender tipos e interfaces**:
```typescript
export type AutomationMode = "always_auto" | "smart_hybrid" | "always_manual" | "schedule";

export interface ScheduleSettings {
  enabled: boolean;
  timezone: string; // "America/Argentina/Buenos_Aires"
  workDays: number[]; // [1, 2, 3, 4, 5] (1=Lunes ... 5=Viernes)
  workStartHour: string; // "09:00"
  workEndHour: string; // "18:00"
  daytimeMode: "smart_hybrid" | "always_manual";
  nighttimeMode: "always_auto" | "smart_hybrid";
}

export interface StorePolicies {
  billingPolicy?: string;
  shippingPolicy?: string;
  warrantyPolicy?: string;
  greeting?: string;
  signature?: string;
}

export interface TenantSettings {
  // Modos de automatización
  automationMode: AutomationMode;
  autoAnswerEnabled: boolean; // Retenido para backward compatibility
  confidenceThreshold: number;
  
  // Horarios
  schedule?: ScheduleSettings;
  
  // Tono y Políticas
  tone: "casual_rioplatense" | "formal" | "concise" | "sales_oriented";
  policies?: StorePolicies;
  customInstructions?: string;
  
  // Canales y notificaciones
  preferredAlertChannel?: "whatsapp" | "telegram" | "both";
  webNotifications?: WebNotificationsSettings;
  whatsappAlertPhone?: string;
  telegramAlertChatId?: string;
  telegramEnabled?: boolean;
  
  // Billing & Permissions
  planId: "starter" | "pro" | "enterprise";
  monthlyAlertsLimit: number;
  alertsSentThisMonth: number;
  cycleResetDate: string;
  permissions?: TenantPermissions;
}
```

- **Agregar métodos auxiliares a la clase `Tenant`**:
```typescript
public isWithinWorkSchedule(now: Date = new Date()): boolean {
  if (!this.settings.schedule?.enabled) return true;
  const { workDays, workStartHour, workEndHour, timezone } = this.settings.schedule;
  
  const currentDay = now.getDay(); // 0=Dom, 1=Lun, ..., 6=Sab
  if (!workDays.includes(currentDay)) return false;

  const [startH, startM] = (workStartHour || "09:00").split(":").map(Number);
  const [endH, endM] = (workEndHour || "18:00").split(":").map(Number);
  
  const currentH = now.getHours();
  const currentM = now.getMinutes();
  const currentTotal = currentH * 60 + currentM;
  const startTotal = startH * 60 + startM;
  const endTotal = endH * 60 + endM;

  return currentTotal >= startTotal && currentTotal < endTotal;
}

public shouldAutoAnswer(confidence: number, now: Date = new Date()): { autoAnswer: boolean; reason: string } {
  const mode = this.settings.automationMode || (this.settings.autoAnswerEnabled ? "smart_hybrid" : "always_manual");

  if (mode === "always_manual") {
    return { autoAnswer: false, reason: "Modo 100% manual configurado" };
  }

  if (mode === "always_auto") {
    return { autoAnswer: true, reason: "Modo 100% automático activo" };
  }

  if (mode === "smart_hybrid") {
    const threshold = this.settings.confidenceThreshold ?? 0.75;
    const ok = confidence >= threshold;
    return {
      autoAnswer: ok,
      reason: ok ? `Confianza suficiente (${confidence.toFixed(2)} >= ${threshold})` : `Confianza insuficiente (${confidence.toFixed(2)} < ${threshold})`,
    };
  }

  if (mode === "schedule") {
    const isWorkHours = this.isWithinWorkSchedule(now);
    const targetSubMode = isWorkHours
      ? this.settings.schedule?.daytimeMode || "always_manual"
      : this.settings.schedule?.nighttimeMode || "always_auto";

    if (targetSubMode === "always_auto") {
      return { autoAnswer: true, reason: `Guardia fuera de horario (${isWorkHours ? "Diurno" : "Nocturno"} - Auto)` };
    }
    if (targetSubMode === "always_manual") {
      return { autoAnswer: false, reason: `Horario de atención humana (${isWorkHours ? "Diurno" : "Nocturno"} - Manual)` };
    }
    const threshold = this.settings.confidenceThreshold ?? 0.75;
    const ok = confidence >= threshold;
    return {
      autoAnswer: ok,
      reason: ok ? `Híbrido por horario (${confidence.toFixed(2)} >= ${threshold})` : `Confianza insuficiente en horario (${confidence.toFixed(2)})`,
    };
  }

  return { autoAnswer: false, reason: "Modo no reconocido" };
}
```

---

#### 2. `src/infrastructure/llm/LangChainLLMService.ts`
- Enriquecer `buildSystemPrompt`:
```typescript
private buildSystemPrompt(settings?: Partial<TenantSettings>): string {
  const tone = settings?.tone || "casual_rioplatense";
  const policies = settings?.policies;
  
  let toneInstructions = "Tono: Cordial, rioplatense profesional argentino estándar ('¡Hola! Sí, tenemos stock...').";
  if (tone === "formal") {
    toneInstructions = "Tono: Formal y respetuoso ('Estimado/a, le confirmamos que...').";
  } else if (tone === "concise") {
    toneInstructions = "Tono: Ultraconciso y directo al grano, máximo 1 o 2 oraciones breves.";
  } else if (tone === "sales_oriented") {
    toneInstructions = "Tono: Comercial, entusiasta y persuasivo orientado al cierre de venta ('¡Hola! Sí, tenemos stock listo para despacho hoy. ¡Esperamos tu compra!').";
  }

  // Ensamblar políticas globales de la tienda
  const storeRules: string[] = [];
  if (policies?.greeting) storeRules.push(`Saludo inicial sugerido: "${policies.greeting}"`);
  if (policies?.billingPolicy) storeRules.push(`Facturación: ${policies.billingPolicy}`);
  if (policies?.shippingPolicy) storeRules.push(`Envíos y Retiro: ${policies.shippingPolicy}`);
  if (policies?.warrantyPolicy) storeRules.push(`Garantía: ${policies.warrantyPolicy}`);
  if (policies?.signature) storeRules.push(`Firma de cierre: "${policies.signature}"`);
  if (settings?.customInstructions) storeRules.push(`Otras instrucciones: ${settings.customInstructions}`);

  const rulesContext = storeRules.length > 0
    ? `\n--- POLÍTICAS GENERALES DE LA TIENDA ---\n${storeRules.map(r => `- ${r}`).join("\n")}\n`
    : "";

  return `Sos el asistente inteligente de un vendedor en Mercado Libre que responde preguntas pre-venta.

Reglas estrictas de clasificación:
- Preguntas sobre stock: intent: "stock". Si hay stock disponible (available_quantity > 0), confirmá con entusiasmo y marcá requires_human: false.
- Preguntas sobre características técnicas presentes en el texto: intent: "caracteristicas" y auto-responder.
- Marcá requires_human: true ÚNICAMENTE para:
  - Pedidos de rebaja o negociación de precio (intent: "precio_negociacion").
  - Intentos explícitos de contacto por fuera (teléfonos, WhatsApp, redes) -> intent: "contacto_externo".
  - Reclamos o quejas (intent: "reclamo").
  - Datos ausentes en publicación, reglas globales ni reglas del producto.

${toneInstructions}
${rulesContext}
El campo "answer" debe incluir la respuesta formulada completa lista para publicar en Mercado Libre.`;
}
```

---

#### 3. `src/application/use-cases/ProcessQuestionUseCase.ts`
- Actualizar el paso 7 de toma de decisión:
```typescript
// 7. Decisión de publicación automática vs revisión humana
const autoDecision = tenant
  ? tenant.shouldAutoAnswer(classification.confidence)
  : { autoAnswer: false, reason: "Tenant no configurado" };

if (!requiresHuman && autoDecision.autoAnswer) {
  // Publicar automáticamente en Mercado Libre
  t0 = Date.now();
  await this.meliClient.postAnswer(sellerId, questionId, classification.answer);
  // ... logs y guardado
} else {
  // Derivar a revisión humana
  const reviewReason = moderation.blocked
    ? moderation.reason!
    : requiresHuman
    ? reason || "Requiere intervención humana"
    : autoDecision.reason;
    
  question.markAsPendingReview(reviewReason);
  // ... emisión de eventos y alertas
}
```

---

### B. Frontend

#### 4. `client/src/pages/TenantPage.tsx` & `TenantPage.css`
- En la pestaña `settings` (`activeTab === 'settings'`), estructurar las siguientes tarjetas:

1. **Card 1: Modo de Automatización Operativa**:
   - Grid de 4 tarjetas seleccionables:
     - ⚡ **100% Automático** (`always_auto`): Responde todas las preguntas de inmediato.
     - 🧠 **Híbrido Inteligente** (`smart_hybrid`): Responde por umbral de confianza. Muestra el slider interactivo de umbral (0% a 100%).
     - ✋ **100% Manual** (`always_manual`): Todo pasa por aprobación humana.
     - ⏰ **Por Horarios / Guardia Nocturna** (`schedule`): Muestra el panel desplegable de horarios.

2. **Card 2: Horarios de Atención & Guardia Nocturna** *(visible si mode === 'schedule')*:
   - Días laborales (Checkbox pills Lun, Mar, Mie, Jue, Vie, Sab, Dom).
   - Rango horario de atención diurna (Input time: Inicio y Fin, ej. 09:00 a 18:00).
   - Comportamiento en horario diurno (Dropdown: *Revisión Manual* o *Híbrido Inteligente*).
   - Comportamiento fuera de horario (Dropdown: *100% Automático Guardia Nocturna* o *Híbrido*).

3. **Card 3: Tono y Personalidad de la IA**:
   - Selector de tono con iconos y descripción:
     - 🧉 *Casual Rioplatense*
     - 👔 *Formal & Corporativo*
     - ⚡ *Conciso & Directo*
     - 🚀 *Comercial & Persuasivo*
   - Bubble de previsualización en vivo mostrando cómo sonaría una respuesta según el tono seleccionado.
   - Campos de texto para **Saludo inicial** y **Firma / Despedida**.

4. **Card 4: Políticas Comerciales de la Tienda (Globales)**:
   - 🧾 **Facturación**: Input rápido (ej: Factura A y B).
   - 🚚 **Envíos y Despachos**: Input rápido (ej: Flex en el día antes de las 14hs).
   - 🛡️ **Garantía**: Input rápido (ej: 6 meses oficial).
   - 📝 **Instrucciones adicionales**: Textarea para directivas libres.

---

## 4. Plan de Ejecución para Claude Code

```bash
# Paso 1: Actualizar Entidades del Dominio
# Modificar src/domain/entities/Tenant.ts con las nuevas interfaces y métodos auxiliares.

# Paso 2: Actualizar Prompts de LLM
# Modificar src/infrastructure/llm/LangChainLLMService.ts para contemplar políticas y nuevos tonos.

# Paso 3: Actualizar Use Case de Procesamiento de Preguntas
# Modificar src/application/use-cases/ProcessQuestionUseCase.ts para utilizar tenant.shouldAutoAnswer().

# Paso 4: Tests Unitarios del Backend
npm test

# Paso 5: Implementar UI en Frontend
# Actualizar client/src/pages/TenantPage.tsx y TenantPage.css con el nuevo diseño.

# Paso 6: Compilar y Validar Frontend
npm --prefix client run build
```

---

## 5. Plan de Verificación

1. **Test Automatizado (`vitest`)**:
   - Probar que `tenant.shouldAutoAnswer` retorne `true` en modo `always_auto`.
   - Probar que retorne `false` en modo `always_manual`.
   - Probar que evalúe umbrales en `smart_hybrid`.
   - Probar simulación de fechas y horas en `schedule` (diurno vs nocturno).
2. **Verificación Manual en el Portal**:
   - Ingresar a `http://localhost:5173/settings`.
   - Seleccionar **"Por Horarios / Guardia Nocturna"** y configurar L-V 09:00 a 18:00.
   - Cambiar el tono a **"Comercial & Persuasivo"** y verificar que la previsualización se actualice.
   - Agregar políticas de Facturación A/B y Envíos en el día.
   - Guardar cambios y verificar que persistan al recargar la página.
