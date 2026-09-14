const state = {
  rawQuestions: [],
  filteredQuestions: [],
  rawClaims: [],
  filteredClaims: [],
  activeSection: "presale", // 'presale' | 'postsale'
  lastEventId: 0,
  autoAnswerEnabled: true,
  operatingMode: null,
  currentView: "duo",
  searchTerm: "",
  statusFilter: "all",
  intentFilter: "all",
  claimSearchTerm: "",
  claimUrgencyFilter: "all",
  claimTypeFilter: "all",
  consoleVisible: true,
};

const el = {
  mainContainer: document.getElementById("main-container"),
  tabButtons: document.querySelectorAll(".tab-btn"),
  badgeProvider: document.getElementById("badge-provider"),
  badgeToken: document.getElementById("badge-token"),
  badgeSse: document.getElementById("badge-sse"),
  badgeTotalQuestions: document.getElementById("badge-total-questions"),
  
  // Subnav Pre-Venta vs Post-Venta
  subtabPresale: document.getElementById("subtab-presale"),
  subtabPostsale: document.getElementById("subtab-postsale"),
  sectionPresale: document.getElementById("section-presale"),
  sectionPostsale: document.getElementById("section-postsale"),
  badgeTotalQuestionsPill: document.getElementById("badge-total-questions-pill"),
  badgeClaimsUrgentPill: document.getElementById("badge-claims-urgent-pill"),

  // Mode & Schedule Controls
  selectOpMode: document.getElementById("select-op-mode"),
  modeStatusBadge: document.getElementById("mode-status-badge"),
  btnOpenSchedule: document.getElementById("btn-open-schedule"),
  scheduleBackdrop: document.getElementById("schedule-backdrop"),
  btnCloseSchedule: document.getElementById("btn-close-schedule"),
  btnCancelSchedule: document.getElementById("btn-cancel-schedule"),
  btnSaveSchedule: document.getElementById("btn-save-schedule"),
  scheduleStartTime: document.getElementById("schedule-start-time"),
  scheduleEndTime: document.getElementById("schedule-end-time"),
  schedulePreviewText: document.getElementById("schedule-preview-text"),

  // Confirm Mode Modal Elements
  confirmModeBackdrop: document.getElementById("confirm-mode-backdrop"),
  confirmModeTitle: document.getElementById("confirm-mode-title"),
  confirmModeHeading: document.getElementById("confirm-mode-heading"),
  confirmModeDesc: document.getElementById("confirm-mode-desc"),
  confirmModeIcon: document.getElementById("confirm-mode-icon"),
  confirmModeDetails: document.getElementById("confirm-mode-details"),
  btnConfirmModeAction: document.getElementById("btn-confirm-mode-action"),
  btnCancelConfirmMode: document.getElementById("btn-cancel-confirm-mode"),
  btnCloseConfirmMode: document.getElementById("btn-close-confirm-mode"),

  btnRefresh: document.getElementById("btn-refresh"),
  btnOpenSimulator: document.getElementById("btn-open-simulator"),
  btnCloseSimulator: document.getElementById("btn-close-simulator"),
  simulatorBackdrop: document.getElementById("simulator-backdrop"),
  simulatorText: document.getElementById("simulator-text"),
  btnSendSimulation: document.getElementById("btn-send-simulation"),
  quickButtons: document.querySelectorAll(".quick-btn[data-preset]"),

  // Claim Simulator Modal Elements
  btnOpenClaimSimulator: document.getElementById("btn-open-claim-simulator"),
  btnCloseClaimSimulator: document.getElementById("btn-close-claim-simulator"),
  claimSimulatorBackdrop: document.getElementById("claim-simulator-backdrop"),
  btnSendClaimSimulation: document.getElementById("btn-send-claim-simulation"),
  simClaimType: document.getElementById("sim-claim-type"),
  simClaimReason: document.getElementById("sim-claim-reason"),
  simClaimHours: document.getElementById("sim-claim-hours"),
  claimQuickButtons: document.querySelectorAll(".quick-btn[data-claim-preset]"),
  
  // WhatsApp Elements
  waChatBody: document.getElementById("wa-chat-body"),
  waQuickActions: document.getElementById("wa-quick-actions"),
  waBtnApprove1: document.getElementById("wa-btn-approve-1"),
  waBtnEdit: document.getElementById("wa-btn-edit"),
  waForm: document.getElementById("wa-form"),
  waInputText: document.getElementById("wa-input-text"),
  waWelcomeTime: document.getElementById("wa-welcome-time"),
  btnResetChat: document.getElementById("btn-reset-chat"),

  // Table & Filters — Pre-Venta
  searchInput: document.getElementById("search-input"),
  filterStatus: document.getElementById("filter-status"),
  filterIntent: document.getElementById("filter-intent"),
  questionsTbody: document.getElementById("questions-tbody"),

  // Table & Filters — Post-Venta (Claims)
  searchClaimsInput: document.getElementById("search-claims-input"),
  filterClaimUrgency: document.getElementById("filter-claim-urgency"),
  filterClaimType: document.getElementById("filter-claim-type"),
  claimsTbody: document.getElementById("claims-tbody"),
  metricClaimsTotal: document.getElementById("metric-claims-total"),
  metricClaimsCritical: document.getElementById("metric-claims-critical"),
  metricClaimsHigh: document.getElementById("metric-claims-high"),
  metricClaimsNormal: document.getElementById("metric-claims-normal"),

  // Metrics Pre-Venta
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

  // Subnav Pre-Venta vs Post-Venta
  if (el.subtabPresale) {
    el.subtabPresale.addEventListener("click", () => switchManagementSection("presale"));
  }
  if (el.subtabPostsale) {
    el.subtabPostsale.addEventListener("click", () => switchManagementSection("postsale"));
  }

  await loadHealth();
  await loadOperationMode();
  await loadQuestions();
  await loadClaims();
  await loadResponseTime();
  connectSSE();

  // Mode Selector with Confirmation Modal
  if (el.selectOpMode) {
    el.selectOpMode.addEventListener("change", (e) => promptModeConfirmation(e.target.value));
  }
  if (el.btnConfirmModeAction) {
    el.btnConfirmModeAction.addEventListener("click", confirmModeChange);
  }
  if (el.btnCancelConfirmMode) {
    el.btnCancelConfirmMode.addEventListener("click", cancelModeConfirmation);
  }
  if (el.btnCloseConfirmMode) {
    el.btnCloseConfirmMode.addEventListener("click", cancelModeConfirmation);
  }
  if (el.confirmModeBackdrop) {
    el.confirmModeBackdrop.addEventListener("click", (e) => {
      if (e.target === el.confirmModeBackdrop) cancelModeConfirmation();
    });
  }

  if (el.btnOpenSchedule) {
    el.btnOpenSchedule.addEventListener("click", openScheduleModal);
  }
  if (el.btnCloseSchedule) {
    el.btnCloseSchedule.addEventListener("click", () => (el.scheduleBackdrop.hidden = true));
  }
  if (el.btnCancelSchedule) {
    el.btnCancelSchedule.addEventListener("click", () => (el.scheduleBackdrop.hidden = true));
  }
  if (el.scheduleBackdrop) {
    el.scheduleBackdrop.addEventListener("click", (e) => {
      if (e.target === el.scheduleBackdrop) el.scheduleBackdrop.hidden = true;
    });
  }
  if (el.btnSaveSchedule) {
    el.btnSaveSchedule.addEventListener("click", saveScheduleConfig);
  }

  // Simulator Modal — Questions
  el.btnOpenSimulator.addEventListener("click", () => (el.simulatorBackdrop.hidden = false));
  el.btnCloseSimulator.addEventListener("click", () => (el.simulatorBackdrop.hidden = true));
  el.simulatorBackdrop.addEventListener("click", (e) => {
    if (e.target === el.simulatorBackdrop) el.simulatorBackdrop.hidden = true;
  });
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (!el.simulatorBackdrop.hidden) el.simulatorBackdrop.hidden = true;
      if (el.claimSimulatorBackdrop && !el.claimSimulatorBackdrop.hidden) el.claimSimulatorBackdrop.hidden = true;
      if (el.scheduleBackdrop && !el.scheduleBackdrop.hidden) el.scheduleBackdrop.hidden = true;
      if (el.confirmModeBackdrop && !el.confirmModeBackdrop.hidden) cancelModeConfirmation();
    }
  });
  el.btnSendSimulation.addEventListener("click", sendSimulation);
  el.quickButtons.forEach((btn) => btn.addEventListener("click", () => applyPreset(btn.dataset.preset)));

  // Claim Simulator Modal — Post-Venta
  if (el.btnOpenClaimSimulator) {
    el.btnOpenClaimSimulator.addEventListener("click", () => (el.claimSimulatorBackdrop.hidden = false));
  }
  if (el.btnCloseClaimSimulator) {
    el.btnCloseClaimSimulator.addEventListener("click", () => (el.claimSimulatorBackdrop.hidden = true));
  }
  if (el.claimSimulatorBackdrop) {
    el.claimSimulatorBackdrop.addEventListener("click", (e) => {
      if (e.target === el.claimSimulatorBackdrop) el.claimSimulatorBackdrop.hidden = true;
    });
  }
  if (el.btnSendClaimSimulation) {
    el.btnSendClaimSimulation.addEventListener("click", sendClaimSimulation);
  }
  el.claimQuickButtons.forEach((btn) => {
    btn.addEventListener("click", () => applyClaimPreset(btn.dataset.claimPreset));
  });

  // Refresh Button
  if (el.btnRefresh) {
    el.btnRefresh.addEventListener("click", async () => {
      el.btnRefresh.style.transform = "rotate(360deg)";
      el.btnRefresh.style.transition = "transform 0.5s ease";
      await loadQuestions();
      await loadClaims();
      await loadResponseTime();
      setTimeout(() => {
        el.btnRefresh.style.transform = "none";
        el.btnRefresh.style.transition = "none";
      }, 500);
    });
  }

  // Search & Filters — Pre-Venta
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

  // Search & Filters — Post-Venta (Claims)
  if (el.searchClaimsInput) {
    el.searchClaimsInput.addEventListener("input", (e) => {
      state.claimSearchTerm = e.target.value.toLowerCase().trim();
      applyClaimFilters();
    });
  }
  if (el.filterClaimUrgency) {
    el.filterClaimUrgency.addEventListener("change", (e) => {
      state.claimUrgencyFilter = e.target.value;
      applyClaimFilters();
    });
  }
  if (el.filterClaimType) {
    el.filterClaimType.addEventListener("change", (e) => {
      state.claimTypeFilter = e.target.value;
      applyClaimFilters();
    });
  }

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
      if (data.tokenStatus.isSeller === false) {
        el.badgeToken.textContent = `⚠️ Token: ${data.tokenStatus.nickname || data.tokenStatus.userId} (No es Vendedor)`;
        el.badgeToken.style.background = "rgba(245, 158, 11, 0.15)";
        el.badgeToken.style.color = "#fbbf24";
        el.badgeToken.style.borderColor = "rgba(245, 158, 11, 0.4)";
        el.badgeToken.style.cursor = "pointer";
        el.badgeToken.title = `El token conectado (${data.tokenStatus.userId}) no coincide con el Vendedor (${data.tokenStatus.expectedSellerId}). Hacé clic acá para conectar con el vendedor de test.`;
        el.badgeToken.onclick = () => window.open("/oauth/login", "_blank");
      } else {
        el.badgeToken.textContent = `Token MELI: Vendedor (${hours}h ${mins}m)`;
        el.badgeToken.classList.add("ok");
        el.badgeToken.style.background = "";
        el.badgeToken.style.color = "";
        el.badgeToken.style.borderColor = "";
        el.badgeToken.style.cursor = "default";
        el.badgeToken.title = `Conectado como vendedor oficial: ${data.tokenStatus.nickname || data.tokenStatus.userId}`;
        el.badgeToken.onclick = null;
      }
    } else {
      el.badgeToken.textContent = `Token MELI: Desconectado`;
      el.badgeToken.classList.remove("ok");
      el.badgeToken.style.background = "rgba(244, 63, 94, 0.15)";
      el.badgeToken.style.color = "#fb7185";
      el.badgeToken.style.borderColor = "rgba(244, 63, 94, 0.4)";
      el.badgeToken.style.cursor = "pointer";
      el.badgeToken.title = "Hacé clic para conectar con Mercado Libre";
      el.badgeToken.onclick = () => window.open("/oauth/login", "_blank");
    }

    if (data.operatingMode) {
      updateOperatingModeUI(data.operatingMode);
    }
  } catch (err) {
    el.badgeProvider.textContent = "LLM: Error";
  }
}

