import db from "./db.js";
import { logEvent } from "./events.js";
import { getQuestion, getItemCached, postAnswer, getReceivedQuestions } from "./meli-api.js";
import { classifyAndAnswer } from "./llm-service.js";
import { moderate } from "./moderation.js";
import { broadcast } from "./sse.js";

const queue = [];
const inFlight = new Set();
let processing = false;

export function getOperationConfig() {
  const modeRow = db.prepare("SELECT value FROM app_config WHERE key = 'operation_mode'").get();
  const scheduleRow = db.prepare("SELECT value FROM app_config WHERE key = 'schedule_config'").get();

  const mode = modeRow?.value || "schedule";
  let schedule = {
    days: [1, 2, 3, 4, 5],
    start_time: "09:00",
    end_time: "18:00",
    timezone: "America/Argentina/Buenos_Aires",
  };

  if (scheduleRow?.value) {
    try {
      schedule = { ...schedule, ...JSON.parse(scheduleRow.value) };
    } catch (e) {}
  }

  const nowInArg = new Date(new Date().toLocaleString("en-US", { timeZone: schedule.timezone || "America/Argentina/Buenos_Aires" }));
  const day = nowInArg.getDay();
  const hours = nowInArg.getHours();
  const minutes = nowInArg.getMinutes();
  const currentMinutes = hours * 60 + minutes;

  const [startH, startM] = (schedule.start_time || "09:00").split(":").map(Number);
  const [endH, endM] = (schedule.end_time || "18:00").split(":").map(Number);
  const startMinutes = startH * 60 + (startM || 0);
  const endMinutes = endH * 60 + (endM || 0);

  const isDaySupervised = (schedule.days || []).includes(day);
  const isTimeSupervised = currentMinutes >= startMinutes && currentMinutes < endMinutes;
  const isWithinBusinessHours = isDaySupervised && isTimeSupervised;

  let isAutoAnswer = false;
  let statusLabel = "";

  if (mode === "auto") {
    isAutoAnswer = true;
    statusLabel = "🤖 Modo 100% Automático";
  } else if (mode === "manual") {
    isAutoAnswer = false;
    statusLabel = "👤 Modo 100% Supervisado (Manual)";
  } else {
    isAutoAnswer = !isWithinBusinessHours;
    statusLabel = isWithinBusinessHours
      ? "👤 Horario Laboral (Supervisado)"
      : "🌙 Fuera de Horario (Auto-Respuesta 24/7)";
  }

  const timeFormatted = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;

  return {
    mode,
    schedule,
    isAutoAnswer,
    isWithinBusinessHours,
    statusLabel,
    currentTime: timeFormatted,
    currentDay: day,
  };
}

export function setOperationConfig({ mode, schedule }) {
  if (mode && ["auto", "manual", "schedule"].includes(mode)) {
    db.prepare(
      `INSERT INTO app_config (key, value) VALUES ('operation_mode', ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`
    ).run(mode);
  }

  if (schedule && typeof schedule === "object") {
    db.prepare(
      `INSERT INTO app_config (key, value) VALUES ('schedule_config', ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`
    ).run(JSON.stringify(schedule));
  }

  const current = getOperationConfig();
  logEvent({
    type: "config_changed",
    message: `⚙️ Modo de operación actualizado a: ${current.statusLabel}`,
  });
  broadcast("config_updated", current);
  return current;
}

export function setAutoAnswerEnabled(enabled) {
  setOperationConfig({ mode: enabled ? "auto" : "manual" });
}

export function getAutoAnswerEnabled() {
  return getOperationConfig().isAutoAnswer;
}

/** Encola un question_id para procesamiento asíncrono. Deduplica en curso. */
export function enqueueQuestion(questionId) {
  if (inFlight.has(questionId)) return;
  const existing = db.prepare("SELECT app_status FROM questions WHERE question_id = ?").get(questionId);
  if (existing && ["auto_answered", "approved", "rejected", "skipped_already_answered", "pending_review", "processing"].includes(existing.app_status)) {
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

  // 5. Decisión de publicación según modo y horario
  const opConfig = getOperationConfig();
  const autoAnswerOn = opConfig.isAutoAnswer;
  const shouldAutoPublish = autoAnswerOn && !moderationResult.blocked;

  if (shouldAutoPublish) {
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
        message: `🚀 Publicado automáticamente en Mercado Libre API (200 OK) [${opConfig.statusLabel}]`,
        durationMs: Date.now() - t0,
      });
      logEvent({
        questionId,
        type: "flow_completed",
        message: `✅ Flujo completado en ${(totalMs / 1000).toFixed(3)}s`,
      });
    } catch (err) {
      db.prepare(`UPDATE questions SET app_status = 'error', ml_error = ? WHERE question_id = ?`).run(
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
        ? `Modo supervisado (${opConfig.statusLabel})`
        : requiresHuman
          ? reason
          : `Revisión requerida`;
    logEvent({
      questionId,
      type: "pending_review",
      message: `👤 Enviado a revisión humana: ${motivo}`,
    });

    // Enviar a WhatsApp SOLO si está en modo supervisado
    if (!autoAnswerOn) {
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
