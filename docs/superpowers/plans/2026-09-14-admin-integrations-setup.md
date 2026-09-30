# Admin Integrations Setup — LLM BYOK + WhatsApp Custom por Tenant

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir que el admin configure por cada tenant sus credenciales de LLM (proveedor + API key propia del cliente) y WhatsApp (Phone Number ID + Access Token, modo custom_byo), sin que el cliente tenga que hacerlo.

**Architecture:** Se extiende `TenantSettings` con campos LLM, se actualiza `LangChainLLMService` para aceptar credenciales por llamada, y se agrega un endpoint `PATCH /api/admin/tenants/:sellerId/integrations` con su UI en AdminPage. Los use cases pasan las credenciales del tenant al LLM service en cada clasificación. Los secrets no se exponen en la respuesta del detalle del tenant.

**Tech Stack:** TypeScript, Fastify, LangChain.js (Groq/Anthropic/OpenAI), React 19, Vitest

---

## File Map

| Archivo | Acción |
|---|---|
| `src/domain/entities/Tenant.ts` | Modificar — agregar campos LLM a `TenantSettings` + método `getLLMCredentials()` |
| `src/application/interfaces/ILLMService.ts` | Modificar — agregar `llmCredentials?` opcional en ambos métodos classify |
| `src/infrastructure/llm/LangChainLLMService.ts` | Modificar — soportar credenciales por llamada en `buildBaseModel` |
| `src/application/use-cases/ProcessQuestionUseCase.ts` | Modificar — pasar `tenant.getLLMCredentials()` al LLM service |
| `src/application/use-cases/ProcessOrderMessageUseCase.ts` | Modificar — idem para order messages |
| `src/application/use-cases/SimulateQuestionUseCase.ts` | Modificar — idem para simulaciones |
| `src/presentation/controllers/ProductsController.ts` | Modificar — idem para test-prompt |
| `src/application/use-cases/admin/GetTenantDetailUseCase.ts` | Modificar — enmascarar secrets en la respuesta |
| `src/application/use-cases/admin/UpdateTenantIntegrationsUseCase.ts` | Crear |
| `src/presentation/controllers/AdminController.ts` | Modificar — agregar método `updateTenantIntegrations` |
| `src/app.ts` | Modificar — instanciar use case + registrar ruta PATCH |
| `client/src/api/client.ts` | Modificar — agregar método `patch` |
| `client/src/pages/AdminPage.tsx` | Modificar — agregar sección "Integraciones" por tenant |
| `src/tests/Tenant.test.ts` | Modificar — agregar tests de `getLLMCredentials()` |

---

### Task 1: Extender TenantSettings con credenciales LLM

**Files:**
- Modify: `src/domain/entities/Tenant.ts`
- Test: `src/tests/Tenant.test.ts`

- [ ] **Step 1: Agregar campos LLM a la interfaz TenantSettings**

En `src/domain/entities/Tenant.ts`, dentro de `TenantSettings`, agregar después del bloque WhatsApp (línea 58):

```typescript
  // LLM (Bring Your Own Key)
  llmProvider?: "groq" | "openai" | "anthropic";
  llmApiKey?: string;
```

- [ ] **Step 2: Agregar método getLLMCredentials() a la clase Tenant**

En `src/domain/entities/Tenant.ts`, agregar después del método `getWhatsAppCredentials()` (línea 216):

```typescript
  public getLLMCredentials(): { provider: string; apiKey: string } | null {
    if (this.settings.llmProvider && this.settings.llmApiKey) {
      return {
        provider: this.settings.llmProvider,
        apiKey: this.settings.llmApiKey,
      };
    }
    return null;
  }
```

- [ ] **Step 3: Escribir tests para getLLMCredentials()**

En `src/tests/Tenant.test.ts`, agregar al final del archivo:

```typescript
describe("Tenant.getLLMCredentials", () => {
  it("returns null when no LLM settings configured", () => {
    const tenant = makeTenant();
    expect(tenant.getLLMCredentials()).toBeNull();
  });

  it("returns null when provider is set but apiKey is missing", () => {
    const tenant = makeTenant({ llmProvider: "groq" });
    expect(tenant.getLLMCredentials()).toBeNull();
  });

  it("returns null when apiKey is set but provider is missing", () => {
    const tenant = makeTenant({ llmApiKey: "gsk_abc123" });
    expect(tenant.getLLMCredentials()).toBeNull();
  });

  it("returns null when apiKey is empty string", () => {
    const tenant = makeTenant({ llmProvider: "groq", llmApiKey: "" });
    expect(tenant.getLLMCredentials()).toBeNull();
  });

  it("returns credentials when both provider and apiKey are set", () => {
    const tenant = makeTenant({ llmProvider: "groq", llmApiKey: "gsk_abc123" });
    expect(tenant.getLLMCredentials()).toEqual({ provider: "groq", apiKey: "gsk_abc123" });
  });

  it("returns credentials for openai provider", () => {
    const tenant = makeTenant({ llmProvider: "openai", llmApiKey: "sk-openai-abc" });
    expect(tenant.getLLMCredentials()).toEqual({ provider: "openai", apiKey: "sk-openai-abc" });
  });
});
```