// ── Operating Mode & Schedule Config ───────────────────────────────────

async function loadOperationMode() {
  try {
    const res = await fetch("/api/config/operating-mode");
    const data = await res.json();
    updateOperatingModeUI(data);
  } catch (err) {
    console.error("Error cargando modo de operación:", err);
  }
}

function updateOperatingModeUI(data) {
  if (!data) return;
  state.operatingMode = data;
  state.autoAnswerEnabled = data.isAutoAnswer;

  if (el.selectOpMode) {
    el.selectOpMode.value = data.mode;
  }

  if (el.modeStatusBadge) {
    el.modeStatusBadge.textContent = data.statusLabel;
    el.modeStatusBadge.className = "mode-badge";
    if (data.mode === "auto") {
      el.modeStatusBadge.classList.add("badge-auto");
    } else if (data.mode === "manual") {
      el.modeStatusBadge.classList.add("badge-manual");
    } else {
      el.modeStatusBadge.classList.add(data.isWithinBusinessHours ? "badge-schedule-day" : "badge-schedule-night");
    }
  }

  // Sincronizar campos del modal si existen
  if (data.schedule) {
    if (el.scheduleStartTime) el.scheduleStartTime.value = data.schedule.start_time || "09:00";
    if (el.scheduleEndTime) el.scheduleEndTime.value = data.schedule.end_time || "18:00";
    const dayCheckboxes = document.querySelectorAll('input[name="sched-day"]');
    dayCheckboxes.forEach((cb) => {
      cb.checked = (data.schedule.days || []).includes(Number(cb.value));
    });
  }
}

