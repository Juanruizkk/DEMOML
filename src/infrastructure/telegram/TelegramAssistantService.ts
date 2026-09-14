import { z } from "zod";
import { tool } from "@langchain/core/tools";
import { HumanMessage, SystemMessage, ToolMessage } from "@langchain/core/messages";
import {
  ITelegramAssistantService,
  TelegramAssistantResponse,
} from "../../application/interfaces/ITelegramAssistantService.js";
import { IQuestionRepository } from "../../application/interfaces/IQuestionRepository.js";
import { IClaimRepository } from "../../application/interfaces/IClaimRepository.js";
import { IEventRepository } from "../../application/interfaces/IEventRepository.js";
import { Tenant } from "../../domain/entities/Tenant.js";
import { TelegramInlineButton } from "../../application/interfaces/ITelegramClient.js";

export class TelegramAssistantService implements ITelegramAssistantService {
  constructor(
    private readonly questionRepo: IQuestionRepository,
    private readonly claimRepo: IClaimRepository,
    private readonly eventRepo: IEventRepository
  ) {}

  private async buildModel(): Promise<any> {
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

    const { ChatGroq } = await import("@langchain/groq");
    return new ChatGroq({
      model: "openai/gpt-oss-120b",
      temperature: 0.1,
      apiKey: process.env.GROQ_API_KEY,
    });
  }

  public async processMessage(params: {
    tenant: Tenant;
    userMessage: string;
    chatId: string;
  }): Promise<TelegramAssistantResponse> {
    const { tenant, userMessage } = params;
    const sellerId = tenant.sellerId;

    try {
      return await this.executeWithLLM(tenant, userMessage);
    } catch (llmError) {
      console.warn("[TelegramAssistantService] Error con LLM, usando fallback determinístico:", llmError);
      return await this.executeFallback(sellerId, userMessage);
    }
  }