- [ ] **Step 4: Correr los tests para verificar que pasan**

```bash
npx vitest run src/tests/Tenant.test.ts
```

Resultado esperado: todos los tests pasan (incluyendo los existentes).

- [ ] **Step 5: Commit**

```bash
git add src/domain/entities/Tenant.ts src/tests/Tenant.test.ts
git commit -m "feat: add LLM BYOK fields and getLLMCredentials() to Tenant"
```

---

### Task 2: Actualizar ILLMService con credenciales opcionales

**Files:**
- Modify: `src/application/interfaces/ILLMService.ts`

- [ ] **Step 1: Agregar llmCredentials opcional a ambos métodos**

Reemplazar el contenido completo de `src/application/interfaces/ILLMService.ts`:

```typescript
import { Item } from "../../domain/entities/Item.js";
import { ItemKnowledge } from "../../domain/entities/ItemKnowledge.js";
import { TenantSettings } from "../../domain/entities/Tenant.js";
import { IntentType } from "../../domain/value-objects/Intent.js";
import { OrderMessageIntent } from "../../domain/entities/OrderMessage.js";

export interface LLMClassificationResult {
  intent: IntentType;
  confidence: number;
  requires_human: boolean;
  reason: string | null;
  answer: string;
}

export interface LLMOrderMessageResult {
  intent: OrderMessageIntent;
  confidence: number;
  requires_human: boolean;
  reason: string | null;
  answer: string;
}

export interface LLMCredentials {
  provider: string;
  apiKey: string;
}

export interface ILLMService {
  classifyAndAnswer(params: {
    questionText: string;
    item: Item;
    settings?: Partial<TenantSettings>;
    itemKnowledge?: ItemKnowledge | null;
    llmCredentials?: LLMCredentials | null;
  }): Promise<LLMClassificationResult>;

  classifyOrderMessage(params: {
    messageText: string;
    itemTitle?: string;
    buyerNickname?: string;
    settings?: Partial<TenantSettings>;
    orderContext?: string;
    llmCredentials?: LLMCredentials | null;
  }): Promise<LLMOrderMessageResult>;

  getProviderLabel(): string;
}
```

- [ ] **Step 2: Verificar que TypeScript no tiene errores**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Si hay errores en LangChainLLMService (no implementa la nueva firma), continuar con Task 3.

- [ ] **Step 3: Commit**

```bash
git add src/application/interfaces/ILLMService.ts
git commit -m "feat: add optional llmCredentials to ILLMService interface"
```

---

### Task 3: Actualizar LangChainLLMService para soportar credenciales por llamada

**Files:**
- Modify: `src/infrastructure/llm/LangChainLLMService.ts`

- [ ] **Step 1: Actualizar buildBaseModel para aceptar override de credenciales**

En `src/infrastructure/llm/LangChainLLMService.ts`, reemplazar el método `buildBaseModel` (líneas 51-82).

> **Nota importante:** `process.env.LLM_MODEL` es específico del proveedor de la plataforma (ej. un model de Groq). Cuando un tenant usa un proveedor distinto al default, se usa el modelo por defecto de ese proveedor para no mezclar nombres de modelo incompatibles.