let pendingModeChange = null;

const MODE_DEFINITIONS = {
  auto: {
    title: "🤖 Activar Modo 100% Automático",
    heading: "¿Cambiar a Modo 100% Automático?",
    icon: "🤖",
    theme: "theme-auto",
    desc: "La Inteligencia Artificial responderá y publicará de forma inmediata y autónoma todas las consultas en Mercado Libre.",
    details: [
      { icon: "⚡", text: "<strong>Respuestas en segundos:</strong> Publicación directa 24/7 sin intervención humana." },
      { icon: "🔇", text: "<strong>WhatsApp en silencio:</strong> No se envían tarjetas de aprobación a WhatsApp." },
      { icon: "🛡️", text: "<strong>Moderación de seguridad:</strong> Cada respuesta pasa por filtros determinísticos antes de enviarse." },
    ],
    confirmBtnText: "Sí, activar 100% Automático",
  },
  manual: {
    title: "👤 Activar Modo 100% Supervisado",
    heading: "¿Cambiar a Modo 100% Supervisado?",
    icon: "👤",
    theme: "theme-manual",
    desc: "Cada consulta entrante generará una sugerencia de IA y quedará pausada hasta que la apruebes o corrijas.",
    details: [
      { icon: "📲", text: "<strong>Notificación en WhatsApp & Panel:</strong> Recibís la consulta con la sugerencia lista para aprobar." },
      { icon: "✍️", text: "<strong>Control y edición:</strong> Podés responder '1' para publicar o mandar tu propio texto/ajuste." },
      { icon: "🔒", text: "<strong>Cero publicaciones no autorizadas:</strong> Nada se publica sin tu visto bueno." },
    ],
    confirmBtnText: "Sí, activar 100% Supervisado",
  },
  schedule: {
    title: "⏰ Activar Modo Horario Inteligente",
    heading: "¿Cambiar a Horario Inteligente?",
    icon: "⏰",
    theme: "theme-schedule",
    desc: "El sistema alternará de forma autónoma según tus horarios de atención laboral y descanso.",
    details: [
      { icon: "💼", text: "<strong>Horario laboral:</strong> Modo Supervisado (aprobaciones por WhatsApp / Panel)." },
      { icon: "🌙", text: "<strong>Noches y fines de semana:</strong> Modo 100% Automático para mantener tus ventas activas." },
      { icon: "⚙️", text: "<strong>Personalizable:</strong> Podés ajustar los días y franjas horarias con el botón '⚙️ Horarios'." },
    ],
    confirmBtnText: "Sí, activar Horario Inteligente",
  },
};