  /**
   * Ejecución inteligente con LangChain + Tool Calling (Groq / OpenAI / Anthropic)
   */
  private async executeWithLLM(tenant: Tenant, userMessage: string): Promise<TelegramAssistantResponse> {
    const sellerId = tenant.sellerId;
    const collectedButtons: TelegramInlineButton[][] = [];

    // Definición de Tools para LangChain
    const getPendingQuestionsTool = tool(
      async ({ limit }) => {
        const res = await this.getPendingQuestionsData(sellerId, limit || 10);
        // Agregar botones rápidos para aprobar/rechazar las preguntas pendientes encontradas
        res.questions.forEach((q) => {
          collectedButtons.push([
            { text: `✅ Aprobar #${q.id.slice(-4)}`, callbackData: `approve_${q.id}` },
            { text: `❌ Rechazar #${q.id.slice(-4)}`, callbackData: `reject_${q.id}` },
          ]);
        });
        return JSON.stringify(res);
      },
      {
        name: "get_pending_questions",
        description:
          "Obtiene las preguntas pre-venta del vendedor que requieren revisión humana o están pendientes de moderación.",
        schema: z.object({
          limit: z.number().optional().describe("Cantidad máxima de preguntas a traer (por defecto 10)"),
        }),
      }
    );

    const getClaimsTool = tool(
      async ({ status, urgentOnly }) => {
        const res = await this.getClaimsData(sellerId, status, urgentOnly);
        res.claims.forEach((c) => {
          collectedButtons.push([
            { text: `🔍 Detalle Reclamo #${c.id.slice(-6)}`, callbackData: `claim_detail_${c.id}` },
          ]);
        });
        return JSON.stringify(res);
      },
      {
        name: "get_claims",
        description:
          "Lista los reclamos de Mercado Libre del vendedor. Permite filtrar por estado (opened/closed/all) y por urgencia de SLA.",
        schema: z.object({
          status: z
            .enum(["opened", "closed", "all"])
            .optional()
            .describe("Estado de los reclamos ('opened' para en gestión, 'closed' para resueltos, 'all' para todos)"),
          urgentOnly: z
            .boolean()
            .optional()
            .describe("true para listar sólo aquellos con tiempo crítico de respuesta (< 24hs o SLA crítico)"),
        }),
      }
    );

    const getClaimDetailTool = tool(
      async ({ claimId }) => {
        const res = await this.getClaimDetailData(sellerId, claimId);
        if (res.claim) {
          collectedButtons.push([
            { text: `✅ Confirmar Lectura #${res.claim.id.slice(-6)}`, callbackData: `claim_ack_${res.claim.id}` },
          ]);
        }
        return JSON.stringify(res);
      },
      {
        name: "get_claim_detail",
        description: "Obtiene información pormenorizada y completa de un reclamo específico por su ID.",
        schema: z.object({
          claimId: z.string().describe("El ID numérico o identificador del reclamo a detallar"),
        }),
      }
    );

    const getRecentAlertsTool = tool(
      async ({ limit }) => {
        const res = await this.getRecentAlertsData(sellerId, limit || 5);
        return JSON.stringify(res);
      },
      {
        name: "get_recent_alerts",
        description: "Lista las alertas y eventos recientes de la tienda (preguntas procesadas, moderaciones, avisos).",
        schema: z.object({
          limit: z.number().optional().describe("Cantidad de alertas a retornar (por defecto 5)"),
        }),
      }
    );

    const getStoreMetricsTool = tool(
      async () => {
        const res = await this.getStoreMetricsData(sellerId);
        return JSON.stringify(res);
      },
      {
        name: "get_store_metrics",
        description: "Obtiene un resumen cuantitativo de la cuenta (preguntas totales, % auto-respondidas, reclamos).",
        schema: z.object({}),
      }
    );

    const tools = [
      getPendingQuestionsTool,
      getClaimsTool,
      getClaimDetailTool,
      getRecentAlertsTool,
      getStoreMetricsTool,
    ];

    const model = await this.buildModel();
    const modelWithTools = model.bindTools(tools);

    const systemPrompt = `Sos el Asistente Inteligente de Telegram para el vendedor "${tenant.nickname || tenant.sellerId}" en Mercado Libre.
Tu función es consultar el estado de la tienda utilizando tus herramientas (tools) y responder al vendedor de manera clara, visualmente atractiva y muy legible.

REGLAS CRÍTICAS DE FORMATO EN TELEGRAM (¡OBLIGATORIO!):
1. ⚠️ NUNCA USES TABLAS MARKDOWN (NO uses '| Columna | Columna |' ni líneas divisoras '|---|---|'). Telegram no soporta tablas y se renderizan rotas, desalineadas e ilegibles en pantallas móviles.
2. 📱 Formateá SIEMPRE la información como TARJETAS O LISTAS NUMERADAS con emojis, negritas y saltos de línea claros:
   - Para Preguntas pendientes:
     1️⃣ *Pregunta #ID* · 🏷️ _[Tema/Intención]_
     📦 *Ítem:* [Título de la publicación]
     💬 _"[Texto exacto de la pregunta]"_
     💡 *Sugerencia IA:* "[Respuesta sugerida si existe]"
     🔍 *Motivo:* [Razón de derivación]

     ━━━━━━━━━━━━━━━━━━━━

   - Para Reclamos:
     1️⃣ 🚨 *Reclamo #ID* (Orden: \`[ORD-ID]\`)
     👤 *Comprador ID:* \`[BUYER-ID]\`
     💬 *Motivo:* [Motivo del reclamo]
     ⏳ *Tiempo restante:* *[X] horas* (Vence: [Fecha/Hora])
     🛠️ *Acciones:* [Acciones sugeridas]

     ━━━━━━━━━━━━━━━━━━━━

3. Respondé SIEMPRE en Español rioplatense cordial, prolijo y directo.
4. Mantené la lectura cómoda y limpia en pantallas de smartphones.
5. Al final de la lista de preguntas, agregá:
   "👇 _Podés aprobar o rechazar directamente tocando los botones inferiores:_"
6. Si no hay elementos pendientes o reclamos, respondé con un mensaje positivo y amigable (ej: "🎉 *¡Al día!* No tenés preguntas pendientes en este momento.").`;

    const messages: any[] = [
      new SystemMessage(systemPrompt),
      new HumanMessage(userMessage),
    ];

    const response = await modelWithTools.invoke(messages);

    // Si el LLM invocó tools, ejecutarlas y solicitar la respuesta final
    if (response.tool_calls && response.tool_calls.length > 0) {
      messages.push(response);

      for (const toolCall of response.tool_calls) {
        const selectedTool = tools.find((t) => t.name === toolCall.name);
        if (selectedTool) {
          try {
            const toolOutput = await (selectedTool as any).invoke(toolCall.args);
            messages.push(
              new ToolMessage({
                content: String(toolOutput),
                tool_call_id: toolCall.id || toolCall.name,
              })
            );
          } catch (tErr) {
            messages.push(
              new ToolMessage({
                content: JSON.stringify({ error: String(tErr) }),
                tool_call_id: toolCall.id || toolCall.name,
              })
            );
          }
        }
      }

      const finalResponse = await model.invoke(messages);
      const rawText = typeof finalResponse.content === "string"
        ? finalResponse.content
        : JSON.stringify(finalResponse.content);

      return {
        text: TelegramAssistantService.sanitizeTelegramMarkdown(rawText),
        buttons: collectedButtons.length > 0 ? collectedButtons.slice(0, 5) : undefined,
      };
    }

    const rawText = typeof response.content === "string"
      ? response.content
      : JSON.stringify(response.content);

    return {
      text: TelegramAssistantService.sanitizeTelegramMarkdown(rawText),
      buttons: collectedButtons.length > 0 ? collectedButtons.slice(0, 5) : undefined,
    };
  }