```typescript
  private async buildBaseModel(override?: { provider: string; apiKey: string }): Promise<any> {
    const defaultProvider = process.env.LLM_PROVIDER ?? "groq";
    const provider = override?.provider ?? defaultProvider;
    const isOverride = Boolean(override?.provider && override.provider !== defaultProvider);
    const apiKey = override?.apiKey;

    if (provider === "groq") {
      const { ChatGroq } = await import("@langchain/groq");
      return new ChatGroq({
        model: (!isOverride && process.env.LLM_MODEL) || "openai/gpt-oss-120b",
        temperature: 0.1,
        apiKey: apiKey ?? process.env.GROQ_API_KEY,
      });
    }

    if (provider === "anthropic") {
      const { ChatAnthropic } = await import("@langchain/anthropic");
      return new ChatAnthropic({
        model: (!isOverride && process.env.LLM_MODEL) || "claude-3-5-sonnet-latest",
        temperature: 0.1,
        apiKey: apiKey ?? process.env.ANTHROPIC_API_KEY,
      });
    }

    if (provider === "openai") {
      const { ChatOpenAI } = await import("@langchain/openai");
      return new ChatOpenAI({
        model: (!isOverride && process.env.LLM_MODEL) || "gpt-4o-mini",
        temperature: 0.1,
        apiKey: apiKey ?? process.env.OPENAI_API_KEY,
      });
    }

    throw new Error(`LLM_PROVIDER desconocido: ${provider}. Usá "groq", "anthropic" u "openai".`);
  }
```

- [ ] **Step 2: Actualizar getStructuredModel y getStructuredOrderModel para aceptar credenciales**

Reemplazar `getStructuredModel` y `getStructuredOrderModel` (líneas 84-101):

```typescript
  private async getStructuredModel(credentials?: { provider: string; apiKey: string } | null): Promise<any> {
    // Si hay credenciales por tenant, siempre construir modelo fresco (sin cache)
    if (credentials) {
      const base = await this.buildBaseModel(credentials);
      return base.withStructuredOutput(questionSchema, { name: "clasificar_pregunta" });
    }
    // Modelo de plataforma: usar cache
    const provider = process.env.LLM_PROVIDER ?? "groq";
    if (!this.cachedModel || this.cachedProvider !== provider) {
      const base = await this.buildBaseModel();
      this.cachedModel = base.withStructuredOutput(questionSchema, { name: "clasificar_pregunta" });
      this.cachedProvider = provider;
    }
    return this.cachedModel;
  }

  private async getStructuredOrderModel(credentials?: { provider: string; apiKey: string } | null): Promise<any> {
    if (credentials) {
      const base = await this.buildBaseModel(credentials);
      return base.withStructuredOutput(orderMessageSchema, { name: "clasificar_mensaje_postventa" });
    }
    const provider = process.env.LLM_PROVIDER ?? "groq";
    if (!this.cachedOrderModel || this.cachedOrderProvider !== provider) {
      const base = await this.buildBaseModel();
      this.cachedOrderModel = base.withStructuredOutput(orderMessageSchema, { name: "clasificar_mensaje_postventa" });
      this.cachedOrderProvider = provider;
    }
    return this.cachedOrderModel;
  }
```

- [ ] **Step 3: Actualizar classifyAndAnswer y classifyOrderMessage para pasar credentials**

Reemplazar `classifyAndAnswer` (líneas 226-246):

```typescript
  public async classifyAndAnswer(params: {
    questionText: string;
    item: Item;
    settings?: Partial<TenantSettings>;
    itemKnowledge?: ItemKnowledge | null;
    llmCredentials?: { provider: string; apiKey: string } | null;
  }): Promise<LLMClassificationResult> {
    const model = await this.getStructuredModel(params.llmCredentials);
    const systemPrompt = this.buildSystemPrompt(params.settings);
    const userPrompt = this.buildUserPrompt(
      params.questionText,
      params.item,
      params.itemKnowledge
    );

    const result = await model.invoke([
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ]);

    return result as LLMClassificationResult;
  }
```

Reemplazar `classifyOrderMessage` (líneas 248-273):

```typescript
  public async classifyOrderMessage(params: {
    messageText: string;
    itemTitle?: string;
    buyerNickname?: string;
    settings?: Partial<TenantSettings>;
    orderContext?: string;
    llmCredentials?: { provider: string; apiKey: string } | null;
  }): Promise<LLMOrderMessageResult> {
    const model = await this.getStructuredOrderModel(params.llmCredentials);
    const systemPrompt = this.buildOrderMessageSystemPrompt(params.settings);

    const userPrompt = `Contexto del Pedido Post-Venta:
Producto comprado: ${params.itemTitle || "Producto comprado en la tienda"}
Comprador: ${params.buyerNickname || "Comprador"}
${params.orderContext ? `Detalles adicionales: ${params.orderContext}\n` : ""}
Mensaje recibido del comprador:
"${params.messageText}"

Clasificá el mensaje post-venta y redactá la mejor respuesta según las políticas.`;

    const result = await model.invoke([
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ]);

    return result as LLMOrderMessageResult;
  }
```

- [ ] **Step 4: Verificar que TypeScript compila sin errores**

```bash
npx tsc --noEmit
```

