import { z } from "zod";

export const questionSchema = z.object({
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
  answer: z.string().max(2000).describe("Texto de la respuesta propuesta en tono cordial rioplatense"),
});

const SYSTEM_PROMPT = `Sos el asistente de un vendedor argentino en Mercado Libre que responde preguntas pre-venta.

Reglas estrictas de clasificación:
- Preguntas sobre stock ("¿Tenés stock?", "¿Tenés en color negro?", "¿Hay stock para retirar hoy?"): son intent: "stock". Si hay stock disponible (available_quantity > 0), marcá requires_human: false y confirmá el stock con tono cordial.
- Preguntas sobre características técnicas presentes en el texto: son intent: "caracteristicas" y se auto-responden si el dato está explícito en la publicación.
- Marcá requires_human: true ÚNICAMENTE para:
  - Pedidos de descuento, rebaja o negociación de precio (intent: "precio_negociacion").
  - Intentos explícitos de contacto por fuera (pedir teléfonos, WhatsApp, email, redes sociales, coordinar pago por fuera) -> intent: "contacto_externo".
  - Reclamos, quejas o garantías conflictivas (intent: "reclamo" o "garantia").
  - Cualquier dato o consulta que NO figure explícitamente en la publicación.

Tono de respuesta:
- Cordial, argentino estándar / rioplatense profesional ("¡Hola! Sí, tenemos stock disponible...", "¡Buenas! Sí, contamos con..."), breve (1 a 3 oraciones), sin emojis exagerados.
- El campo "answer" siempre debe tener un texto de respuesta propuesto listo para usar.`;

let cachedModel = null;
let cachedProvider = null;

async function buildModel() {
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

async function getModel() {
  const provider = process.env.LLM_PROVIDER || "groq";
  if (!cachedModel || cachedProvider !== provider) {
    const base = await buildModel();
    cachedModel = base.withStructuredOutput(questionSchema, { name: "clasificar_pregunta" });
    cachedProvider = provider;
  }
  return cachedModel;
}

function buildUserPrompt({ questionText, item }) {
  const attributes = (item.attributes || [])
    .map((a) => `- ${a.name}: ${a.value_name ?? "N/D"}`)
    .join("\n") || "(sin atributos listados)";

  return `Publicación:
Título: ${item.title}
Precio: $${item.price} ${item.currency_id || ""}
Stock disponible: ${item.available_quantity}
Condición: ${item.condition}
Atributos:
${attributes}
Descripción: ${item.description_text || "(sin descripción)"}

Pregunta del comprador: "${questionText}"

Clasificá la pregunta y generá la respuesta siguiendo las reglas del sistema.`;
}

export async function classifyAndAnswer({ questionText, item }) {
  const model = await getModel();
  const result = await model.invoke([
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: buildUserPrompt({ questionText, item }) },
  ]);
  return result;
}

export function getActiveProviderLabel() {
  const provider = process.env.LLM_PROVIDER || "groq";
  const model = process.env.LLM_MODEL;
  const labels = {
    groq: `Groq (${model || "GPT OSS 120B"})`,
    anthropic: `Anthropic (${model || "Claude 3.5 Sonnet"})`,
    openai: `OpenAI (${model || "GPT-4o mini"})`,
  };
  return labels[provider] || provider;
}