  /**
   * Sanitiza y transforma cualquier tabla Markdown accidental en elegantes tarjetas para Telegram
   */
  public static sanitizeTelegramMarkdown(text: string): string {
    const lines = text.split("\n");
    const hasTable = lines.some((l) => l.trim().startsWith("|") && l.includes("|"));
    if (!hasTable) return text;

    const result: string[] = [];
    let insideTable = false;
    let headers: string[] = [];
    let cardIndex = 1;
    const numEmojis = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣", "🔟"];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      if (line.startsWith("|") && line.endsWith("|")) {
        // Ignorar fila divisoria |--|---|
        if (/^\|[-:\s|]+\|$/.test(line)) {
          continue;
        }

        const cells = line
          .split("|")
          .map((c) => c.trim())
          .filter((c, idx, arr) => idx > 0 && idx < arr.length - 1);

        if (!insideTable) {
          insideTable = true;
          headers = cells;
          continue;
        }

        // Fila de datos convertida a tarjeta limpia
        const numIcon = numEmojis[cardIndex - 1] || `[${cardIndex}]`;
        cardIndex++;

        // Buscar ID, pregunta y tema en las celdas
        const id = cells.find((c) => /^\d{4,}$/.test(c) || /^C\d+$/i.test(c) || /^Q\d+$/i.test(c));
        const questionText = cells.find((c) => c.length > 12 && !/^\d+$/.test(c));
        const otherCells = cells.filter((c) => c !== id && c !== questionText && !/^\d+$/.test(c) && c.length > 0);

        let card = `${numIcon} ${id ? `*Pregunta #${id}*` : "*Elemento*"}`;
        if (otherCells.length > 0) {
          card += ` · _${otherCells[0]}_`;
        }
        if (questionText) {
          card += `\n💬 _"${questionText}"_`;
        } else {
          // Fallback a listado de celdas
          const details = cells
            .map((c, idx) => (headers[idx] ? `*${headers[idx]}:* ${c}` : c))
            .join("\n");
          card += `\n${details}`;
        }

        result.push(card);
        result.push(`\n━━━━━━━━━━━━━━━━━━━━\n`);
      } else {
        if (insideTable) {
          insideTable = false;
          headers = [];
        }
        result.push(lines[i]);
      }
    }

    return result
      .join("\n")
      .replace(/(\n━━━━━━━━━━━━━━━━━━━━\n\s*)+$/g, "")
      .replace(/\n{3,}/g, "\n\n");
  }

  /**
   * Fallback determinístico con regex si no hay conexión al LLM
   */
  public async executeFallback(sellerId: string, text: string): Promise<TelegramAssistantResponse> {
    const lower = text.toLowerCase();

    // 1. Detalle de reclamo específico (ej: "detallame el reclamo C500", "ver reclamo #51234")
    const claimMatch =
      lower.match(
        /(?:detalle|detallame|detallar|ver|info|mostrar|consulta|consultar)\s+(?:de\s+|del\s+|el\s+)?(?:reclamo\s+)?#?([a-z0-9_-]+)/i
      ) || lower.match(/reclamo\s+#?([a-z0-9_-]+)/i);

    if (
      claimMatch &&
      !lower.includes("en gestion") &&
      !lower.includes("abierto") &&
      !lower.includes("resuelto") &&
      !lower.includes("urgente") &&
      !lower.includes("cerrado") &&
      !lower.includes("tengo reclamo")
    ) {
      const claimId = claimMatch[1].trim();
      if (claimId && !["en", "abiertos", "urgentes", "resueltos", "cerrados", "mis", "el", "los"].includes(claimId)) {
        const data = await this.getClaimDetailData(sellerId, claimId);
        if (data.claim) {
          const c = data.claim;
          const urgencyIcon = c.urgency === "critical" ? "🚨" : c.urgency === "high" ? "⚠️" : "ℹ️";
          return {
            text:
              `⚖️ *Detalle del Reclamo #${c.id}*\n\n` +
              `📦 *Orden:* \`${c.orderId || "N/A"}\`\n` +
              `👤 *Comprador ID:* \`${c.buyerId}\`\n` +
              `📌 *Estado:* ${c.status === "opened" ? "🟡 En gestión" : "🟢 Resuelto"}\n` +
              `💬 *Motivo:* "${c.reason}"\n` +
              `⏳ *Tiempo para responder:* ${urgencyIcon} *${c.remainingHours}h restantes*\n` +
              `📅 *Vence:* ${new Date(c.dueDate).toLocaleString("es-AR")}\n\n` +
              `🛠️ *Acciones recomendadas:* ${c.actions.join(", ")}`,
            buttons: [
              [{ text: "✅ Confirmar Lectura", callbackData: `claim_ack_${c.id}` }],
            ],
          };
        }
      }
    }

    // 2. Preguntas pendientes / alertas no vistas
    if (lower.includes("pregunta") || lower.includes("pendiente") || lower.includes("alerta") || lower.includes("duda")) {
      const data = await this.getPendingQuestionsData(sellerId, 10);
      if (data.totalPending === 0) {
        return {
          text: `🎉 *¡Al día!* No tenés preguntas pendientes de revisión humana en este momento.`,
        };
      }

      let msg = `❓ *Tenés ${data.totalPending} pregunta(s) pendiente(s) de revisión:*\n\n`;
      const buttons: TelegramInlineButton[][] = [];
      const numEmojis = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣", "🔟"];

      data.questions.forEach((q, idx) => {
        const numIcon = numEmojis[idx] || `[${idx + 1}]`;
        msg += `${numIcon} *Pregunta #${q.id.slice(-4)}* · 🏷️ _${q.intent || "Consulta"}_\n`;
        msg += `📦 *Ítem:* ${q.itemTitle}\n`;
        msg += `💬 _"${q.question}"_\n`;
        if (q.suggestedAnswer) {
          msg += `💡 *Sugerencia IA:* "${q.suggestedAnswer}"\n`;
        }
        msg += `🔍 *Motivo:* ${q.reason}\n`;
        if (idx < data.questions.length - 1) {
          msg += `\n━━━━━━━━━━━━━━━━━━━━\n\n`;
        } else {
          msg += `\n`;
        }

        buttons.push([
          { text: `✅ Aprobar #${q.id.slice(-4)}`, callbackData: `approve_${q.id}` },
          { text: `❌ Rechazar #${q.id.slice(-4)}`, callbackData: `reject_${q.id}` },
        ]);
      });

      msg += `👇 _Podés responder tocando los botones inferiores:_`;

      return { text: msg, buttons };
    }

    // 3. Reclamos (gestión / resueltos / urgentes)
    if (lower.includes("reclamo") || lower.includes("queja") || lower.includes("sla")) {
      const isUrgent = lower.includes("urgente") || lower.includes("critico") || lower.includes("sla");
      const isClosed = lower.includes("resuelto") || lower.includes("cerrado");
      const status = isClosed ? "closed" : "opened";

      const data = await this.getClaimsData(sellerId, status, isUrgent);
      if (data.claims.length === 0) {
        return {
          text: `✅ *Todo en orden.* No tenés reclamos ${status === "opened" ? "abiertos" : "resueltos"} ${isUrgent ? "urgentes" : ""} registrados.`,
        };
      }

      let msg = `⚖️ *Reclamos ${status === "opened" ? "en Gestión" : "Resueltos"} (${data.claims.length}):*\n\n`;
      const buttons: TelegramInlineButton[][] = [];
      const numEmojis = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣", "🔟"];

      data.claims.forEach((c, idx) => {
        const numIcon = numEmojis[idx] || `[${idx + 1}]`;
        const urgencyIcon = c.urgency === "critical" ? "🚨" : c.urgency === "high" ? "⏰" : "📌";
        msg += `${numIcon} ${urgencyIcon} *Reclamo #${c.id}* (Orden: \`${c.orderId || "N/A"}\`)\n`;
        msg += `💬 Motivo: ${c.reason}\n`;
        msg += `⏳ Restan: *${c.remainingHours}h*\n`;
        if (idx < data.claims.length - 1) {
          msg += `\n━━━━━━━━━━━━━━━━━━━━\n\n`;
        } else {
          msg += `\n`;
        }

        buttons.push([
          { text: `🔍 Detalle Reclamo #${c.id.slice(-6)}`, callbackData: `claim_detail_${c.id}` },
        ]);
      });

      return { text: msg, buttons };
    }

    // 4. Métricas / Resumen
    if (lower.includes("metrica") || lower.includes("estadistica") || lower.includes("resumen") || lower.includes("estado")) {
      const stats = await this.getStoreMetricsData(sellerId);
      return {
        text:
          `📊 *Resumen Operativo de tu Tienda*\n\n` +
          `• ❓ *Preguntas totales:* ${stats.totalQuestions}\n` +
          `• ⚡ *Auto-respondidas por IA:* ${stats.autoAnswered} (${stats.autoAnswerRate})\n` +
          `• 👤 *Pendientes de revisión humana:* ${stats.pendingReviewCount}\n` +
          `• ⚖️ *Reclamos abiertos:* ${stats.openClaimsCount}\n\n` +
          `_Escribime en cualquier momento para detallar algún reclamo o responder preguntas._`,
      };
    }

    // Respuesta genérica de ayuda
    return {
      text:
        `🤖 *¿En qué te puedo ayudar hoy?*\n\n` +
        `Podés preguntarme cosas como:\n` +
        `• _"¿Qué preguntas tengo pendientes?"_\n` +
        `• _"¿Tengo reclamos abiertos o urgentes?"_\n` +
        `• _"Detallame el reclamo #12345"_\n` +
        `• _"Mostrame las métricas de hoy"_\n` +
        `• _"¿Qué alertas recientes no vi?"_`,
    };
  }

  // --- Helpers de datos ---

  public async getPendingQuestionsData(sellerId: string, limit: number = 5) {
    const questions = await this.questionRepo.findBySellerId(sellerId, 50);
    const pending = questions.filter(
      (q) => q.appStatus === "pending_review" || (q as any).status === "pending_review" || q.requiresHuman
    );

    return {
      totalPending: pending.length,
      questions: pending.slice(0, limit).map((q) => {
        const dateObj = q.receivedAt || (q as any).createdAt || new Date();
        return {
          id: q.id,
          itemTitle: q.itemId || "Publicación",
          question: q.text,
          suggestedAnswer: q.suggestedAnswer || "",
          reason: q.reason || "Requiere revisión humana",
          intent: q.intent,
          receivedAt: dateObj instanceof Date ? dateObj.toISOString() : new Date(dateObj).toISOString(),
        };
      }),
    };
  }

  public async getClaimsData(sellerId: string, status?: "opened" | "closed" | "all", urgentOnly?: boolean) {
    const rawClaims = await this.claimRepo.listBySellerId(
      sellerId,
      status === "all" ? undefined : status || "opened"
    );

    const now = new Date();
    let enriched = rawClaims.map((c) => ({
      id: c.id,
      orderId: c.orderId,
      type: c.type,
      stage: c.stage,
      status: c.status,
      reason: c.reason,
      buyerId: c.buyerId,
      actions: c.actions,
      remainingHours: c.getRemainingHours(now),
      urgency: c.getUrgency(now),
      dueDate: c.dueDate.toISOString(),
      createdAt: c.createdAt.toISOString(),
    }));

    if (urgentOnly) {
      enriched = enriched.filter((c) => c.remainingHours <= 24 || c.urgency === "critical" || c.urgency === "high");
    }

    return {
      total: enriched.length,
      claims: enriched,
    };
  }

  public async getClaimDetailData(sellerId: string, claimId: string) {
    let claim = await this.claimRepo.findById(claimId);
    if (!claim) {
      claim = await this.claimRepo.findById(claimId.toUpperCase());
    }
    if (!claim) {
      const all = await this.claimRepo.listBySellerId(sellerId);
      claim = all.find((c) => c.id.toLowerCase() === claimId.toLowerCase()) || null;
    }
    if (!claim) {
      return { claim: null, message: "Reclamo no encontrado" };
    }

    const now = new Date();
    return {
      claim: {
        id: claim.id,
        sellerId: claim.sellerId,
        orderId: claim.orderId,
        type: claim.type,
        stage: claim.stage,
        status: claim.status,
        reason: claim.reason,
        buyerId: claim.buyerId,
        actions: claim.actions,
        remainingHours: claim.getRemainingHours(now),
        urgency: claim.getUrgency(now),
        dueDate: claim.dueDate.toISOString(),
        createdAt: claim.createdAt.toISOString(),
      },
    };
  }

  public async getRecentAlertsData(sellerId: string, limit: number = 5) {
    const events = await this.eventRepo.getRecentBySellerId(sellerId, undefined, limit);
    return {
      total: events.length,
      alerts: events.map((e) => ({
        id: e.id,
        type: e.type,
        message: e.message,
        questionId: e.questionId,
        timestamp: e.createdAt.toISOString(),
      })),
    };
  }

  public async getStoreMetricsData(sellerId: string) {
    const [stats, questions, openClaims] = await Promise.all([
      this.questionRepo.getStatsBySellerId(sellerId).catch(() => ({ total: 0, autoAnswered: 0 })),
      this.questionRepo.findBySellerId(sellerId, 100).catch(() => []),
      this.claimRepo.listBySellerId(sellerId, "opened").catch(() => []),
    ]);

    const pendingCount = questions.filter(
      (q) => q.appStatus === "pending_review" || (q as any).status === "pending_review" || q.requiresHuman
    ).length;
    const rate = stats.total > 0 ? ((stats.autoAnswered / stats.total) * 100).toFixed(1) + "%" : "100%";

    return {
      totalQuestions: stats.total,
      autoAnswered: stats.autoAnswered,
      autoAnswerRate: rate,
      pendingReviewCount: pendingCount,
      openClaimsCount: openClaims.length,
    };
  }
}