Resultado esperado: sin errores relacionados a `ILLMService` o `LangChainLLMService`.

- [ ] **Step 5: Commit**

```bash
git add src/infrastructure/llm/LangChainLLMService.ts
git commit -m "feat: support per-tenant LLM credentials in LangChainLLMService"
```

---

### Task 4: Pasar credenciales del tenant en todos los puntos LLM

Hay 4 puntos en el código que llaman al LLM: `ProcessQuestionUseCase`, `ProcessOrderMessageUseCase`, `SimulateQuestionUseCase`, y `ProductsController`. Todos tienen acceso al tenant — todos deben pasar sus credenciales.

**Files:**
- Modify: `src/application/use-cases/ProcessQuestionUseCase.ts:125`
- Modify: `src/application/use-cases/ProcessOrderMessageUseCase.ts:108`
- Modify: `src/application/use-cases/SimulateQuestionUseCase.ts:93`
- Modify: `src/presentation/controllers/ProductsController.ts:178`

- [ ] **Step 1: Actualizar ProcessQuestionUseCase**

En `src/application/use-cases/ProcessQuestionUseCase.ts`, agregar `llmCredentials` a la llamada existente (alrededor de línea 125):

```typescript
      const classification = await this.llmService.classifyAndAnswer({
        questionText: question.text,
        item,
        settings,
        itemKnowledge,
        llmCredentials: tenant?.getLLMCredentials() ?? null,
      });
```

- [ ] **Step 2: Actualizar ProcessOrderMessageUseCase**

En `src/application/use-cases/ProcessOrderMessageUseCase.ts`, agregar `llmCredentials` a la llamada (alrededor de línea 108). La variable `tenant` ya existe en ese scope (línea 95):

```typescript
      const llmResult = await this.llmService.classifyOrderMessage({
        messageText: latestBuyerMessage.body,
        itemTitle: order?.orderItems?.[0]?.item?.title,
        buyerNickname: latestBuyerMessage.from?.nickname,
        settings: tenant?.settings,
        orderContext: params.orderContext,
        llmCredentials: tenant?.getLLMCredentials() ?? null,
      });
```

- [ ] **Step 3: Actualizar SimulateQuestionUseCase**

En `src/application/use-cases/SimulateQuestionUseCase.ts`, la variable `tenant` ya existe (línea 85). Agregar `llmCredentials` a la llamada (alrededor de línea 93):

```typescript
      const classification = await this.llmService.classifyAndAnswer({
        questionText: params.text,
        item: fakeItem,
        settings,
        llmCredentials: tenant?.getLLMCredentials() ?? null,
      });
```

- [ ] **Step 4: Actualizar ProductsController (test-prompt)**

En `src/presentation/controllers/ProductsController.ts`, la variable `tenant` ya existe (línea 164). Agregar `llmCredentials` a la llamada (alrededor de línea 178):

```typescript
      const result = await this.llmService.classifyAndAnswer({
        questionText: body.questionText,
        item,
        settings: tenant?.settings,
        itemKnowledge: effectiveKnowledge,
        llmCredentials: tenant?.getLLMCredentials() ?? null,
      });
```

- [ ] **Step 5: Correr todos los tests para verificar que no se rompió nada**

```bash
npx vitest run
```

Resultado esperado: todos los tests existentes pasan.

- [ ] **Step 6: Commit**

```bash
git add src/application/use-cases/ProcessQuestionUseCase.ts src/application/use-cases/ProcessOrderMessageUseCase.ts src/application/use-cases/SimulateQuestionUseCase.ts src/presentation/controllers/ProductsController.ts
git commit -m "feat: pass tenant LLM credentials to all classifier call sites"
```

---

### Task 5: Enmascarar secrets en GetTenantDetailUseCase

El endpoint `GET /api/admin/tenants/:sellerId` devuelve `settings: tenant.settings` completo, incluyendo `llmApiKey` y `customAccessToken` en texto plano. Aunque la ruta requiere `super_admin`, los secrets en respuestas HTTP pueden quedar en logs, proxies o network tabs del browser. Se enmascaran para que el frontend sepa si están configurados sin exponer el valor real.

**Files:**
- Modify: `src/application/use-cases/admin/GetTenantDetailUseCase.ts`

- [ ] **Step 1: Agregar helper de enmascaramiento y aplicarlo en la respuesta**

En `src/application/use-cases/admin/GetTenantDetailUseCase.ts`, agregar la función helper y modificar el return. Reemplazar la línea `settings: tenant.settings,` (alrededor de línea 48) por:

