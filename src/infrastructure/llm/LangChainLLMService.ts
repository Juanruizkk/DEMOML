import { z } from "zod";
import { ILLMService, LLMClassificationResult, LLMOrderMessageResult } from "../../application/interfaces/ILLMService.js";
import { Item } from "../../domain/entities/Item.js";
import { ItemKnowledge } from "../../domain/entities/ItemKnowledge.js";
import { TenantSettings } from "../../domain/entities/Tenant.js";
import { ILLMUsageRepository } from "../../application/interfaces/ILLMUsageRepository.js";
import { calculateCost } from "../../domain/value-objects/LLMPricing.js";

const questionSchema = z.object({
  intent: z
    .enum([
      "stock",
      "envio",
      "caracteristicas",
      "garantia",
      "facturacion",
      "precio_negociacion",
      "reclamo",
      "contacto_externo",
      "otro",
    ])
    .describe("Intención principal de la pregunta del comprador"),
  confidence: z.number().min(0).max(1).describe("Nivel de certeza de 0 a 1"),
  requires_human: z.boolean().describe("true si requiere intervención humana obligatoria"),
  reason: z.string().nullable().describe("Motivo de derivación humana o null si se auto-responde"),
  answer: z.string().max(2000).describe("Texto de la respuesta propuesta"),
});

const orderMessageSchema = z.object({
  intent: z
    .enum([
      "facturacion",
      "envio_seguimiento",
      "soporte_tecnico",
      "garantia_consulta",
      "reclamo_potencial",
      "agradecimiento",
      "otro",
    ])
    .describe("Intención principal del mensaje post-venta del comprador"),
  confidence: z.number().min(0).max(1).describe("Nivel de certeza de 0 a 1"),
  requires_human: z.boolean().describe("true si requiere intervención o revisión humana obligatoria"),
  reason: z.string().nullable().describe("Motivo de derivación humana o null si se auto-responde"),
  answer: z.string().max(2000).describe("Texto de la respuesta post-venta propuesta"),
});

export class LangChainLLMService implements ILLMService {
  private cachedModel: any = null;
  private cachedProvider: string | null = null;
  private cachedOrderModel: any = null;
  private cachedOrderProvider: string | null = null;

  constructor(
    private readonly usageRepo?: ILLMUsageRepository | null,
    private readonly onLimitExceeded?: ((sellerId: string) => void) | null,
  ) {}

  private resolveProviderModel(override?: { provider: string; apiKey: string } | null): { provider: string; model: string } {
    const defaultProvider = process.env.LLM_PROVIDER ?? "groq";
    const provider = override?.provider ?? defaultProvider;
    const isOverride = Boolean(override?.provider && override.provider !== defaultProvider);
    const defaults: Record<string, string> = {
      groq: "openai/gpt-oss-120b",
      openai: "gpt-4o-mini",
      anthropic: "claude-3-5-sonnet-latest",
    };
    const model = (!isOverride && process.env.LLM_MODEL) || defaults[provider] || provider;
    return { provider, model };
  }

  private captureUsageCallbacks(): { callbacks: any[]; getTokens: () => { tokensIn: number; tokensOut: number; estimated: boolean } } {
    let tokensIn = 0;
    let tokensOut = 0;
    const callbacks = [{
      handleLLMEnd(output: any): void {
        const gen = output.generations?.[0]?.[0];
        const msgUsage = gen?.message?.usage_metadata;
        const llmUsage = output.llmOutput?.tokenUsage ?? output.llmOutput?.usage;
        if (msgUsage?.input_tokens) {
          tokensIn = msgUsage.input_tokens;
          tokensOut = msgUsage.output_tokens ?? 0;
        } else if (llmUsage?.promptTokens) {
          tokensIn = llmUsage.promptTokens;
          tokensOut = llmUsage.completionTokens ?? 0;
        } else if (llmUsage?.input_tokens) {
          tokensIn = llmUsage.input_tokens;
          tokensOut = llmUsage.output_tokens ?? 0;
        }
      },
    }];
    const getTokens = () => ({ tokensIn, tokensOut, estimated: !tokensIn });
    return { callbacks, getTokens };
  }

