import { z } from "zod";
import { ILLMService, LLMClassificationResult } from "../../application/interfaces/ILLMService.js";
import { Item } from "../../domain/entities/Item.js";
import { TenantSettings } from "../../domain/entities/Tenant.js";

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

export class LangChainLLMService implements ILLMService {
  private cachedModel: any = null;
  private cachedProvider: string | null = null;

  private async buildBaseModel(): Promise<any> {
    const provider = process.env.LLM_PROVIDER || "groq";

    if (provider === "groq") {
      const { ChatGroq } = await import("@langchain/groq");
      return new ChatGroq({
        model: process.env.LLM_MODEL || "openai/gpt-oss-120b",
        temperature: 0.1,
        apiKey: process.env.GROQ_API_KEY,
      });
    }

    if (provider === "anthropic") {
      const { ChatAnthropic } = await import("@langchain/anthropic");
      return new ChatAnthropic({
        model: process.env.LLM_MODEL || "claude-3-5-sonnet-latest",
        temperature: 0.1,
        apiKey: process.env.ANTHROPIC_API_KEY,
      });
    }

    if (provider === "openai") {
      const { ChatOpenAI } = await import("@langchain/openai");
      return new ChatOpenAI({
        model: process.env.LLM_MODEL || "gpt-4o-mini",
        temperature: 0.1,
        apiKey: process.env.OPENAI_API_KEY,
      });
    }

    throw new Error(`LLM_PROVIDER desconocido: ${provider}. Usá "groq", "anthropic" u "openai".`);
  }

  private async getStructuredModel(): Promise<any> {
    const provider = process.env.LLM_PROVIDER || "groq";
    if (!this.cachedModel || this.cachedProvider !== provider) {
      const base = await this.buildBaseModel();
      this.cachedModel = base.withStructuredOutput(questionSchema, { name: "clasificar_pregunta" });
      this.cachedProvider = provider;
    }
    return this.cachedModel;
  }

  private buildSystemPrompt(settings?: Partial<TenantSettings>): string {
    const tone = settings?.tone || "casual_rioplatense";
    const customInstructions = settings?.customInstructions ? `\nReglas específicas de este vendedor:\n${settings.customInstructions}` : "";

    const toneInstructions =
      tone === "formal"
        ? "Tono: Formal y respetuoso ('Estimado/a, le confirmamos que...')."
        : tone === "concise"
        ? "Tono: Ultraconciso y directo al grano, máximo 1 o 2 oraciones."
        : "Tono: Cordial, rioplatense profesional argentino estándar ('¡Hola! Sí, tenemos stock...', '¡Buenas! Hacemos envíos...').";

    return `Sos el asistente de un vendedor en Mercado Libre que responde preguntas pre-venta.

Reglas estrictas de clasificación:
- Preguntas sobre stock: intent: "stock". Si hay stock disponible (available_quantity > 0), marcá requires_human: false y confirmá el stock con tono cordial.
- Preguntas sobre características técnicas presentes en el texto: son intent: "caracteristicas" y se auto-responden si el dato está explícito en la publicación.
- Marcá requires_human: true ÚNICAMENTE para:
  - Pedidos de descuento, rebaja o negociación de precio (intent: "precio_negociacion").
  - Intentos explícitos de contacto por fuera (pedir teléfonos, WhatsApp, email, redes sociales, coordinar pago por fuera) -> intent: "contacto_externo".
  - Reclamos, quejas o garantías conflictivas (intent: "reclamo" o "garantia").
  - Cualquier dato o consulta que NO figure explícitamente en la publicación ni en las reglas del vendedor.

${toneInstructions}${customInstructions}

El campo "answer" siempre debe tener un texto de respuesta propuesto listo para usar.`;
  }

  private buildUserPrompt(questionText: string, item: Item): string {
    const attributes = (item.attributes || [])
      .map((a) => `- ${a.name}: ${a.value_name ?? "N/D"}`)
      .join("\n") || "(sin atributos listados)";

    return `Publicación:
Título: ${item.title}
Precio: $${item.price} ${item.currencyId || ""}
Stock disponible: ${item.availableQuantity}
Condición: ${item.condition}
Atributos:
${attributes}
Descripción: ${item.descriptionText || "(sin descripción)"}

Pregunta del comprador: "${questionText}"

Clasificá la pregunta y generá la respuesta siguiendo las reglas del sistema.`;
  }

  public async classifyAndAnswer(params: {
    questionText: string;
    item: Item;
    settings?: Partial<TenantSettings>;
  }): Promise<LLMClassificationResult> {
    const model = await this.getStructuredModel();
    const systemPrompt = this.buildSystemPrompt(params.settings);
    const userPrompt = this.buildUserPrompt(params.questionText, params.item);

    const result = await model.invoke([
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ]);

    return result as LLMClassificationResult;
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