```typescript
      settings: maskSecrets(tenant.settings),
```

Y agregar la función `maskSecrets` antes de la clase:

```typescript
function maskSecrets(settings: any): any {
  return {
    ...settings,
    llmApiKey: settings.llmApiKey ? "***" : undefined,
    customAccessToken: settings.customAccessToken ? "***" : undefined,
  };
}
```

- [ ] **Step 2: Verificar que el frontend aún funciona**

El frontend en `selectTenant` ya ignora `llmApiKey` y `customAccessToken` (los inicializa en `''`). La única diferencia es que ahora podría detectar si hay una key configurada. Verificar que `client/src/pages/AdminPage.tsx` compile:

```bash
cd client && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/application/use-cases/admin/GetTenantDetailUseCase.ts
git commit -m "security: mask llmApiKey and customAccessToken in tenant detail response"
```

---

### Task 6: Crear UpdateTenantIntegrationsUseCase

**Files:**
- Create: `src/application/use-cases/admin/UpdateTenantIntegrationsUseCase.ts`

- [ ] **Step 1: Crear el use case**

Crear `src/application/use-cases/admin/UpdateTenantIntegrationsUseCase.ts`:

```typescript
import { ITenantRepository } from "../../interfaces/ITenantRepository.js";
import { TenantSettings, WhatsAppMode } from "../../../domain/entities/Tenant.js";

interface IntegrationsInput {
  whatsappMode?: WhatsAppMode;
  customPhoneNumberId?: string;
  customAccessToken?: string;
  customWabaId?: string;
  llmProvider?: "groq" | "openai" | "anthropic";
  llmApiKey?: string;
}

interface Input {
  sellerId: string;
  integrations: IntegrationsInput;
}

export class UpdateTenantIntegrationsUseCase {
  constructor(private readonly tenantRepo: ITenantRepository) {}

  async execute({ sellerId, integrations }: Input): Promise<{ sellerId: string; integrations: Partial<TenantSettings> }> {
    const tenant = await this.tenantRepo.findBySellerId(sellerId);
    if (!tenant) throw new Error(`Tenant not found: ${sellerId}`);

    tenant.updateSettings(integrations);
    await this.tenantRepo.save(tenant);

    // Devolver solo metadata — nunca los secrets
    return {
      sellerId,
      integrations: {
        whatsappMode: tenant.settings.whatsappMode,
        customPhoneNumberId: tenant.settings.customPhoneNumberId,
        customWabaId: tenant.settings.customWabaId,
        llmProvider: tenant.settings.llmProvider,
        hasLlmApiKey: Boolean(tenant.settings.llmApiKey) as any,
        hasCustomAccessToken: Boolean(tenant.settings.customAccessToken) as any,
      },
    };
  }
}
```

- [ ] **Step 2: Verificar que TypeScript compila**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/application/use-cases/admin/UpdateTenantIntegrationsUseCase.ts
git commit -m "feat: add UpdateTenantIntegrationsUseCase"
```

---

### Task 7: Wiring — AdminController + ruta PATCH

**Files:**
- Modify: `src/presentation/controllers/AdminController.ts`
- Modify: `src/app.ts`

- [ ] **Step 1: Agregar UpdateTenantIntegrationsUseCase al AdminController**

En `src/presentation/controllers/AdminController.ts`, agregar el import al principio:

```typescript
import { UpdateTenantIntegrationsUseCase } from "../../application/use-cases/admin/UpdateTenantIntegrationsUseCase.js";
```

Reemplazar el constructor completo:

```typescript
  constructor(
    private readonly getGlobalMetricsUseCase: GetGlobalMetricsUseCase,
    private readonly listTenantsOverviewUseCase: ListTenantsOverviewUseCase,
    private readonly getTenantDetailUseCase: GetTenantDetailUseCase,
    private readonly toggleTenantAutoAnswerUseCase: ToggleTenantAutoAnswerUseCase,
    private readonly forceTokenRefreshUseCase: ForceTokenRefreshUseCase,
    private readonly updateTenantPermissionsUseCase: UpdateTenantPermissionsUseCase,
    private readonly createTenantUseCase: CreateTenantUseCase,
    private readonly userRepo: IUserRepository,
    private readonly requestPasswordResetUseCase: RequestPasswordResetUseCase,
    private readonly emailClient?: IEmailClient,
    private readonly updateTenantIntegrationsUseCase?: UpdateTenantIntegrationsUseCase,
  ) {}