  private async recordUsage(params: {
    usageContext: { sellerId: string; channel: string } | null | undefined;
    llmCredentials: { provider: string; apiKey: string } | null | undefined;
    tokensIn: number;
    tokensOut: number;
    estimated: boolean;
    promptText: string;
    resultText: string;
    latencyMs: number;
  }): Promise<void> {
    if (!this.usageRepo || !params.usageContext) return;
    const { provider, model } = this.resolveProviderModel(params.llmCredentials);
    let { tokensIn, tokensOut, estimated } = params;
    if (!tokensIn) {
      tokensIn = Math.ceil(params.promptText.length / 4);
      tokensOut = Math.ceil(params.resultText.length / 4);
      estimated = true;
    }
    const costUsd = calculateCost(provider, model, tokensIn, tokensOut);
    const exceeded = await this.usageRepo.log({
      sellerId: params.usageContext.sellerId,
      channel: params.usageContext.channel,
      provider,
      model,
      tokensIn,
      tokensOut,
      tokensEstimated: estimated,
      costUsd,
      latencyMs: params.latencyMs,
    });
    if (exceeded && this.onLimitExceeded) {
      this.onLimitExceeded(params.usageContext.sellerId);
    }
  }

  private async buildBaseModel(override?: { provider: string; apiKey: string }): Promise<any> {
    const { provider, model } = this.resolveProviderModel(override);
    const apiKey = override?.apiKey;

    if (provider === "groq") {
      const { ChatGroq } = await import("@langchain/groq");
      return new ChatGroq({ model, temperature: 0.1, apiKey: apiKey ?? process.env.GROQ_API_KEY });
    }

    if (provider === "anthropic") {
      const { ChatAnthropic } = await import("@langchain/anthropic");
      return new ChatAnthropic({ model, temperature: 0.1, apiKey: apiKey ?? process.env.ANTHROPIC_API_KEY });
    }

    if (provider === "openai") {
      const { ChatOpenAI } = await import("@langchain/openai");
      return new ChatOpenAI({ model, temperature: 0.1, apiKey: apiKey ?? process.env.OPENAI_API_KEY });
    }

    throw new Error(`LLM_PROVIDER desconocido: ${provider}. Usá "groq", "anthropic" u "openai".`);
  }