function promptModeConfirmation(targetMode) {
  const currentMode = state.operatingMode?.mode || "schedule";
  if (targetMode === currentMode) return;

  const info = MODE_DEFINITIONS[targetMode];
  if (!info) {
    changeOperationMode(targetMode);
    return;
  }

  pendingModeChange = targetMode;

  // Revert select visual to current mode while confirmation modal is open
  if (el.selectOpMode) {
    el.selectOpMode.value = currentMode;
  }

  // Populate modal
  if (el.confirmModeTitle) el.confirmModeTitle.textContent = info.title;
  if (el.confirmModeHeading) el.confirmModeHeading.textContent = info.heading;
  if (el.confirmModeDesc) el.confirmModeDesc.textContent = info.desc;
  if (el.confirmModeIcon) {
    el.confirmModeIcon.textContent = info.icon;
    el.confirmModeIcon.className = `confirm-mode-icon-circle ${info.theme}`;
  }
  if (el.btnConfirmModeAction) {
    el.btnConfirmModeAction.textContent = info.confirmBtnText;
    el.btnConfirmModeAction.className = `btn-send btn-confirm-mode-action ${info.theme}`;
  }

  if (el.confirmModeDetails) {
    el.confirmModeDetails.innerHTML = info.details
      .map((d) => `<div class="confirm-mode-detail-item"><span class="icon">${d.icon}</span><span>${d.text}</span></div>`)
      .join("");
  }

  if (el.confirmModeBackdrop) {
    el.confirmModeBackdrop.hidden = false;
  }
}

function cancelModeConfirmation() {
  pendingModeChange = null;
  if (el.confirmModeBackdrop) el.confirmModeBackdrop.hidden = true;
  if (el.selectOpMode && state.operatingMode?.mode) {
    el.selectOpMode.value = state.operatingMode.mode;
  }
}

async function confirmModeChange() {
  const modeToApply = pendingModeChange;
  cancelModeConfirmation();
  if (modeToApply) {
    await changeOperationMode(modeToApply);
  }
}

async function changeOperationMode(newMode) {
  try {
    const res = await fetch("/api/config/operating-mode", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: newMode }),
    });
    const data = await res.json();
    updateOperatingModeUI(data);
  } catch (err) {
    console.error("Error cambiando modo:", err);
  }
}

function openScheduleModal() {
  if (el.scheduleBackdrop) el.scheduleBackdrop.hidden = false;
  if (state.operatingMode) {
    updateOperatingModeUI(state.operatingMode);
  }
}

async function saveScheduleConfig() {
  const dayCheckboxes = document.querySelectorAll('input[name="sched-day"]:checked');
  const selectedDays = Array.from(dayCheckboxes).map((cb) => Number(cb.value));
  const startTime = el.scheduleStartTime?.value || "09:00";
  const endTime = el.scheduleEndTime?.value || "18:00";

  const schedule = {
    days: selectedDays,
    start_time: startTime,
    end_time: endTime,
    timezone: "America/Argentina/Buenos_Aires",
  };

  try {
    const res = await fetch("/api/config/operating-mode", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: el.selectOpMode?.value || "schedule", schedule }),
    });
    const data = await res.json();
    updateOperatingModeUI(data);
    if (el.scheduleBackdrop) el.scheduleBackdrop.hidden = true;
  } catch (err) {
    alert("Error al guardar la configuración de horarios");
  }
}

// ── Sub-section Switcher (Pre-Venta vs Post-Venta) ──────────────────────

function switchManagementSection(section) {
  state.activeSection = section;
  if (el.subtabPresale) el.subtabPresale.classList.toggle("active", section === "presale");
  if (el.subtabPostsale) el.subtabPostsale.classList.toggle("active", section === "postsale");
  if (el.sectionPresale) el.sectionPresale.style.display = section === "presale" ? "block" : "none";
  if (el.sectionPostsale) el.sectionPostsale.style.display = section === "postsale" ? "block" : "none";
}

// ── Claims & SLA Rendering (Post-Venta) ─────────────────────────────────

async function loadClaims() {
  try {
    const res = await fetch("/api/claims");
    if (!res.ok) return;
    const data = await res.json();
    state.rawClaims = data.claims || [];

    // Update subnav pills
    if (el.badgeClaimsUrgentPill) {
      const urgentCount = state.rawClaims.filter((c) => c.status === "opened" && (c.urgency === "critical" || c.urgency === "high")).length;
      el.badgeClaimsUrgentPill.textContent = urgentCount > 0 ? `${urgentCount} URGENTES` : `${state.rawClaims.length}`;
      el.badgeClaimsUrgentPill.classList.toggle("subnav-pill-urgent", urgentCount > 0);
    }

    // Update Metrics
    if (data.metrics) {
      if (el.metricClaimsTotal) el.metricClaimsTotal.textContent = data.metrics.total;
      if (el.metricClaimsCritical) el.metricClaimsCritical.textContent = data.metrics.critical;
      if (el.metricClaimsHigh) el.metricClaimsHigh.textContent = data.metrics.high;
      if (el.metricClaimsNormal) el.metricClaimsNormal.textContent = data.metrics.normal;
    }

    applyClaimFilters();
  } catch (err) {
    console.error("Error cargando reclamos:", err);
  }
}