```

Agregar el método al final de la clase (antes del cierre `}`):

```typescript
  public updateTenantIntegrations = async (request: FastifyRequest, reply: FastifyReply) => {
    const { sellerId } = request.params as { sellerId: string };
    const { integrations } = request.body as {
      integrations: {
        whatsappMode?: "platform_shared" | "custom_byo";
        customPhoneNumberId?: string;
        customAccessToken?: string;
        customWabaId?: string;
        llmProvider?: "groq" | "openai" | "anthropic";
        llmApiKey?: string;
      };
    };
    try {
      if (!this.updateTenantIntegrationsUseCase) {
        return reply.status(501).send({ error: "Integrations use case not configured" });
      }
      const result = await this.updateTenantIntegrationsUseCase.execute({ sellerId, integrations });
      return reply.send(result);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  };
```

- [ ] **Step 2: Instanciar el use case y registrar la ruta en app.ts**

En `src/app.ts`, agregar el import junto a los demás imports de admin use cases (alrededor de línea 61):

```typescript
import { UpdateTenantIntegrationsUseCase } from "./application/use-cases/admin/UpdateTenantIntegrationsUseCase.js";
```

Agregar la instanciación junto a la de `updateTenantPermissionsUseCase` (alrededor de línea 195):

```typescript
  const updateTenantIntegrationsUseCase = new UpdateTenantIntegrationsUseCase(tenantRepo);
```

Reemplazar la construcción del `AdminController` (líneas 283-287):

```typescript
  const adminCtrl = new AdminController(
    getGlobalMetricsUseCase, listTenantsOverviewUseCase, getTenantDetailUseCase,
    toggleTenantAutoAnswerUseCase, forceTokenRefreshUseCase, updateTenantPermissionsUseCase,
    createTenantUseCase, userRepo, requestPasswordResetUseCase, emailClient,
    updateTenantIntegrationsUseCase
  );
```

Agregar la ruta después de la línea de `/permissions`:

```typescript
  app.patch("/api/admin/tenants/:sellerId/integrations", { preHandler: requireSuperAdmin }, adminCtrl.updateTenantIntegrations);
```

- [ ] **Step 3: Verificar que TypeScript compila**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Correr los tests**

```bash
npx vitest run
```

- [ ] **Step 5: Commit**

```bash
git add src/presentation/controllers/AdminController.ts src/app.ts
git commit -m "feat: add PATCH /api/admin/tenants/:sellerId/integrations endpoint"
```

---

### Task 8: UI de integraciones en AdminPage

**Files:**
- Modify: `client/src/api/client.ts`
- Modify: `client/src/pages/AdminPage.tsx`

- [ ] **Step 1: Agregar método patch al cliente API**

En `client/src/api/client.ts`, agregar `patch` junto a `put`. El cliente usa `request<T>()` que ya maneja `BASE`, JWT y headers — no usar `fetch` directamente.

```typescript
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: 'PATCH',
      body: body !== undefined ? JSON.stringify(body) : JSON.stringify({}),
    }),
```

- [ ] **Step 2: Agregar el tipo y estado para integraciones en AdminPage**

En `client/src/pages/AdminPage.tsx`, agregar la interfaz después de `PermissionMeta` (alrededor de línea 63):

```typescript
interface TenantIntegrations {
  whatsappMode: 'platform_shared' | 'custom_byo'
  customPhoneNumberId: string
  customAccessToken: string
  llmProvider: 'groq' | 'openai' | 'anthropic'
  llmApiKey: string
  hasLlmApiKey: boolean
  hasCustomAccessToken: boolean
}
```

Agregar estados dentro de `AdminPage` junto a los otros `useState` (alrededor de línea 113):

```typescript
  const [localIntegrations, setLocalIntegrations] = useState<TenantIntegrations>({
    whatsappMode: 'platform_shared',
    customPhoneNumberId: '',
    customAccessToken: '',
    llmProvider: 'groq',
    llmApiKey: '',
    hasLlmApiKey: false,
    hasCustomAccessToken: false,
  })
  const [savingIntegrations, setSavingIntegrations] = useState(false)
  const [savedIntegrations, setSavedIntegrations]   = useState(false)
  const [clearLlmKey, setClearLlmKey]               = useState(false)
  const [clearWaToken, setClearWaToken]             = useState(false)
