import "dotenv/config";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";

import db from "./lib/db.js";
import { sseHandler, broadcast } from "./lib/sse.js";
import { logEvent, getRecentEvents } from "./lib/events.js";
import { exchangeCodeForTokens, getTokenStatus } from "./lib/meli-auth.js";
import { getItemCached, postAnswer, getResponseTime, publishTestItem } from "./lib/meli-api.js";
import { enqueueQuestion, setAutoAnswerEnabled, getAutoAnswerEnabled, getOperationConfig, setOperationConfig, startQuestionsPoller } from "./lib/worker.js";
import { getActiveProviderLabel, classifyAndAnswer, refineAnswerWithFeedback } from "./lib/llm-service.js";
import { moderate } from "./lib/moderation.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const PORT = process.env.PORT || 3000;

function parseSqliteUtc(dateStr) {
  if (!dateStr) return Date.now();
  const s = String(dateStr).trim();
  if (s.endsWith("Z") || s.includes("+") || (s.length > 10 && s.indexOf("-", 10) !== -1)) {
    return new Date(s).getTime();
  }
  return new Date(s.replace(" ", "T") + "Z").getTime();
}

// ── Webhook & OAuth ─────────────────────────────────────────────────────

app.post("/webhook/ml", (req, res) => {
  // Responder en <50ms: solo validar, loguear y encolar. Nada de I/O bloqueante acá.
  res.status(200).json({ received: true });

  try {
    const { topic, resource } = req.body || {};
    if (topic !== "questions" || !resource) return;

    const match = /\/questions\/(\d+)/.exec(resource);
    if (!match) return;
    const questionId = match[1];

    logEvent({ questionId, type: "webhook_received", message: `📥 Webhook recibido (question_id: ${questionId})` });
    enqueueQuestion(questionId);
  } catch (err) {
    console.error("Error procesando webhook:", err);
  }
});

app.get("/oauth/login", (req, res) => {
  const url = `https://auth.mercadolibre.com.ar/authorization?response_type=code&client_id=${process.env.ML_CLIENT_ID}&redirect_uri=${encodeURIComponent(process.env.ML_REDIRECT_URI)}`;
  res.redirect(url);
});

app.get("/oauth/callback", async (req, res) => {
  try {
    const { code } = req.query;
    if (!code) return res.status(400).send("Falta el parámetro code.");
    await exchangeCodeForTokens(code);
    logEvent({ type: "oauth_connected", message: "🔑 Cuenta de Mercado Libre conectada vía OAuth" });
    res.redirect("/?connected=1");
  } catch (err) {
    console.error(err);
    res.status(500).send(`Error en el callback OAuth: ${err.message}`);
  }
});

// ── SSE & Eventos en Vivo ───────────────────────────────────────────────

app.get("/api/events/stream", sseHandler);

app.get("/api/events", (req, res) => {
  const since = Number(req.query.since) || 0;
  res.json(getRecentEvents(since));
});

// ── Panel & Operaciones ──────────────────────────────────────────────────

app.get("/api/questions", (req, res) => {
  const rows = db.prepare("SELECT * FROM questions ORDER BY received_at DESC LIMIT 100").all();
  const grouped = {
    pending_review: [],
    auto_answered: [],
    other: [],
  };
  for (const row of rows) {
    if (row.app_status === "pending_review") grouped.pending_review.push(row);
    else if (row.app_status === "auto_answered" || row.app_status === "approved") grouped.auto_answered.push(row);
    else grouped.other.push(row);
  }
  res.json(grouped);
});

