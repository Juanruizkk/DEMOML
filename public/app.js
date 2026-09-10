const state = {
  rawQuestions: [],
  filteredQuestions: [],
  lastEventId: 0,
  autoAnswerEnabled: true,
  currentView: "duo",
  searchTerm: "",
  statusFilter: "all",
  intentFilter: "all",
  consoleVisible: true,
};

const el = {
  mainContainer: document.getElementById("main-container"),
  tabButtons: document.querySelectorAll(".tab-btn"),
  badgeProvider: document.getElementById("badge-provider"),
  badgeToken: document.getElementById("badge-token"),
  badgeSse: document.getElementById("badge-sse"),
  badgeTotalQuestions: document.getElementById("badge-total-questions"),
  switchToggle: document.getElementById("switch-toggle"),
  switchState: document.getElementById("switch-state"),
  switchWrap: document.getElementById("auto-answer-switch"),
  btnRefresh: document.getElementById("btn-refresh"),
  btnOpenSimulator: document.getElementById("btn-open-simulator"),
  btnCloseSimulator: document.getElementById("btn-close-simulator"),
  simulatorBackdrop: document.getElementById("simulator-backdrop"),
  simulatorText: document.getElementById("simulator-text"),
  btnSendSimulation: document.getElementById("btn-send-simulation"),
  quickButtons: document.querySelectorAll(".quick-btn"),
  
  // WhatsApp Elements
  waChatBody: document.getElementById("wa-chat-body"),
  waQuickActions: document.getElementById("wa-quick-actions"),
  waBtnApprove1: document.getElementById("wa-btn-approve-1"),
  waBtnEdit: document.getElementById("wa-btn-edit"),
  waForm: document.getElementById("wa-form"),
  waInputText: document.getElementById("wa-input-text"),
  waWelcomeTime: document.getElementById("wa-welcome-time"),
  btnResetChat: document.getElementById("btn-reset-chat"),

  // Table & Filters
  searchInput: document.getElementById("search-input"),
  filterStatus: document.getElementById("filter-status"),
  filterIntent: document.getElementById("filter-intent"),
  questionsTbody: document.getElementById("questions-tbody"),

  // Metrics
  metricTotal: document.getElementById("metric-total"),
  metricLabor: document.getElementById("metric-labor"),
  metricOffhours: document.getElementById("metric-offhours"),
  metricWeekend: document.getElementById("metric-weekend"),

  // Console
  console: document.getElementById("event-console"),
  countEvents: document.getElementById("count-events"),
  btnToggleConsole: document.getElementById("btn-toggle-console"),
};

let eventCounter = 0;
let currentWaQuestion = null;

// ── Init ───────────────────────────────────────────────────────────────

init();

async function init() {
  if (el.waWelcomeTime) {
    el.waWelcomeTime.textContent = new Date().toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
  }

  // Load View Preference
  const savedView = localStorage.getItem("meli_view_mode") || "duo";
  setViewMode(savedView);

  el.tabButtons.forEach((btn) => {
    btn.addEventListener("click", () => setViewMode(btn.dataset.view));
  });

  await loadHealth();
  await loadQuestions();
  await loadResponseTime();
  connectSSE();

  // Switch Auto-Answer
  el.switchWrap.addEventListener("click", toggleAutoAnswer);

  // Simulator Modal
  el.btnOpenSimulator.addEventListener("click", () => (el.simulatorBackdrop.hidden = false));
  el.btnCloseSimulator.addEventListener("click", () => (el.simulatorBackdrop.hidden = true));
  el.simulatorBackdrop.addEventListener("click", (e) => {
    if (e.target === el.simulatorBackdrop) el.simulatorBackdrop.hidden = true;
  });
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !el.simulatorBackdrop.hidden) {
      el.simulatorBackdrop.hidden = true;
    }
  });
  el.btnSendSimulation.addEventListener("click", sendSimulation);
  el.quickButtons.forEach((btn) => btn.addEventListener("click", () => applyPreset(btn.dataset.preset)));

  // Refresh Button
  if (el.btnRefresh) {
    el.btnRefresh.addEventListener("click", async () => {
      el.btnRefresh.style.transform = "rotate(360deg)";
      el.btnRefresh.style.transition = "transform 0.5s ease";
      await loadQuestions();
      await loadResponseTime();
      setTimeout(() => {
        el.btnRefresh.style.transform = "none";
        el.btnRefresh.style.transition = "none";
      }, 500);
    });
  }

  // Search & Filters
  el.searchInput.addEventListener("input", (e) => {
    state.searchTerm = e.target.value.toLowerCase().trim();
    applyFilters();
  });
  el.filterStatus.addEventListener("change", (e) => {
    state.statusFilter = e.target.value;
    applyFilters();
  });
  el.filterIntent.addEventListener("change", (e) => {
    state.intentFilter = e.target.value;
    applyFilters();
  });

  // Console Drawer Toggle
  if (el.btnToggleConsole) {
    el.btnToggleConsole.addEventListener("click", () => {
      state.consoleVisible = !state.consoleVisible;
      el.console.style.display = state.consoleVisible ? "block" : "none";
    });
  }

  // WhatsApp Actions
  if (el.waBtnApprove1) {
    el.waBtnApprove1.addEventListener("click", () => sendWhatsAppReply("1"));
  }
  if (el.waBtnEdit) {
    el.waBtnEdit.addEventListener("click", () => {
      if (currentWaQuestion?.suggested_answer) {
        el.waInputText.value = currentWaQuestion.suggested_answer;
        el.waInputText.focus();
      }
    });
  }
  if (el.waForm) {
    el.waForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const val = el.waInputText.value.trim();
      if (val) sendWhatsAppReply(val);
    });
  }
  if (el.btnResetChat) {
    el.btnResetChat.addEventListener("click", resetWhatsAppChat);
  }

  setInterval(loadResponseTime, 60000);
}