  private async getStructuredModel(credentials?: { provider: string; apiKey: string } | null): Promise<any> {
    if (credentials) {
      const base = await this.buildBaseModel(credentials);
      return base.withStructuredOutput(questionSchema, { name: "clasificar_pregunta" });
    }
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

  private buildSystemPrompt(settings?: Partial<TenantSettings>): string {
    const tone = settings?.tone || "casual_rioplatense";
    const policies = settings?.policies;

    let toneInstructions: string;
    if (tone === "formal") {
      toneInstructions = "Tono: Formal y respetuoso ('Estimado/a, le confirmamos que disponemos de stock...').";
    } else if (tone === "concise") {
      toneInstructions = "Tono: Ultraconciso y directo al grano, máximo 1 o 2 oraciones breves.";
    } else if (tone === "sales_oriented") {
      toneInstructions = "Tono: Comercial, entusiasta y persuasivo orientado al cierre de venta ('¡Hola! Sí, tenemos stock listo para despacho hoy. ¡Esperamos tu compra!').";
    } else {
      toneInstructions = "Tono: Cordial, rioplatense profesional argentino estándar ('¡Hola! Sí, tenemos stock...', '¡Buenas! Hacemos envíos...').";
    }

    const storeRules: string[] = [];
    if (policies?.greeting) storeRules.push(`Saludo inicial sugerido: "${policies.greeting}"`);
    if (policies?.billingPolicy) storeRules.push(`Facturación: ${policies.billingPolicy}`);
    if (policies?.shippingPolicy) storeRules.push(`Envíos y retiro: ${policies.shippingPolicy}`);
    if (policies?.warrantyPolicy) storeRules.push(`Garantía: ${policies.warrantyPolicy}`);
    if (policies?.signature) storeRules.push(`Firma de cierre: "${policies.signature}"`);
    if (settings?.customInstructions) storeRules.push(`Instrucciones adicionales: ${settings.customInstructions}`);

    const rulesContext = storeRules.length > 0
      ? `\n--- POLÍTICAS GENERALES DE LA TIENDA ---\n${storeRules.map(r => `- ${r}`).join("\n")}\n`
      : "";

    return `Sos el asistente inteligente de un vendedor en Mercado Libre que responde preguntas pre-venta.

Reglas estrictas de clasificación:
- Preguntas sobre stock: intent: "stock". Si hay stock disponible (available_quantity > 0), confirmá con entusiasmo y marcá requires_human: false.
- Preguntas sobre características técnicas presentes en el texto: intent: "caracteristicas" y se auto-responden si el dato está explícito en la publicación.
- Marcá requires_human: true ÚNICAMENTE para:
  - Pedidos de descuento, rebaja o negociación de precio (intent: "precio_negociacion").
  - Intentos explícitos de contacto por fuera (pedir teléfonos, WhatsApp, email, redes sociales) -> intent: "contacto_externo".
  - Reclamos, quejas o garantías conflictivas (intent: "reclamo").
  - Cualquier dato o consulta que NO figure en la publicación, las políticas de la tienda ni las reglas del producto.

${toneInstructions}
${rulesContext}
El campo "answer" debe incluir la respuesta completa lista para publicar en Mercado Libre.`;
  }

  private buildOrderMessageSystemPrompt(settings?: Partial<TenantSettings>): string {
    const tone = settings?.tone || "casual_rioplatense";
    const policies = settings?.policies;

    let toneInstructions: string;
    if (tone === "formal") {
      toneInstructions = "Tono: Formal, empático y respetuoso ('Estimado/a cliente, gracias por su compra. Con respecto a su consulta...').";
    } else if (tone === "concise") {
      toneInstructions = "Tono: Claro, rápido y directo sin rodeos.";
    } else {
      toneInstructions = "Tono: Cálido, servicial y empático rioplatense profesional ('¡Hola! Muchas gracias por tu compra. Te ayudamos con tu consulta...').";
    }

    const storeRules: string[] = [];
    if (policies?.greeting) storeRules.push(`Saludo inicial: "${policies.greeting}"`);
    if (policies?.billingPolicy) storeRules.push(`Facturación: ${policies.billingPolicy}`);
    if (policies?.shippingPolicy) storeRules.push(`Envíos: ${policies.shippingPolicy}`);
    if (policies?.warrantyPolicy) storeRules.push(`Garantía: ${policies.warrantyPolicy}`);
    if (policies?.signature) storeRules.push(`Firma de cierre: "${policies.signature}"`);
    if (settings?.customInstructions) storeRules.push(`Instrucciones adicionales: ${settings.customInstructions}`);

    const rulesContext = storeRules.length > 0
      ? `\n--- POLÍTICAS DE LA TIENDA ---\n${storeRules.map(r => `- ${r}`).join("\n")}\n`
      : "";

    return `Sos el asistente inteligente de atención post-venta y soporte al cliente en Mercado Libre.
El comprador YA realizó la compra y se comunica a través de la mensajería interna del pedido.

Objetivo crucial: Resolver dudas rápidamente, dar excelente soporte post-venta y PREVENIR que el comprador abra un reclamo o mediación en Mercado Libre.

Reglas de clasificación de intenciones:
- facturacion: Consulta por Factura A o B, solicitud de CUIT o datos fiscales.
- envio_seguimiento: Consulta por fecha de entrega, despacho, código de seguimiento o estado de envío.
- soporte_tecnico: Dudas sobre uso, manuales, armado, configuración o funcionamiento del producto comprado.
- garantia_consulta: Consultas preventivas sobre cobertura de garantía, cambio directo o servicio técnico.
- reclamo_potencial: El cliente manifiesta disconformidad, producto roto, faltante o demora crítica (¡MUY IMPORTANTE actuar con máxima empatía y predisposición a solucionarlo de inmediato para evitar que abra reclamo formal!).
- agradecimiento: El cliente confirma recepción, agradece o envía saludos.
- otro: Consultas generales post-venta.

Reglas para requires_human:
- Marcá requires_human: false si la consulta es un agradecimiento simple, una solicitud de facturación que encaja en la política estándar de la tienda, o una consulta clara donde la respuesta esté 100% cubierta.
- Marcá requires_human: true si:
  - Es un reclamo_potencial (falla del producto, rotura, producto equivocado) donde un humano debe verificar o gestionar el reemplazo.
  - El comprador pide algo fuera de las políticas establecidas o solicita cancelar la compra.
  - La respuesta requiere verificar stock físico interno o datos no provistos.

${toneInstructions}
${rulesContext}
El campo "answer" debe incluir la respuesta completa, cordial y tranquilizadora para el comprador.`;
  }

  private buildUserPrompt(
    questionText: string,
    item: Item,
    itemKnowledge?: ItemKnowledge | null
  ): string {
    const attributes = (item.attributes || [])
      .map((a) => `- ${a.name}: ${a.value_name ?? "N/D"}`)
      .join("\n") || "(sin atributos listados)";

    const knowledgeSection =
      itemKnowledge && itemKnowledge.hasContent()
        ? `\n--- REGLAS PRIORITARIAS DEL VENDEDOR PARA ESTA PUBLICACIÓN ---\n${itemKnowledge.formatPromptContext()}\n(Estas reglas tienen máxima prioridad sobre suposiciones generales)\n`
        : "";

    return `Publicación:
Título: ${item.title}
Precio: $${item.price} ${item.currencyId || ""}
Stock disponible: ${item.availableQuantity}
Condición: ${item.condition}
Atributos:
${attributes}
Descripción: ${item.descriptionText || "(sin descripción)"}
${knowledgeSection}
Pregunta del comprador: "${questionText}"

Clasificá la pregunta y generá la respuesta siguiendo las reglas del sistema.`;
  }

  public async classifyAndAnswer(params: {
    questionText: string;
    item: Item;
    settings?: Partial<TenantSettings>;
    itemKnowledge?: ItemKnowledge | null;
    llmCredentials?: { provider: string; apiKey: string } | null;
    usageContext?: { sellerId: string; channel: string } | null;
  }): Promise<LLMClassificationResult> {
    const model = await this.getStructuredModel(params.llmCredentials);
    const systemPrompt = this.buildSystemPrompt(params.settings);
    const userPrompt = this.buildUserPrompt(params.questionText, params.item, params.itemKnowledge);

    const { callbacks, getTokens } = this.captureUsageCallbacks();
    const start = Date.now();
    const result = await model.invoke(
      [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
      { callbacks }
    );
    const latencyMs = Date.now() - start;

    const { tokensIn, tokensOut, estimated } = getTokens();
    await this.recordUsage({
      usageContext: params.usageContext,
      llmCredentials: params.llmCredentials,
      tokensIn, tokensOut, estimated,
      promptText: systemPrompt + userPrompt,
      resultText: JSON.stringify(result),
      latencyMs,
    });

    return result as LLMClassificationResult;
  }

  public async classifyOrderMessage(params: {
    messageText: string;
    itemTitle?: string;
    buyerNickname?: string;
    settings?: Partial<TenantSettings>;
    orderContext?: string;
    llmCredentials?: { provider: string; apiKey: string } | null;
    usageContext?: { sellerId: string; channel: string } | null;
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

    const { callbacks, getTokens } = this.captureUsageCallbacks();
    const start = Date.now();
    const result = await model.invoke(
      [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
      { callbacks }
    );
    const latencyMs = Date.now() - start;

    const { tokensIn, tokensOut, estimated } = getTokens();
    await this.recordUsage({
      usageContext: params.usageContext,
      llmCredentials: params.llmCredentials,
      tokensIn, tokensOut, estimated,
      promptText: systemPrompt + userPrompt,
      resultText: JSON.stringify(result),
      latencyMs,
    });

    return result as LLMOrderMessageResult;
  }

  public getProviderLabel(): string {
    const provider = process.env.LLM_PROVIDER || "groq";
    const model = process.env.LLM_MODEL;
    const labels: Record<string, string> = {
      groq: `Groq (${model || "GPT OSS 120B"})`,
      anthropic: `Anthropic (${model || "Claude 3.5 Sonnet"})`,
      openai: `OpenAI (${model || "GPT-4o mini"})`,
    };
    return labels[provider] || provider;
  }
}