app.post("/api/questions/:id/approve", async (req, res) => {
  const { id } = req.params;
  const row = db.prepare("SELECT * FROM questions WHERE question_id = ?").get(id);
  if (!row) return res.status(404).json({ error: "Pregunta no encontrada" });

  const text = req.body?.text || row.suggested_answer;
  const moderationResult = moderate(text);
  if (moderationResult.blocked) {
    return res.status(422).json({ error: `Bloqueado por moderación: ${moderationResult.reason}` });
  }

  try {
    const startedAt = Date.now();
    const isSimulated = row.item_id === "SIMULATED" || row.buyer_id === "simulador";

    if (!isSimulated) {
      await postAnswer(id, text);
    }

    const latencyMs = Math.max(0, Date.now() - parseSqliteUtc(row.received_at));
    db.prepare(
      `UPDATE questions SET app_status = 'approved', final_answer = ?, answered_at = CURRENT_TIMESTAMP, latency_ms = ? WHERE question_id = ?`
    ).run(text, latencyMs, id);

    logEvent({
      questionId: id,
      type: "answer_published",
      message: isSimulated
        ? `🚀 Respuesta aprobada por operador (simulada)`
        : `🚀 Respuesta aprobada por operador y publicada en Mercado Libre`,
      durationMs: Date.now() - startedAt,
    });

    const updated = db.prepare("SELECT * FROM questions WHERE question_id = ?").get(id);
    broadcast("question_updated", updated);
    res.json(updated);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

app.post("/api/questions/:id/reject", (req, res) => {
  const { id } = req.params;
  db.prepare("UPDATE questions SET app_status = 'rejected' WHERE question_id = ?").run(id);
  logEvent({ questionId: id, type: "rejected", message: `🗑️ Respuesta descartada por operador` });
  const updated = db.prepare("SELECT * FROM questions WHERE question_id = ?").get(id);
  broadcast("question_updated", updated);
  res.json(updated);
});

app.get("/api/response-time", async (req, res) => {
  try {
    const data = await getResponseTime(process.env.ML_SELLER_ID);
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

app.get("/api/health", async (req, res) => {
  res.json({
    ok: true,
    tokenStatus: getTokenStatus(),
    llmProvider: getActiveProviderLabel(),
    autoAnswerEnabled: getAutoAnswerEnabled(),
    operatingMode: getOperationConfig(),
    authorizeUrl: `https://auth.mercadolibre.com.ar/authorization?response_type=code&client_id=${process.env.ML_CLIENT_ID}&redirect_uri=${encodeURIComponent(process.env.ML_REDIRECT_URI || "")}`,
  });
});

app.get("/api/config/operating-mode", (req, res) => {
  res.json(getOperationConfig());
});

app.post("/api/config/operating-mode", (req, res) => {
  const { mode, schedule } = req.body || {};
  const updated = setOperationConfig({ mode, schedule });
  res.json(updated);
});

app.post("/api/config/auto-answer", (req, res) => {
  const { enabled } = req.body;
  setAutoAnswerEnabled(Boolean(enabled));
  res.json({ enabled: Boolean(enabled), config: getOperationConfig() });
});

// ── Setup de test contra ML real ─────────────────────────────────────────

let lastPublishedItem = null;

app.post("/api/test/publish-item", async (req, res) => {
  try {
    const item = await publishTestItem(req.body || {});
    lastPublishedItem = {
      id: item.id,
      title: item.title,
      price: item.price,
      permalink: item.permalink,
      publishedAt: new Date().toISOString(),
    };
    logEvent({ type: "item_published", message: `📦 Ítem de prueba publicado: ${item.id} — ${item.permalink}` });
    res.json(lastPublishedItem);
  } catch (err) {
    console.error(err);
    res.status(502).json({ error: err.message });
  }
});

app.get("/api/test/last-item", (req, res) => {
  res.json(lastPublishedItem || {});
});

// ── Simulador ────────────────────────────────────────────────────────────

let simulatedIdCounter = 900000000;

app.post("/api/simulate-question", async (req, res) => {
  const { text, item_title, item_price, intent_hint } = req.body || {};
  if (!text) return res.status(400).json({ error: "Falta el texto de la pregunta" });

  const questionId = String(simulatedIdCounter++);
  const fakeItem = {
    title: item_title || "Auriculares Bluetooth Inalámbricos XZ Pro",
    price: item_price || 45999,
    currency_id: "ARS",
    available_quantity: 12,
    condition: "new",
    attributes: [
      { name: "Color", value_name: "Negro" },
      { name: "Marca", value_name: "XZ Audio" },
    ],
    description_text:
      "Auriculares bluetooth con cancelación de ruido, 30hs de batería, resistentes al agua IPX4. Garantía de fábrica 12 meses.",
  };

  res.status(200).json({ received: true, question_id: questionId });

  logEvent({
    questionId,
    type: "webhook_received",
    message: `📥 Pregunta simulada recibida${intent_hint ? ` (hint: ${intent_hint})` : ""}`,
  });

  db.prepare(
    `INSERT INTO questions (question_id, item_id, buyer_id, text, ml_status, app_status)
     VALUES (?, 'SIMULATED', 'simulador', ?, 'UNANSWERED', 'processing')
     ON CONFLICT(question_id) DO UPDATE SET app_status = 'processing'`
  ).run(questionId, text);

  try {
    const startedAt = Date.now();
    let t0 = Date.now();
    logEvent({
      questionId,
      type: "item_fetched",
      message: `📦 Ítem simulado: "${fakeItem.title}"`,
      durationMs: Date.now() - t0,
    });

    t0 = Date.now();
    const classification = await classifyAndAnswer({ questionText: text, item: fakeItem });
    logEvent({
      questionId,
      type: "llm_classified",
      message: `🧠 Clasificado -> intent: ${classification.intent}, conf: ${classification.confidence.toFixed(2)}`,
      durationMs: Date.now() - t0,
    });

    db.prepare(
      `UPDATE questions SET intent = ?, confidence = ?, requires_human = ?, reason = ?, suggested_answer = ? WHERE question_id = ?`
    ).run(
      classification.intent,
      classification.confidence,
      classification.requires_human ? 1 : 0,
      classification.reason,
      classification.answer,
      questionId
    );

    t0 = Date.now();
    const moderationResult = moderate(classification.answer);
    logEvent({
      questionId,
      type: "moderation_checked",
      message: moderationResult.blocked
        ? `🛡️ Moderación determinística: BLOQUEADA (${moderationResult.reason})`
        : `🛡️ Moderación determinística: APROBADA`,
      durationMs: Date.now() - t0,
    });

    let requiresHuman = classification.requires_human;
    let reason = classification.reason;
    if (moderationResult.blocked) {
      requiresHuman = true;
      reason = moderationResult.reason;
      db.prepare(`UPDATE questions SET requires_human = 1, reason = ? WHERE question_id = ?`).run(reason, questionId);
    }

    const opConfig = getOperationConfig();
    const autoAnswerOn = opConfig.isAutoAnswer;
    const shouldAutoPublish = autoAnswerOn && !moderationResult.blocked;

    if (shouldAutoPublish) {
      const totalMs = Date.now() - startedAt;
      db.prepare(
        `UPDATE questions SET app_status = 'auto_answered', final_answer = ?, answered_at = CURRENT_TIMESTAMP, latency_ms = ? WHERE question_id = ?`
      ).run(classification.answer, totalMs, questionId);
      logEvent({
        questionId,
        type: "answer_published",
        message: `🚀 Publicado automáticamente [${opConfig.statusLabel}] (simulado)`,
      });
      logEvent({
        questionId,
        type: "flow_completed",
        message: `✅ Flujo completado en ${(totalMs / 1000).toFixed(3)}s`,
      });
    } else {
      db.prepare(`UPDATE questions SET app_status = 'pending_review' WHERE question_id = ?`).run(questionId);
      const motivo = moderationResult.blocked
        ? moderationResult.reason
        : !autoAnswerOn
          ? `Modo supervisado (${opConfig.statusLabel})`
          : requiresHuman
            ? reason
            : `Revisión requerida`;
      logEvent({ questionId, type: "pending_review", message: `👤 Enviado a revisión humana: ${motivo}` });

      // Enviar a WhatsApp SOLO si está en modo supervisado
      if (!autoAnswerOn) {
        broadcast("whatsapp_notification", {
          question_id: questionId,
          item_title: fakeItem.title,
          item_price: fakeItem.price,
          question_text: text,
          reason: motivo,
          suggested_answer: classification.answer,
          intent: classification.intent,
          timestamp: new Date().toISOString(),
        });
      }
    }

    const updated = db.prepare("SELECT * FROM questions WHERE question_id = ?").get(questionId);
    broadcast("question_updated", updated);
  } catch (err) {
    console.error("Error en simulación:", err);
    db.prepare("UPDATE questions SET app_status = 'error', ml_error = ? WHERE question_id = ?").run(err.message, questionId);
    logEvent({ questionId, type: "error", message: `❌ Error en simulación: ${err.message}` });
  }
});

// ── WhatsApp Webhook & Reply Simulation ──────────────────────────────────

let activeOperatorQuestionId = null;

async function executePublish(questionId, textToPublish, res) {
  const row = db.prepare("SELECT * FROM questions WHERE question_id = ?").get(questionId);
  if (!row) return res.status(404).json({ error: "Pregunta no encontrada" });

  const moderationResult = moderate(textToPublish);
  if (moderationResult.blocked) {
    return res.status(422).json({ error: `Bloqueado por moderación: ${moderationResult.reason}` });
  }

  try {
    const startedAt = Date.now();
    const isSimulated = row.item_id === "SIMULATED" || row.buyer_id === "simulador" || Number(questionId) >= 900000000;

    if (!isSimulated) {
      await postAnswer(questionId, textToPublish);
    }

    const latencyMs = Math.max(0, Date.now() - parseSqliteUtc(row.received_at));
    db.prepare(
      `UPDATE questions SET app_status = 'approved', final_answer = ?, answered_at = CURRENT_TIMESTAMP, latency_ms = ? WHERE question_id = ?`
    ).run(textToPublish, latencyMs, questionId);

    logEvent({
      questionId,
      type: "answer_published",
      message: `📲 Aprobado vía WhatsApp y publicado: "${textToPublish}"`,
      durationMs: Date.now() - startedAt,
    });

    activeOperatorQuestionId = null;

    const updated = db.prepare("SELECT * FROM questions WHERE question_id = ?").get(questionId);
    broadcast("question_updated", updated);
    broadcast("whatsapp_reply_confirmed", {
      question_id: questionId,
      final_answer: textToPublish,
      timestamp: new Date().toISOString(),
    });

    return res.json({
      ok: true,
      action: "published",
      question: updated,
      message: `✅ ¡Listo! Respuesta publicada en Mercado Libre:\n"${textToPublish}"`,
    });
  } catch (err) {
    return res.status(502).json({ error: err.message });
  }
}

app.post("/api/whatsapp/reply", async (req, res) => {
  let { question_id, reply_text } = req.body || {};
  if (!reply_text || !reply_text.trim()) {
    return res.status(400).json({ error: "Falta reply_text" });
  }

  const rawText = reply_text.trim();
  const trimmed = rawText.toLowerCase();

  const pendingRows = db
    .prepare("SELECT * FROM questions WHERE app_status = 'pending_review' ORDER BY received_at DESC LIMIT 10")
    .all();

  // 1. Comando directo: "aprobar 1", "aprobar 2", "publicar 1", "ok 1"
  const directApproveMatch = /^(?:aprobar|publicar|enviar|ok)\s+(\d+)$/i.exec(trimmed);
  if (directApproveMatch) {
    const idx = parseInt(directApproveMatch[1], 10) - 1;
    if (idx >= 0 && idx < pendingRows.length) {
      const targetQ = pendingRows[idx];
      return executePublish(targetQ.question_id, targetQ.suggested_answer, res);
    }
  }

  // 2. Selección numérica cuando no hay pregunta activa o se pide un número: ej "1", "2", "ver 1", "atender 2"
  const selectMatch = /^(?:ver\s+|atender\s+|consulta\s+|#)?(\d+)$/i.exec(trimmed);
  if (selectMatch && (!question_id || selectMatch[0].startsWith("ver") || selectMatch[0].startsWith("atender") || selectMatch[0].startsWith("#"))) {
    const num = parseInt(selectMatch[1], 10);
    if (num >= 1 && num <= pendingRows.length) {
      const selectedQ = pendingRows[num - 1];
      activeOperatorQuestionId = selectedQ.question_id;
      return res.json({
        ok: true,
        action: "selected_question",
        index: num,
        question: selectedQ,
        total_pending: pendingRows.length,
        message: `📌 *Seleccionaste la consulta #${num}*\n📦 ${selectedQ.item_id === "SIMULATED" ? "Auriculares Bluetooth" : selectedQ.item_id}\n❓ "${selectedQ.text}"\n\n💡 *Sugerencia IA:*\n"${selectedQ.suggested_answer}"\n\n👉 Respondé *1* para aprobar o escribí tu corrección.`,
      });
    }
  }

  // 3. Consulta de lista de pendientes
  const isAskingForPending =
    trimmed.includes("pendiente") ||
    trimmed.includes("que hay") ||
    trimmed.includes("qué hay") ||
    trimmed.includes("que preguntas") ||
    trimmed.includes("qué preguntas") ||
    trimmed.includes("hay preguntas") ||
    trimmed.includes("listar") ||
    trimmed.includes("resumen") ||
    trimmed.includes("estado") ||
    trimmed.includes("menu") ||
    trimmed.includes("ayuda") ||
    trimmed === "hola";

  if (isAskingForPending || (!question_id && !activeOperatorQuestionId)) {
    activeOperatorQuestionId = null;
    if (pendingRows.length === 0) {
      return res.json({
        ok: true,
        action: "list_empty",
        message: "✨ ¡No tenés preguntas pendientes de revisión en este momento! Todo respondido y al día.",
      });
    }

    let textList = `📋 *Tenés ${pendingRows.length} preguntas pendientes de revisión:*\n\n`;
    pendingRows.forEach((q, idx) => {
      textList += `${idx + 1}️⃣ "${q.text}"\n💡 _${q.suggested_answer || "—"}_\n\n`;
    });
    textList += `👉 *Escribí el número (ej: 1 o 2)* para atenderla, o *aprobar 1* para publicarla directo.`;

    return res.json({
      ok: true,
      action: "list_pending",
      count: pendingRows.length,
      questions: pendingRows,
      formatted_text: textList,
    });
  }

  const targetId = question_id || activeOperatorQuestionId;
  const row = db.prepare("SELECT * FROM questions WHERE question_id = ?").get(targetId);
  if (!row || row.app_status !== "pending_review") {
    activeOperatorQuestionId = null;
    return res.json({
      ok: true,
      action: pendingRows.length > 0 ? "list_pending" : "list_empty",
      count: pendingRows.length,
      questions: pendingRows,
      message: "Esa consulta ya fue respondida o no está pendiente.",
    });
  }

  const isApproval = [
    "1",
    "si",
    "sí",
    "aprobar",
    "aprobado",
    "ok",
    "dale",
    "listo",
    "enviar",
    "publicar",
    "mándalo",
    "mandalo",
    "manda",
    "envialo",
  ].includes(trimmed);

  if (!isApproval) {
    try {
      const startedAt = Date.now();
      const refinedText = await refineAnswerWithFeedback({
        questionText: row.text,
        itemTitle: row.item_id === "SIMULATED" ? "Ítem simulado" : "Auriculares Bluetooth",
        previousSuggestion: row.suggested_answer,
        feedback: rawText,
      });

      const mod = moderate(refinedText);
      const safeAnswer = mod.blocked
        ? "¡Hola! Por políticas de la plataforma todas las operaciones y consultas se gestionan exclusivamente por Mercado Libre. ¡Saludos!"
        : refinedText;

      db.prepare(`UPDATE questions SET suggested_answer = ? WHERE question_id = ?`).run(safeAnswer, targetId);

      logEvent({
        questionId: targetId,
        type: "llm_classified",
        message: `✍️ Sugerencia ajustada con feedback del operador: "${safeAnswer}"`,
        durationMs: Date.now() - startedAt,
      });

      const updated = db.prepare("SELECT * FROM questions WHERE question_id = ?").get(targetId);
      broadcast("question_updated", updated);

      return res.json({
        ok: true,
        action: "refined",
        new_suggestion: safeAnswer,
        question: updated,
        message: `🔄 *Nueva sugerencia ajustada:*\n"${safeAnswer}"\n\n👉 Respondé *1* para aprobar y publicar, o escribí otro cambio.`,
      });
    } catch (err) {
      console.error("Error refinando respuesta:", err);
      return res.status(500).json({ error: `Error refinando sugerencia: ${err.message}` });
    }
  }

  return executePublish(targetId, row.suggested_answer, res);
});

app.listen(PORT, () => {
  console.log(`\n🚀 MELI AI Assistant corriendo en http://localhost:${PORT}`);
  console.log(`   Panel:            http://localhost:${PORT}`);
  console.log(`   OAuth login:      http://localhost:${PORT}/oauth/login`);
  console.log(`   Health check:     http://localhost:${PORT}/api/health\n`);
  startQuestionsPoller();
});