```

- [ ] **Step 3: Actualizar selectTenant para cargar integraciones**

Reemplazar la función `selectTenant` existente (líneas 147-158):

```typescript
  const selectTenant = async (t: TenantOverview) => {
    setSelected(t.sellerId)
    setClearLlmKey(false)
    setClearWaToken(false)
    try {
      const detail = await api.get<{ settings: Record<string, any> }>(`/admin/tenants/${t.sellerId}`)
      const s = detail.settings || {}
      setLocalPerms(s.permissions || {
        whatsappEnabled: true, telegramEnabled: true, emailEnabled: false,
        preSaleEnabled: true, postSaleEnabled: true, multiUserEnabled: false,
      })
      setLocalIntegrations({
        whatsappMode: s.whatsappMode || 'platform_shared',
        customPhoneNumberId: s.customPhoneNumberId || '',
        customAccessToken: '',
        llmProvider: s.llmProvider || 'groq',
        llmApiKey: '',
        hasLlmApiKey: s.llmApiKey === '***',
        hasCustomAccessToken: s.customAccessToken === '***',
      })
    } catch {
      setLocalPerms({ whatsappEnabled: true, telegramEnabled: true, emailEnabled: false, preSaleEnabled: true, postSaleEnabled: true, multiUserEnabled: false })
    }
  }
```

- [ ] **Step 4: Agregar la función saveIntegrations**

Agregar después de `savePermissions` (alrededor de línea 176):

```typescript
  const saveIntegrations = async () => {
    if (!selected) return
    setSavingIntegrations(true)
    setSavedIntegrations(false)
    try {
      const payload: Record<string, string> = {
        whatsappMode: localIntegrations.whatsappMode,
        llmProvider: localIntegrations.llmProvider,
      }
      if (localIntegrations.customPhoneNumberId) payload.customPhoneNumberId = localIntegrations.customPhoneNumberId
      // Token WA: enviar si el admin escribió uno nuevo, o "" si eligió limpiar
      if (localIntegrations.customAccessToken)   payload.customAccessToken = localIntegrations.customAccessToken
      else if (clearWaToken)                     payload.customAccessToken = ""
      // LLM key: enviar si el admin escribió una nueva, o "" si eligió limpiar
      if (localIntegrations.llmApiKey)           payload.llmApiKey = localIntegrations.llmApiKey
      else if (clearLlmKey)                      payload.llmApiKey = ""

      await api.patch(`/admin/tenants/${selected}/integrations`, { integrations: payload })
      setSavedIntegrations(true)
      setClearLlmKey(false)
      setClearWaToken(false)
      setLocalIntegrations(prev => ({
        ...prev,
        customAccessToken: '',
        llmApiKey: '',
        hasLlmApiKey: Boolean(prev.llmApiKey) || (prev.hasLlmApiKey && !clearLlmKey),
        hasCustomAccessToken: Boolean(prev.customAccessToken) || (prev.hasCustomAccessToken && !clearWaToken),
      }))
      setTimeout(() => setSavedIntegrations(false), 3000)
    } catch (e) {
      console.error(e)
    } finally {
      setSavingIntegrations(false)
    }
  }