// ── View Mode ──────────────────────────────────────────────────────────

function setViewMode(view) {
  state.currentView = view;
  el.tabButtons.forEach((b) => b.classList.toggle("active", b.dataset.view === view));
  if (el.mainContainer) {
    el.mainContainer.className = `split-container view-${view}`;
  }
  localStorage.setItem("meli_view_mode", view);
}

// ── Health / Badges ────────────────────────────────────────────────────

async function loadHealth() {
  try {
    const res = await fetch("/api/health");
    const data = await res.json();
    el.badgeProvider.textContent = `LLM: ${data.llmProvider}`;
    el.badgeProvider.classList.add("ok");

    if (data.tokenStatus?.connected) {
      const hours = Math.max(0, Math.floor(data.tokenStatus.expiresInMs / 3600000));
      const mins = Math.max(0, Math.floor((data.tokenStatus.expiresInMs % 3600000) / 60000));
      el.badgeToken.textContent = `Token MELI: Activo (${hours}h ${mins}m)`;
      el.badgeToken.classList.add("ok");
    } else {
      el.badgeToken.textContent = `Token MELI: Desconectado`;
      el.badgeToken.classList.remove("ok");
    }

    setAutoAnswerUI(data.autoAnswerEnabled);
  } catch (err) {
    el.badgeProvider.textContent = "LLM: Error";
  }
}

function setAutoAnswerUI(enabled) {
  state.autoAnswerEnabled = enabled;
  el.switchToggle.classList.toggle("on", enabled);
  el.switchState.textContent = enabled ? "ON" : "OFF";
}

async function toggleAutoAnswer() {
  const next = !state.autoAnswerEnabled;
  setAutoAnswerUI(next);
  try {
    await fetch("/api/config/auto-answer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: next }),
    });
  } catch (err) {
    setAutoAnswerUI(!next);
  }
}

// ── Questions & Table Rendering ────────────────────────────────────────

async function loadQuestions() {
  try {
    const res = await fetch("/api/questions");
    const data = await res.json();
    const all = [...(data.pending_review || []), ...(data.auto_answered || []), ...(data.other || [])];
    
    // Sort by received_at desc
    all.sort((a, b) => new Date(b.received_at).getTime() - new Date(a.received_at).getTime());
    state.rawQuestions = all;
    el.badgeTotalQuestions.textContent = `${all.length} preguntas`;
    applyFilters();
  } catch (err) {
    console.error("Error cargando preguntas:", err);
  }
}

