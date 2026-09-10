import db from "./db.js";
import { logEvent } from "./events.js";
import { getQuestion, getItemCached, postAnswer, getReceivedQuestions } from "./meli-api.js";
import { classifyAndAnswer } from "./llm-service.js";
import { moderate } from "./moderation.js";
import { broadcast } from "./sse.js";

const queue = [];
const inFlight = new Set();
let processing = false;

function isAutoAnswerEnabled() {
  const row = db.prepare("SELECT value FROM app_config WHERE key = 'auto_answer_enabled'").get();
  return row?.value === "true";
}

export function setAutoAnswerEnabled(enabled) {
  db.prepare(
    `INSERT INTO app_config (key, value) VALUES ('auto_answer_enabled', ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  ).run(String(enabled));
}

export function getAutoAnswerEnabled() {
  return isAutoAnswerEnabled();
}

/** Encola un question_id para procesamiento asíncrono. Deduplica en curso. */
export function enqueueQuestion(questionId) {
  if (inFlight.has(questionId)) return;
  const existing = db.prepare("SELECT app_status FROM questions WHERE question_id = ?").get(questionId);
  if (existing && ["auto_answered", "approved", "rejected", "skipped_already_answered"].includes(existing.app_status)) {
    return;
  }
  queue.push(questionId);
  inFlight.add(questionId);
  drainQueue();
}

async function drainQueue() {
  if (processing) return;
  processing = true;
  while (queue.length > 0) {
    const questionId = queue.shift();
    try {
      await processQuestion(questionId);
    } catch (err) {
      logEvent({ questionId, type: "error", message: `❌ Error procesando pregunta: ${err.message}` });
      db.prepare(
        `INSERT INTO questions (question_id, item_id, text, app_status, ml_error)
         VALUES (?, '', '', 'error', ?)
         ON CONFLICT(question_id) DO UPDATE SET app_status = 'error', ml_error = excluded.ml_error`
      ).run(questionId, err.message);
      broadcast("question_updated", getQuestionRow(questionId));
    } finally {
      inFlight.delete(questionId);
    }
  }
  processing = false;
}

function getQuestionRow(questionId) {
  return db.prepare("SELECT * FROM questions WHERE question_id = ?").get(questionId);
}

async function processQuestion(questionId) {
  const startedAt = Date.now();

  // Deduplicación: si ya fue procesada (estado final), ignorar.
  const existing = getQuestionRow(questionId);
  if (existing && ["auto_answered", "approved", "rejected", "skipped_already_answered"].includes(existing.app_status)) {
    return;
  }

  db.prepare(
    `INSERT INTO questions (question_id, item_id, text, app_status)
     VALUES (?, '', '', 'processing')
     ON CONFLICT(question_id) DO UPDATE SET app_status = 'processing'`
  ).run(questionId);

  // 1. Chequeo de estado real en MELI.
  let t0 = Date.now();
  const question = await getQuestion(questionId);
  logEvent({
    questionId,
    type: "question_fetched",
    message: `📨 Pregunta obtenida de MELI (status: ${question.status})`,
    durationMs: Date.now() - t0,
  });

  if (question.status !== "UNANSWERED") {
    db.prepare(
      `UPDATE questions SET item_id = ?, buyer_id = ?, text = ?, ml_status = ?, app_status = 'skipped_already_answered' WHERE question_id = ?`
    ).run(String(question.item_id), String(question.from?.id ?? ""), question.text, question.status, questionId);
    logEvent({
      questionId,
      type: "skipped",
      message: `⏭️ Pregunta ya respondida fuera del sistema (status: ${question.status})`,
    });
    broadcast("question_updated", getQuestionRow(questionId));
    return;
  }

  db.prepare(
    `UPDATE questions SET item_id = ?, buyer_id = ?, text = ?, ml_status = ? WHERE question_id = ?`
  ).run(String(question.item_id), String(question.from?.id ?? ""), question.text, question.status, questionId);

  // 2. Cache de ítem.
  t0 = Date.now();
  const item = await getItemCached(question.item_id);
  logEvent({
    questionId,
    type: "item_fetched",
    message: `📦 Ítem obtenido${item._fromCache ? " (cache)" : " de MELI"}: "${item.title}"`,
    durationMs: Date.now() - t0,
  });

  // 3. Clasificación y generación con LangChain.
  t0 = Date.now();
  const classification = await classifyAndAnswer({ questionText: question.text, item });
  const classifyMs = Date.now() - t0;
  logEvent({
    questionId,
    type: "llm_classified",
    message: `🧠 Clasificado -> intent: ${classification.intent}, conf: ${classification.confidence.toFixed(2)}`,
    durationMs: classifyMs,
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

  // 4. Validador determinístico de moderación (SIEMPRE corre).
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

  // 5. Decisión de publicación.
  const autoAnswerOn = isAutoAnswerEnabled();
  if (!requiresHuman && classification.confidence >= 0.75 && autoAnswerOn) {
    t0 = Date.now();
    try {
      await postAnswer(questionId, classification.answer);
      const totalMs = Date.now() - startedAt;
      db.prepare(
        `UPDATE questions SET app_status = 'auto_answered', final_answer = ?, answered_at = CURRENT_TIMESTAMP, latency_ms = ? WHERE question_id = ?`
      ).run(classification.answer, totalMs, questionId);
      logEvent({
        questionId,
        type: "answer_published",
        message: `🚀 Publicado en Mercado Libre API (200 OK)`,
        durationMs: Date.now() - t0,
      });
      logEvent({
        questionId,
        type: "flow_completed",
        message: `✅ Flujo completado en ${(totalMs / 1000).toFixed(3)}s`,
      });
    } catch (err) {
      db.prepare(`UPDATE questions SET app_status = 'pending_review', ml_error = ? WHERE question_id = ?`).run(
        err.message,
        questionId
      );
      logEvent({ questionId, type: "error", message: `❌ Error publicando respuesta: ${err.message}` });
    }
  } else {
    db.prepare(`UPDATE questions SET app_status = 'pending_review' WHERE question_id = ?`).run(questionId);
    const motivo = moderationResult.blocked
      ? moderationResult.reason
      : !autoAnswerOn
        ? "Respuesta automática desactivada"
        : requiresHuman
          ? reason
          : `Confianza insuficiente (${classification.confidence.toFixed(2)})`;
    logEvent({
      questionId,
      type: "pending_review",
      message: `👤 Enviado a revisión humana: ${motivo}`,
    });

    broadcast("whatsapp_notification", {
      question_id: questionId,
      item_title: item.title,
      item_price: item.price,
      question_text: question.text,
      reason: motivo,
      suggested_answer: classification.answer,
      intent: classification.intent,
      timestamp: new Date().toISOString(),
    });
  }

  broadcast("question_updated", getQuestionRow(questionId));
}

const POLL_INTERVAL_MS = 15_000;
let pollTimer = null;

/** Fallback de resiliencia: mientras el webhook de ML no llega, este poller
 * encuentra preguntas sin responder consultando la API directamente. */
export function startQuestionsPoller() {
  if (pollTimer) return;
  pollTimer = setInterval(async () => {
    try {
      const { questions } = await getReceivedQuestions();
      for (const q of questions) {
        if (q.status === "UNANSWERED") enqueueQuestion(String(q.id));
      }
    } catch (err) {
      logEvent({ type: "error", message: `❌ Error en polling de preguntas: ${err.message}` });
    }
  }, POLL_INTERVAL_MS);
}