```

- [ ] **Step 5: Agregar la sección de integraciones en el JSX**

En `client/src/pages/AdminPage.tsx`, agregar la sección de integraciones dentro del bloque `{selectedTenant ? (`, justo después del cierre del `</div>` de `permissions-section` (alrededor de línea 457), antes del cierre del `tenant-detail glass`:

```tsx
              {/* Integrations section */}
              <div className="permissions-section" style={{ marginTop: '24px' }}>
                <div className="permissions-header">
                  <div className="header-icon-box blue">
                    <Layers size={18} />
                  </div>
                  <div>
                    <h4 className="permissions-title">Integraciones del Cliente</h4>
                    <p className="permissions-hint">Credenciales propias del cliente para WhatsApp y LLM.</p>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px' }}>
                  {/* WhatsApp */}
                  <fieldset style={{ border: '1px solid var(--border)', borderRadius: '8px', padding: '16px' }}>
                    <legend style={{ padding: '0 8px', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>WhatsApp</legend>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <label style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Modo</label>
                      <select
                        className="input-field"
                        value={localIntegrations.whatsappMode}
                        onChange={e => setLocalIntegrations(p => ({ ...p, whatsappMode: e.target.value as 'platform_shared' | 'custom_byo' }))}
                      >
                        <option value="platform_shared">Compartido (número de la plataforma)</option>
                        <option value="custom_byo">Propio del cliente (custom WABA)</option>
                      </select>

                      {localIntegrations.whatsappMode === 'custom_byo' && (
                        <>
                          <label style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Phone Number ID</label>
                          <input
                            className="input-field"
                            type="text"
                            placeholder="Ej: 123456789012345"
                            value={localIntegrations.customPhoneNumberId}
                            onChange={e => setLocalIntegrations(p => ({ ...p, customPhoneNumberId: e.target.value }))}
                          />
                          <label style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                            Access Token {localIntegrations.hasCustomAccessToken && <span style={{ color: 'var(--green)', fontSize: '11px' }}>✓ configurado</span>}
                          </label>
                          <input
                            className="input-field"
                            type="password"
                            placeholder={localIntegrations.hasCustomAccessToken ? 'Dejar vacío para mantener el actual' : 'Pegar token de acceso'}
                            value={localIntegrations.customAccessToken}
                            onChange={e => { setLocalIntegrations(p => ({ ...p, customAccessToken: e.target.value })); setClearWaToken(false) }}
                          />
                          {localIntegrations.hasCustomAccessToken && !localIntegrations.customAccessToken && (
                            <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                              <input type="checkbox" checked={clearWaToken} onChange={e => setClearWaToken(e.target.checked)} />
                              Limpiar token (volver a número de plataforma)
                            </label>
                          )}
                        </>
                      )}
                    </div>
                  </fieldset>

                  {/* LLM */}
                  <fieldset style={{ border: '1px solid var(--border)', borderRadius: '8px', padding: '16px' }}>
                    <legend style={{ padding: '0 8px', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>Modelo de IA (LLM)</legend>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <label style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Proveedor</label>
                      <select
                        className="input-field"
                        value={localIntegrations.llmProvider}
                        onChange={e => setLocalIntegrations(p => ({ ...p, llmProvider: e.target.value as 'groq' | 'openai' | 'anthropic' }))}
                      >
                        <option value="groq">Groq (recomendado — gratis)</option>
                        <option value="openai">OpenAI (GPT-4o mini)</option>
                        <option value="anthropic">Anthropic (Claude 3.5 Sonnet)</option>
                      </select>
                      <label style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                        API Key {localIntegrations.hasLlmApiKey && <span style={{ color: 'var(--green)', fontSize: '11px' }}>✓ configurada</span>}
                      </label>
                      <input
                        className="input-field"
                        type="password"
                        placeholder={localIntegrations.hasLlmApiKey ? 'Dejar vacío para mantener la actual' : 'Pegar API key del cliente'}
                        value={localIntegrations.llmApiKey}
                        onChange={e => { setLocalIntegrations(p => ({ ...p, llmApiKey: e.target.value })); setClearLlmKey(false) }}
                      />
                      {localIntegrations.hasLlmApiKey && !localIntegrations.llmApiKey && (
                        <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                          <input type="checkbox" checked={clearLlmKey} onChange={e => setClearLlmKey(e.target.checked)} />
                          Limpiar clave (usar credenciales de plataforma)
                        </label>
                      )}
                    </div>
                  </fieldset>
                </div>

                <div className="admin-actions-bar" style={{ marginTop: '16px' }}>
                  <button className="btn-save" onClick={saveIntegrations} disabled={savingIntegrations}>
                    {savingIntegrations ? 'Guardando…' : savedIntegrations ? '✓ Integraciones Guardadas' : 'Guardar Integraciones'}
                  </button>
                </div>
              </div>
```

- [ ] **Step 6: Verificar que el frontend compila sin errores de TypeScript**

```bash
cd client && npx tsc --noEmit
```

- [ ] **Step 7: Correr todos los tests**

```bash
npx vitest run
```

- [ ] **Step 8: Commit**

```bash
git add client/src/api/client.ts client/src/pages/AdminPage.tsx
git commit -m "feat: add integrations panel to admin UI for per-tenant WA and LLM setup"
```

---

## Verificación final

Antes de considerar el plan completo, verificar manualmente:

1. Seleccionar un tenant en el admin panel — debe aparecer la sección "Integraciones" debajo de "Permisos"
2. Cambiar el modo WhatsApp a "custom_byo" — deben aparecer los campos Phone Number ID y Access Token
3. Ingresar valores de prueba y hacer click en "Guardar Integraciones" — debe mostrar confirmación y limpiar los campos de tokens
4. Recargar la página y re-seleccionar el tenant — el Phone Number ID debe estar precargado; el label de API Key debe mostrar "✓ configurada"; los campos de token/key deben estar vacíos
5. Con una key configurada, verificar que aparece el checkbox "Limpiar clave" solo cuando el campo está vacío
6. Verificar en los logs del servidor que el PATCH llega correctamente y `GET /api/admin/tenants/:sellerId` retorna `llmApiKey: "***"` en lugar del valor real

```bash
npx vitest run
```

Resultado esperado: todos los tests pasan.