function applyFilters() {
  let list = [...state.rawQuestions];

  // Search filter
  if (state.searchTerm) {
    list = list.filter((q) => {
      const text = (q.text || "").toLowerCase();
      const itemId = (q.item_id || "").toLowerCase();
      const answer = (q.final_answer || q.suggested_answer || "").toLowerCase();
      const qId = (q.question_id || "").toLowerCase();
      return text.includes(state.searchTerm) || itemId.includes(state.searchTerm) || answer.includes(state.searchTerm) || qId.includes(state.searchTerm);
    });
  }

  // Status filter
  if (state.statusFilter !== "all") {
    list = list.filter((q) => q.app_status === state.statusFilter);
  }

  // Intent filter
  if (state.intentFilter !== "all") {
    list = list.filter((q) => q.intent === state.intentFilter);
  }

  state.filteredQuestions = list;
  renderQuestionsTable();
}

function renderQuestionsTable() {
  if (state.filteredQuestions.length === 0) {
    el.questionsTbody.innerHTML = `
      <tr>
        <td colspan="4" class="empty-table-msg">
          No se encontraron preguntas con los filtros seleccionados.
        </td>
      </tr>
    `;
    return;
  }

  el.questionsTbody.innerHTML = state.filteredQuestions
    .map((q) => {
      const isSimulated = q.item_id === "SIMULATED" || q.buyer_id === "simulador" || Number(q.question_id) >= 900000000;
      const originBadge = isSimulated
        ? `<span class="q-badge-origin simulated">Simulador</span>`
        : `<span class="q-badge-origin real">MELI Real</span>`;

      const dt = new Date(q.received_at || Date.now());
      const dateStr = dt.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" }) + " " + dt.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });

      const statusLabels = {
        auto_answered: `<span class="status-badge auto_answered">⚡ Auto-respondida</span>`,
        pending_review: `<span class="status-badge pending_review">👤 Pendiente de Revisión</span>`,
        approved: `<span class="status-badge approved">✅ Aprobada por WhatsApp</span>`,
        rejected: `<span class="status-badge rejected">✗ Descartada</span>`,
        error: `<span class="status-badge" style="background:rgba(244,63,94,0.15);color:#fb7185;border:1px solid rgba(244,63,94,0.35);">⚠️ Error</span>`,
      };

      const statusBadge = statusLabels[q.app_status] || `<span class="status-badge">${escapeHtml(q.app_status)}</span>`;
      const intentBadge = q.intent ? `<span class="intent-badge">${escapeHtml(q.intent)}</span>` : "";

      const latencyDisplay = q.latency_ms ? `<span class="q-latency-tag">⚡ ${(q.latency_ms / 1000).toFixed(1)}s</span>` : "";

      let answerHtml = "";
      if (q.app_status === "pending_review") {
        answerHtml = `
          <div class="q-response-wrap">
            <div class="q-answer-text pending">
              <div class="q-suggested-label">💡 Sugerencia IA:</div>
              "${escapeHtml(q.suggested_answer || "Generando respuesta...")}"
            </div>
            <div class="q-actions-inline">
              <button class="btn-inline-approve" onclick="approveFromTable('${q.question_id}')">✓ Aprobar</button>
              <button class="btn-inline-reject" onclick="rejectFromTable('${q.question_id}')">✗ Descartar</button>
            </div>
          </div>
        `;
      } else {
        const text = q.final_answer || q.suggested_answer || "—";
        answerHtml = `
          <div class="q-response-wrap">
            <div class="q-answer-text">
              "${escapeHtml(text)}"
            </div>
            ${latencyDisplay}
          </div>
        `;
      }

      return `
        <tr data-id="${q.question_id}">
          <td>
            <div class="q-id-origin">
              <div style="display:flex; align-items:center; gap:6px;">
                <span class="q-id-code">#${escapeHtml(q.question_id)}</span>
                ${originBadge}
              </div>
              <span class="q-date-text">${dateStr}</span>
              <div class="q-question-bubble">"${escapeHtml(q.text)}"</div>
            </div>
          </td>
          <td>
            <div class="q-item-wrap">
              <span class="q-item-title">${escapeHtml(isSimulated ? "Auriculares Bluetooth Inalámbricos XZ Pro" : q.item_id)}</span>
              <span class="q-item-sub">Comprador: ${escapeHtml(q.buyer_id || "test_buyer")}</span>
            </div>
          </td>
          <td>
            <div class="q-status-wrap">
              ${statusBadge}
              ${intentBadge}
            </div>
          </td>
          <td>
            ${answerHtml}
          </td>
        </tr>
      `;
    })
    .join("");
}

