import "dotenv/config";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";

import db from "./lib/db.js";
import { sseHandler, broadcast } from "./lib/sse.js";
import { logEvent, getRecentEvents } from "./lib/events.js";
import { exchangeCodeForTokens, getTokenStatus } from "./lib/meli-auth.js";
import { getItemCached, postAnswer, getResponseTime, publishTestItem } from "./lib/meli-api.js";
import { enqueueQuestion, setAutoAnswerEnabled, getAutoAnswerEnabled, startQuestionsPoller } from "./lib/worker.js";
import { getActiveProviderLabel, classifyAndAnswer } from "./lib/llm-service.js";
import { moderate } from "./lib/moderation.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const PORT = process.env.PORT || 3000;

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

    const latencyMs = Date.now() - new Date(row.received_at).getTime();
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
    authorizeUrl: `https://auth.mercadolibre.com.ar/authorization?response_type=code&client_id=${process.env.ML_CLIENT_ID}&redirect_uri=${encodeURIComponent(process.env.ML_REDIRECT_URI || "")}`,
  });
});

app.post("/api/config/auto-answer", (req, res) => {
  const { enabled } = req.body;
  setAutoAnswerEnabled(Boolean(enabled));
  logEvent({
    type: "config_changed",
    message: `⚙️ Respuesta automática ${enabled ? "ACTIVADA" : "DESACTIVADA"}`,
  });
  res.json({ enabled: Boolean(enabled) });
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

    const autoAnswerOn = getAutoAnswerEnabled();
    if (!requiresHuman && classification.confidence >= 0.75 && autoAnswerOn) {
      const totalMs = Date.now() - startedAt;
      db.prepare(
        `UPDATE questions SET app_status = 'auto_answered', final_answer = ?, answered_at = CURRENT_TIMESTAMP, latency_ms = ? WHERE question_id = ?`
      ).run(classification.answer, totalMs, questionId);
      logEvent({
        questionId,
        type: "answer_published",
        message: `🚀 Publicado (simulado, no llega a MELI real)`,
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
          ? "Respuesta automática desactivada"
          : requiresHuman
            ? reason
            : `Confianza insuficiente (${classification.confidence.toFixed(2)})`;
      logEvent({ questionId, type: "pending_review", message: `👤 Enviado a revisión humana: ${motivo}` });

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

    const updated = db.prepare("SELECT * FROM questions WHERE question_id = ?").get(questionId);
    broadcast("question_updated", updated);
  } catch (err) {
    console.error("Error en simulación:", err);
    db.prepare("UPDATE questions SET app_status = 'error', ml_error = ? WHERE question_id = ?").run(err.message, questionId);
    logEvent({ questionId, type: "error", message: `❌ Error en simulación: ${err.message}` });
  }
});

// ── WhatsApp Webhook & Reply Simulation ──────────────────────────────────

app.post("/api/whatsapp/reply", async (req, res) => {
  const { question_id, reply_text } = req.body || {};
  if (!question_id || !reply_text) {
    return res.status(400).json({ error: "Falta question_id o reply_text" });
  }

  const row = db.prepare("SELECT * FROM questions WHERE question_id = ?").get(question_id);
  if (!row) return res.status(404).json({ error: "Pregunta no encontrada" });

  let textToPublish = row.suggested_answer;
  const isOne =
    reply_text.trim() === "1" ||
    reply_text.trim().toLowerCase() === "si" ||
    reply_text.trim().toLowerCase() === "aprobar";

  if (!isOne) {
    textToPublish = reply_text.trim();
  }

  const moderationResult = moderate(textToPublish);
  if (moderationResult.blocked) {
    return res.status(422).json({ error: `Bloqueado por moderación: ${moderationResult.reason}` });
  }

  try {
    const startedAt = Date.now();
    const isSimulated = row.item_id === "SIMULATED" || row.buyer_id === "simulador" || Number(question_id) >= 900000000;

    if (!isSimulated) {
      await postAnswer(question_id, textToPublish);
    }

    const latencyMs = Date.now() - new Date(row.received_at).getTime();
    db.prepare(
      `UPDATE questions SET app_status = 'approved', final_answer = ?, answered_at = CURRENT_TIMESTAMP, latency_ms = ? WHERE question_id = ?`
    ).run(textToPublish, latencyMs, question_id);

    logEvent({
      questionId: question_id,
      type: "answer_published",
      message: `📲 Aprobado vía WhatsApp (${isOne ? "opción 1 sugerida" : "texto personalizado"}) y publicado`,
      durationMs: Date.now() - startedAt,
    });

    const updated = db.prepare("SELECT * FROM questions WHERE question_id = ?").get(question_id);
    broadcast("question_updated", updated);
    broadcast("whatsapp_reply_confirmed", {
      question_id,
      final_answer: textToPublish,
      timestamp: new Date().toISOString(),
    });

    res.json({ ok: true, question: updated });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`\n🚀 MELI AI Assistant corriendo en http://localhost:${PORT}`);
  console.log(`   Panel:            http://localhost:${PORT}`);
  console.log(`   OAuth login:      http://localhost:${PORT}/oauth/login`);
  console.log(`   Health check:     http://localhost:${PORT}/api/health\n`);
  startQuestionsPoller();
});