function applyClaimFilters() {
  let list = [...state.rawClaims];

  if (state.claimSearchTerm) {
    list = list.filter((c) => {
      const id = (c.id || "").toLowerCase();
      const order = (c.orderId || "").toLowerCase();
      const reason = (c.reason || "").toLowerCase();
      const buyer = (c.buyerId || "").toLowerCase();
      return id.includes(state.claimSearchTerm) || order.includes(state.claimSearchTerm) || reason.includes(state.claimSearchTerm) || buyer.includes(state.claimSearchTerm);
    });
  }

  if (state.claimUrgencyFilter !== "all") {
    if (state.claimUrgencyFilter === "closed") {
      list = list.filter((c) => c.status === "closed");
    } else {
      list = list.filter((c) => c.urgency === state.claimUrgencyFilter && c.status === "opened");
    }
  }

  if (state.claimTypeFilter !== "all") {
    list = list.filter((c) => c.type === state.claimTypeFilter);
  }

  state.filteredClaims = list;
  renderClaimsTable();
}

function renderClaimsTable() {
  if (!el.claimsTbody) return;

  if (state.filteredClaims.length === 0) {
    el.claimsTbody.innerHTML = `
      <tr>
        <td colspan="4" class="empty-table-msg">
          No hay reclamos registrados con los filtros seleccionados.
        </td>
      </tr>
    `;
    return;
  }

  el.claimsTbody.innerHTML = state.filteredClaims
    .map((c) => {
      const dt = parseSqliteDate(c.createdAt);
      const dateStr = dt.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" }) + " " + dt.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
      
      const typeLabels = {
        med_pdd: `<span class="intent-badge" style="color:#f87171; border-color:rgba(239,68,68,0.3);">🔧 PDD Defectuoso</span>`,
        med_pnr: `<span class="intent-badge" style="color:#fb923c; border-color:rgba(249,115,22,0.3);">📦 PNR No Recibido</span>`,
        return: `<span class="intent-badge" style="color:#38bdf8; border-color:rgba(56,189,248,0.3);">🔄 Devolución</span>`,
        cancel_purchase: `<span class="intent-badge" style="color:#94a3b8; border-color:rgba(148,163,184,0.3);">❌ Cancelación</span>`,
        other: `<span class="intent-badge">⚖️ Reclamo</span>`,
      };
      const typeBadge = typeLabels[c.type] || `<span class="intent-badge">${escapeHtml(c.type)}</span>`;

      const urgencyLabels = {
        critical: `<span class="urgency-chip critical">🔴 Crítico (&lt; 12hs)</span>`,
        high: `<span class="urgency-chip high">🟠 Alta Prioridad</span>`,
        normal: `<span class="urgency-chip normal">🟢 En Plazo</span>`,
        closed: `<span class="urgency-chip closed">⚪ Resuelto</span>`,
      };
      const urgencyChip = urgencyLabels[c.urgency] || urgencyLabels.normal;

      // SLA Progress Bar Calculation (0 to 48 hours baseline)
      const maxHours = 48;
      const progressPercent = Math.min(100, Math.max(8, (c.remainingHours / maxHours) * 100));

      const actionsHtml = (c.actions || []).map((a) => {
        return `<span style="font-size:0.68rem; color:#94a3b8; background:rgba(255,255,255,0.05); padding:2px 6px; border-radius:4px;">⚡ ${escapeHtml(a.action)}</span>`;
      }).join(" ");

      return `
        <tr data-claim-id="${c.id}">
          <td>
            <div class="q-id-origin">
              <div style="display:flex; align-items:center; gap:6px;">
                <span class="q-id-code">#${escapeHtml(c.id)}</span>
                <span class="q-badge-origin real">Orden #${escapeHtml(c.orderId)}</span>
              </div>
              <span class="q-date-text">Iniciado: ${dateStr}</span>
              <div class="q-item-sub" style="margin-top:4px;">Comprador ID: <strong>${escapeHtml(c.buyerId || "3677130936")}</strong></div>
            </div>
          </td>
          <td>
            <div class="q-item-wrap">
              ${typeBadge}
              <div class="q-question-bubble" style="font-size:0.78rem; font-weight:600; color:#e2e8f0; margin-top:4px;">
                "${escapeHtml(c.reason)}"
              </div>
              <div style="margin-top:4px; display:flex; flex-wrap:wrap; gap:4px;">
                ${actionsHtml}
              </div>
            </div>
          </td>
          <td>
            <div style="display:flex; flex-direction:column; gap:4px;">
              <div style="display:flex; justify-content:space-between; align-items:center;">
                ${urgencyChip}
                <strong style="font-size:0.8rem; font-family:'JetBrains Mono',monospace; color:${c.urgency === 'critical' ? '#ef4444' : c.urgency === 'high' ? '#f97316' : '#10b981'};">
                  ${c.remainingHours} hs restantes
                </strong>
              </div>
              <div class="sla-progress-wrap">
                <div class="sla-progress-bar">
                  <div class="sla-progress-fill ${c.urgency}" style="width: ${progressPercent}%;"></div>
                </div>
              </div>
              <span class="q-date-text" style="margin-top:2px;">Vence: ${new Date(c.dueDate).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
            </div>
          </td>
          <td>
            <div style="display:flex; flex-direction:column; gap:6px;">
              <div style="display:flex; align-items:center; gap:6px;">
                <button class="btn-claim-ack" onclick="acknowledgeClaim('${c.id}')" title="Marcar como visto / notificado">
                  ✓ Enterado
                </button>
                <a href="https://www.mercadolibre.com.ar" target="_blank" class="btn-claim-view" title="Abrir en Mercado Libre">
                  🔗 Ver Caso
                </a>
              </div>
              <div class="q-date-text" style="font-size:0.65rem; color:#64748b;">
                ${c.notifiedAt ? `📲 Notificado por WhatsApp` : `⏳ Notificación en cola`}
              </div>
            </div>
          </td>
        </tr>
      `;
    })
    .join("");
}