window.approveFromTable = async function (id) {
  try {
    await fetch(`/api/questions/${id}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    await loadQuestions();
  } catch (err) {
    alert("Error al aprobar");
  }
};

window.rejectFromTable = async function (id) {
  try {
    await fetch(`/api/questions/${id}/reject`, { method: "POST" });
    await loadQuestions();
  } catch (err) {
    alert("Error al descartar");
  }
};

// ── Metrics ────────────────────────────────────────────────────────────

async function loadResponseTime() {
  try {
    const res = await fetch("/api/response-time");
    if (!res.ok) return;
    const data = await res.json();
    const total = data.total?.time ?? data.time;
    el.metricTotal.textContent = formatMinutes(total);
    el.metricLabor.textContent = formatMinutes(data.working_hours?.time ?? data.time);
    el.metricOffhours.textContent = formatMinutes(data.non_working_hours?.time);
    el.metricWeekend.textContent = formatMinutes(data.weekend?.time);
  } catch (err) {
    // Keep dashes
  }
}

function formatMinutes(seconds) {
  if (seconds === undefined || seconds === null) return "—";
  const minutes = Math.round(seconds / 60);
  return `${minutes} min`;
}

// ── SSE ────────────────────────────────────────────────────────────────

function connectSSE() {
  const source = new EventSource("/api/events/stream");

  source.addEventListener("open", () => {
    el.badgeSse.textContent = "SSE: Conectado";
    el.badgeSse.classList.add("ok");
  });

  source.addEventListener("event", (e) => {
    const event = JSON.parse(e.data);
    appendConsoleLine(event);
  });

  source.addEventListener("question_updated", () => {
    loadQuestions();
  });

  source.addEventListener("whatsapp_notification", (e) => {
    try {
      const data = JSON.parse(e.data);
      receiveWhatsAppNotification(data);
    } catch (err) {
      console.error(err);
    }
  });

  source.addEventListener("whatsapp_reply_confirmed", () => {
    loadQuestions();
  });

  source.onerror = () => {
    el.badgeSse.textContent = "SSE: Reconectando…";
    el.badgeSse.classList.remove("ok");
  };
}

function appendConsoleLine(event) {
  eventCounter++;
  el.countEvents.textContent = `${eventCounter} eventos`;

  const ts = new Date(event.created_at || Date.now());
  const timeStr = ts.toLocaleTimeString("es-AR", { hour12: false }) + "." + String(ts.getMilliseconds()).padStart(3, "0");
  const durationStr = event.duration_ms !== null && event.duration_ms !== undefined ? ` [${event.duration_ms}ms]` : "";

  const line = document.createElement("div");
  line.className = `console-line type-${event.type}`;
  line.innerHTML = `<span class="ts">[${timeStr}]</span> ${escapeHtml(event.message)}${durationStr}`;
  el.console.appendChild(line);
  el.console.scrollTop = el.console.scrollHeight;

  while (el.console.children.length > 250) {
    el.console.removeChild(el.console.firstChild);
  }
}

// ── WhatsApp Simulator ─────────────────────────────────────────────────

function playNotificationChime() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(800, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.12);

    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.35);
  } catch (e) {}
}

function receiveWhatsAppNotification(data) {
  currentWaQuestion = data;
  playNotificationChime();

  const timeStr = new Date().toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });

  const msgDiv = document.createElement("div");
  msgDiv.className = "wp-msg wp-msg-in";
  msgDiv.innerHTML = `
    <div class="wp-bubble">
      <div class="wp-card-notification">
        <div class="wp-card-header-badge">
          <span>🔔 NUEVA CONSULTA</span>
          <span>⚠️ ${escapeHtml(data.reason || "Revisión requerida")}</span>
        </div>
        <div class="wp-card-item">📦 ${escapeHtml(data.item_title || "Ítem en Mercado Libre")}</div>
        <div class="wp-card-q">"${escapeHtml(data.question_text)}"</div>
        <div class="wp-card-ans">
          <div class="wp-card-ans-title">💡 Sugerencia IA:</div>
          <div>${escapeHtml(data.suggested_answer)}</div>
        </div>
      </div>
      <p style="margin-top: 4px; font-size: 0.76rem;">👉 Respondé <strong>1</strong> para aprobar sugerida o escribí tu texto.</p>
      <span class="wp-time">${timeStr}</span>
    </div>
  `;

  if (el.waChatBody) {
    el.waChatBody.appendChild(msgDiv);
    el.waChatBody.scrollTop = el.waChatBody.scrollHeight;
  }
  if (el.waQuickActions) {
    el.waQuickActions.hidden = false;
  }
  if (el.waInputText) {
    el.waInputText.focus();
  }
}

async function sendWhatsAppReply(text) {
  if (!currentWaQuestion || !text.trim()) return;

  const questionId = currentWaQuestion.question_id;
  const replyText = text.trim();
  const timeStr = new Date().toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });

  const outDiv = document.createElement("div");
  outDiv.className = "wp-msg wp-msg-out";
  outDiv.innerHTML = `
    <div class="wp-bubble">
      <p>${escapeHtml(replyText === "1" ? "1 (Aprobar sugerida)" : replyText)}</p>
      <span class="wp-time">${timeStr} <span class="wp-ticks">✓✓</span></span>
    </div>
  `;
  if (el.waChatBody) {
    el.waChatBody.appendChild(outDiv);
    el.waChatBody.scrollTop = el.waChatBody.scrollHeight;
  }

  if (el.waQuickActions) el.waQuickActions.hidden = true;
  if (el.waInputText) el.waInputText.value = "";

  try {
    const res = await fetch("/api/whatsapp/reply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question_id: questionId, reply_text: replyText }),
    });
    const result = await res.json();
    if (!res.ok) {
      const errDiv = document.createElement("div");
      errDiv.className = "wp-msg wp-msg-in";
      errDiv.innerHTML = `
        <div class="wp-bubble" style="background: #fee2e2; color: #b91c1c;">
          <p>❌ Error: ${escapeHtml(result.error || "No se pudo publicar")}</p>
          <span class="wp-time">${timeStr}</span>
        </div>
      `;
      if (el.waChatBody) el.waChatBody.appendChild(errDiv);
    } else {
      const confirmDiv = document.createElement("div");
      confirmDiv.className = "wp-msg wp-msg-in";
      confirmDiv.innerHTML = `
        <div class="wp-bubble">
          <p>✅ <strong>¡Listo!</strong> Respuesta publicada en Mercado Libre con éxito.</p>
          <div style="font-size: 0.74rem; color: #047857; margin-top: 4px; border-left: 2px solid #10b981; padding-left: 6px;">
            "${escapeHtml(result.question.final_answer)}"
          </div>
          <span class="wp-time">${timeStr}</span>
        </div>
      `;
      if (el.waChatBody) el.waChatBody.appendChild(confirmDiv);
      currentWaQuestion = null;
    }
  } catch (err) {
    console.error(err);
  } finally {
    if (el.waChatBody) el.waChatBody.scrollTop = el.waChatBody.scrollHeight;
  }
}

function resetWhatsAppChat() {
  if (!el.waChatBody) return;
  const timeStr = new Date().toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
  el.waChatBody.innerHTML = `
    <div class="wp-date-divider">HOY</div>
    <div class="wp-msg wp-msg-in">
      <div class="wp-bubble">
        <p>👋 ¡Hola! Soy tu <strong>Asistente IA de Mercado Libre</strong>.</p>
        <p>Cuando una pregunta pre-venta de tus publicaciones requiera tu decisión (descuentos, stock no listado o casos sensibles), te voy a avisar por acá con la respuesta sugerida.</p>
        <span class="wp-time">${timeStr}</span>
      </div>
    </div>
  `;
  if (el.waQuickActions) el.waQuickActions.hidden = true;
  currentWaQuestion = null;
}

// ── Simulator ──────────────────────────────────────────────────────────

const PRESETS = {
  stock: "Hola, tenés stock para retirar hoy?",
  descuento: "Hola, me hacés un 15% de descuento si compro 5 unidades?",
  contacto: "Pasame tu celular o whatsapp así coordinamos por afuera",
  tecnica: "Hola, es resistente al agua? Se puede usar para nadar?",
};

function applyPreset(key) {
  el.simulatorText.value = PRESETS[key] || "";
}

async function sendSimulation() {
  const text = el.simulatorText.value.trim();
  if (!text) return;

  el.simulatorBackdrop.hidden = true;
  el.simulatorText.value = "";

  try {
    await fetch("/api/simulate-question", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
  } catch (err) {
    alert("Error al enviar la pregunta simulada.");
  }
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