window.acknowledgeClaim = async function(claimId) {
  try {
    await fetch(`/api/claims/${claimId}/ack`, { method: "POST" });
    await loadClaims();
  } catch (err) {
    console.error("Error confirmando reclamo:", err);
  }
};

// ── Questions & Table Rendering (Pre-Venta) ────────────────────────────

async function loadQuestions() {
  try {
    const res = await fetch("/api/questions");
    const data = await res.json();
    const all = [...(data.pending_review || []), ...(data.auto_answered || []), ...(data.other || [])];

    // Sort by received_at desc
    all.sort((a, b) => parseSqliteDate(b.received_at).getTime() - parseSqliteDate(a.received_at).getTime());
    state.rawQuestions = all;
    if (el.badgeTotalQuestions) el.badgeTotalQuestions.textContent = `${all.length} preguntas`;
    if (el.badgeTotalQuestionsPill) el.badgeTotalQuestionsPill.textContent = all.length;
    applyFilters();

    // Auto-populate WA chat if there's a pending_review question and the chat is idle
    const pending = (data.pending_review || []).sort(
      (a, b) => parseSqliteDate(b.received_at).getTime() - parseSqliteDate(a.received_at).getTime()
    );
    if (!currentWaQuestion && pending.length > 0) {
      const q = pending[0];
      receiveWhatsAppNotification({
        question_id: q.question_id,
        question_text: q.text,
        suggested_answer: q.suggested_answer,
        reason: q.reason,
        item_title: q.item_id,
        intent: q.intent,
      });
    }
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
      const isSimulated = q.item_id === "SIMULATED" || q.buyer_id === "simulador";
      const originBadge = isSimulated
        ? `<span class="q-badge-origin simulated">Simulador</span>`
        : `<span class="q-badge-origin real">MELI Real</span>`;

      const dt = parseSqliteDate(q.received_at);
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

      const latencyDisplay = (q.latency_ms && q.latency_ms > 0)
        ? `<span class="q-latency-tag">⚡ ${(q.latency_ms / 1000).toFixed(1)}s</span>`
        : "";

      let answerHtml = "";
      if (q.app_status === "pending_review") {
        answerHtml = `
          <div class="q-response-wrap">
            <div class="q-answer-text pending">
              <div class="q-suggested-label">💡 Sugerencia IA:</div>
              "${escapeHtml(q.suggested_answer || "Generando respuesta...")}"
            </div>
            <div class="q-actions-inline">
              <button class="btn-inline-approve" onclick="approveFromTable('${q.question_id}')" title="Aprobar y publicar en Mercado Libre">✓ Aprobar</button>
              <button class="btn-inline-chat" onclick="openInWhatsApp('${q.question_id}')" title="Cargar y chatear en WhatsApp">💬 Chatear</button>
              <button class="btn-inline-reject" onclick="rejectFromTable('${q.question_id}')" title="Descartar respuesta">✗ Descartar</button>
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

window.openInWhatsApp = function (id) {
  const q = state.rawQuestions.find((item) => String(item.question_id) === String(id));
  if (!q) return;

  const isSimulated = q.item_id === "SIMULATED" || q.buyer_id === "simulador";
  receiveWhatsAppNotification({
    question_id: q.question_id,
    item_title: isSimulated ? "Auriculares Bluetooth Inalámbricos XZ Pro" : q.item_id,
    question_text: q.text,
    suggested_answer: q.suggested_answer || "¡Hola! ¿En qué te podemos ayudar?",
    reason: q.reason || "Revisión manual seleccionada",
  });
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

  source.addEventListener("claim_received", (e) => {
    try {
      const data = JSON.parse(e.data);
      loadClaims();
      renderWhatsAppClaimAlert(data);
    } catch (err) {
      console.error("Error processing claim_received SSE:", err);
    }
  });

  source.addEventListener("claim_updated", () => {
    loadClaims();
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

  source.addEventListener("config_updated", (e) => {
    try {
      const data = JSON.parse(e.data);
      updateOperatingModeUI(data);
    } catch (err) {}
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
  if (!text.trim()) return;

  const questionId = currentWaQuestion ? currentWaQuestion.question_id : null;
  const replyText = text.trim();
  const timeStr = new Date().toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });

  const outDiv = document.createElement("div");
  outDiv.className = "wp-msg wp-msg-out";
  outDiv.innerHTML = `
    <div class="wp-bubble">
      <p>${escapeHtml(replyText === "1" && currentWaQuestion ? "1 (Aprobar sugerida)" : replyText)}</p>
      <span class="wp-time">${timeStr} <span class="wp-ticks">✓✓</span></span>
    </div>
  `;
  if (el.waChatBody) {
    el.waChatBody.appendChild(outDiv);
    el.waChatBody.scrollTop = el.waChatBody.scrollHeight;
  }

  if (el.waInputText) el.waInputText.value = "";

  // No active question — show helpful message instead of hitting the API
  if (!questionId) {
    const noQDiv = document.createElement("div");
    noQDiv.className = "wp-msg wp-msg-in";
    noQDiv.innerHTML = `
      <div class="wp-bubble">
        <p>No hay preguntas pendientes de revisión en este momento. Cuando llegue una nueva pregunta que requiera tu aprobación, te aviso por acá 👆</p>
        <span class="wp-time">${timeStr}</span>
      </div>
    `;
    if (el.waChatBody) {
      el.waChatBody.appendChild(noQDiv);
      el.waChatBody.scrollTop = el.waChatBody.scrollHeight;
    }
    return;
  }

  if (el.waQuickActions) el.waQuickActions.hidden = true;

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
          <p>❌ Error: ${escapeHtml(result.error || "No se pudo procesar")}</p>
          <span class="wp-time">${timeStr}</span>
        </div>
      `;
      if (el.waChatBody) el.waChatBody.appendChild(errDiv);
    } else if (result.action === "list_empty") {
      const listDiv = document.createElement("div");
      listDiv.className = "wp-msg wp-msg-in";
      listDiv.innerHTML = `
        <div class="wp-bubble">
          <p>${escapeHtml(result.message || "✨ No hay preguntas pendientes.")}</p>
          <span class="wp-time">${timeStr}</span>
        </div>
      `;
      if (el.waChatBody) el.waChatBody.appendChild(listDiv);
    } else if (result.action === "list_pending") {
      const listDiv = document.createElement("div");
      listDiv.className = "wp-msg wp-msg-in";

      let itemsHtml = "";
      result.questions.forEach((q, idx) => {
        const num = idx + 1;
        itemsHtml += `
          <div style="margin-top: 8px; padding: 8px; background: rgba(0,0,0,0.04); border-radius: 6px; border-left: 3px solid #3b82f6;">
            <div style="font-weight: 700; font-size: 0.78rem; color: #1e293b;">#${num} - "${escapeHtml(q.text)}"</div>
            <div style="font-size: 0.72rem; color: #64748b; margin-top: 2px;">💡 Sugerencia: "${escapeHtml(q.suggested_answer || "—")}"</div>
            <button class="btn-inline-chat" style="margin-top: 6px; font-size: 0.7rem; padding: 3px 8px;" onclick="openInWhatsApp('${q.question_id}')">
              👉 Atender #${num} en WhatsApp
            </button>
          </div>
        `;
      });

      listDiv.innerHTML = `
        <div class="wp-bubble">
          <p>📋 <strong>Tenés ${result.count} preguntas pendientes de revisión:</strong></p>
          ${itemsHtml}
          <p style="margin-top: 6px; font-size: 0.74rem; color: #64748b;">Hacé clic en <strong>Atender</strong> en la que quieras revisar o responder.</p>
          <span class="wp-time">${timeStr}</span>
        </div>
      `;
      if (el.waChatBody) el.waChatBody.appendChild(listDiv);
    } else if (result.action === "selected_question") {
      currentWaQuestion = result.question;
      const selectDiv = document.createElement("div");
      selectDiv.className = "wp-msg wp-msg-in";
      selectDiv.innerHTML = `
        <div class="wp-bubble">
          <p>📌 <strong>Seleccionaste la consulta #${result.index}:</strong></p>
          <div class="wp-card-notification" style="margin-top: 6px;">
            <div class="wp-card-item">📦 ${escapeHtml(result.question.item_id === "SIMULATED" ? "Auriculares Bluetooth" : result.question.item_id)}</div>
            <div class="wp-card-q">"${escapeHtml(result.question.text)}"</div>
            <div class="wp-card-ans">
              <div class="wp-card-ans-title">💡 Sugerencia IA:</div>
              <div>${escapeHtml(result.question.suggested_answer)}</div>
            </div>
          </div>
          <p style="margin-top: 4px; font-size: 0.76rem;">👉 Respondé <strong>1</strong> para aprobar o escribí tu corrección.</p>
          <span class="wp-time">${timeStr}</span>
        </div>
      `;
      if (el.waChatBody) el.waChatBody.appendChild(selectDiv);
      if (el.waQuickActions) el.waQuickActions.hidden = false;
    } else if (result.action === "refined") {
      const refineDiv = document.createElement("div");
      refineDiv.className = "wp-msg wp-msg-in";
      refineDiv.innerHTML = `
        <div class="wp-bubble">
          <p>🔄 <strong>Nueva sugerencia ajustada:</strong></p>
          <div style="font-size: 0.82rem; background: rgba(0,0,0,0.06); padding: 8px; border-radius: 6px; margin: 6px 0; border-left: 3px solid #3b82f6;">
            "${escapeHtml(result.new_suggestion)}"
          </div>
          <p style="margin-top: 4px; font-size: 0.76rem;">👉 Respondé <strong>1</strong> para aprobar y publicar, o escribí otro cambio.</p>
          <span class="wp-time">${timeStr}</span>
        </div>
      `;
      if (el.waChatBody) el.waChatBody.appendChild(refineDiv);
      if (el.waQuickActions) el.waQuickActions.hidden = false;
      if (currentWaQuestion) {
        currentWaQuestion.suggested_answer = result.new_suggestion;
      }
    } else {
      const confirmDiv = document.createElement("div");
      confirmDiv.className = "wp-msg wp-msg-in";
      confirmDiv.innerHTML = `
        <div class="wp-bubble">
          <p>✅ <strong>¡Listo!</strong> Respuesta publicada en Mercado Libre con éxito.</p>
          <div style="font-size: 0.74rem; color: #047857; margin-top: 4px; border-left: 2px solid #10b981; padding-left: 6px;">
            "${escapeHtml(result.question?.final_answer || "")}"
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

// ── Claim Simulator & Presets ──────────────────────────────────────────

const CLAIM_PRESETS = {
  pdd_critical: {
    type: "med_pdd",
    reason: "El auricular izquierdo no funciona ni carga en el estuche",
    hours: 8,
  },
  pnr_high: {
    type: "med_pnr",
    reason: "El paquete figura entregado pero nunca llegó al domicilio",
    hours: 24,
  },
  return_normal: {
    type: "return",
    reason: "El comprador se arrepintió de la compra y solicita devolución express",
    hours: 48,
  },
};

function applyClaimPreset(presetKey) {
  const preset = CLAIM_PRESETS[presetKey];
  if (!preset) return;
  if (el.simClaimType) el.simClaimType.value = preset.type;
  if (el.simClaimReason) el.simClaimReason.value = preset.reason;
  if (el.simClaimHours) el.simClaimHours.value = preset.hours;
}

async function sendClaimSimulation() {
  const type = el.simClaimType?.value || "med_pdd";
  const reason = el.simClaimReason?.value || "Producto con fallas";
  const hoursUntilDue = Number(el.simClaimHours?.value) || 8;

  if (el.claimSimulatorBackdrop) el.claimSimulatorBackdrop.hidden = true;

  try {
    const res = await fetch("/api/claims/simulate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, reason, hoursUntilDue }),
    });
    const data = await res.json();
    if (data.success) {
      await loadClaims();
      switchManagementSection("postsale");
    }
  } catch (err) {
    alert("Error al simular reclamo post-venta.");
  }
}

function renderWhatsAppClaimAlert(data) {
  playNotificationChime();
  const timeStr = new Date().toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });

  const urgencyEmoji = data.urgency === "critical" ? "🔴" : data.urgency === "high" ? "🟠" : "🟡";
  const typeLabel = data.type === "med_pnr" ? "Paquete no recibido (PNR)" : data.type === "med_pdd" ? "Producto defectuoso (PDD)" : "Reclamo / Devolución";

  const msgDiv = document.createElement("div");
  msgDiv.className = "wp-msg wp-msg-in";
  msgDiv.innerHTML = `
    <div class="wp-bubble wp-bubble-claim">
      <div class="wp-card-notification">
        <div class="wp-card-header-badge" style="background: rgba(239, 68, 68, 0.2); border-color: rgba(239, 68, 68, 0.5); color: #fca5a5;">
          <span>${urgencyEmoji} ALERTA RECLAMO POST-VENTA</span>
          <span style="color:#ef4444; font-weight:800;">SLA: ${data.remaining_hours || "8"}hs</span>
        </div>
        <div class="wp-card-item">📦 Orden: #${escapeHtml(data.order_id || "2000000000")}</div>
        <div class="wp-card-q" style="color:#fecaca;">🔖 <strong>${typeLabel}</strong>: "${escapeHtml(data.reason || "Reclamo abierto por el comprador")}"</div>
      </div>
      <p style="margin-top: 6px; font-size: 0.76rem; color: #cbd5e1;">
        ⏳ Respondé a tiempo antes del vencimiento para proteger tu reputación en Mercado Libre.
      </p>
      <div style="margin-top: 8px; display: flex; gap: 6px;">
        <button class="btn-inline-approve" onclick="acknowledgeClaimFromWhatsApp('${data.claim_id}')" style="font-size: 0.76rem; padding: 6px 12px; background: #10b981; border: none; border-radius: 6px; cursor: pointer; color: #fff; font-weight: 700;">
          ✅ Enterado
        </button>
      </div>
      <span class="wp-time">${timeStr}</span>
    </div>
  `;

  if (el.waChatBody) {
    el.waChatBody.appendChild(msgDiv);
    el.waChatBody.scrollTop = el.waChatBody.scrollHeight;
  }
}

window.acknowledgeClaimFromWhatsApp = async function(claimId) {
  await window.acknowledgeClaim(claimId);
  const timeStr = new Date().toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
  const ackDiv = document.createElement("div");
  ackDiv.className = "wp-msg wp-msg-out";
  ackDiv.innerHTML = `
    <div class="wp-bubble">
      <p>✅ Enterado del reclamo #${claimId}. Gestionando con el equipo.</p>
      <span class="wp-time">${timeStr} <span class="wp-ticks">✓✓</span></span>
    </div>
  `;
  if (el.waChatBody) {
    el.waChatBody.appendChild(ackDiv);
    el.waChatBody.scrollTop = el.waChatBody.scrollHeight;
  }
};

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function parseSqliteDate(str) {
  if (!str) return new Date();
  const s = String(str).trim();
  if (s.endsWith("Z") || s.includes("+") || (s.length > 10 && s.indexOf("-", 10) !== -1)) {
    return new Date(s);
  }
  return new Date(s.replace(" ", "T") + "Z");
}
