/**
 * Portal del Vendedor (Tenant Frontend) • MELI AI Assistant
 */

let state = {
  token: localStorage.getItem("meli_jwt") || "",
  user: null,
  tenant: null,
  questions: {
    pending_review: [],
    auto_answered: [],
    other: [],
  },
  currentFilter: "pending",
  activeTab: "questions",
  sseSource: null,
};

// ── Auth Handling ──────────────────────────────────────────
let currentLoginMode = "login";

function switchLoginMode(mode) {
  currentLoginMode = mode;
  document.getElementById("auth-error-msg").style.display = "none";
  document.getElementById("tab-btn-login").classList.toggle("active", mode === "login");
  document.getElementById("tab-btn-register").classList.toggle("active", mode === "register");
  document.getElementById("group-register-name").style.display = mode === "register" ? "block" : "none";
  document.getElementById("btn-auth-submit").querySelector("span").textContent =
    mode === "register" ? "Registrar e Ingresar" : "Ingresar al Panel";
}

async function handleTenantAuth(e) {
  e.preventDefault();
  const errorEl = document.getElementById("auth-error-msg");
  errorEl.style.display = "none";

  const email = document.getElementById("tenant-email").value.trim();
  const password = document.getElementById("tenant-password").value;
  const name = document.getElementById("tenant-name").value.trim();

  const endpoint = currentLoginMode === "register" ? "/api/auth/register" : "/api/auth/login";
  const body = currentLoginMode === "register"
    ? { email, password, name, role: "tenant" }
    : { email, password };

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Error al autenticar.");

    state.token = data.token;
    localStorage.setItem("meli_jwt", data.token);

    await initTenantApp();
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.style.display = "block";
  }
}

function logoutTenant() {
  localStorage.removeItem("meli_jwt");
  state.token = "";
  state.user = null;
  state.tenant = null;
  if (state.sseSource) state.sseSource.close();
  document.getElementById("app-layout").style.display = "none";
  document.getElementById("auth-overlay").style.display = "flex";
}

// ── App Initialization ─────────────────────────────────────
async function initTenantApp() {
  if (!state.token) {
    document.getElementById("auth-overlay").style.display = "flex";
    document.getElementById("app-layout").style.display = "none";
    return;
  }

  try {
    // 1. Obtener perfil del usuario
    const meRes = await fetch("/api/auth/me", {
      headers: { Authorization: `Bearer ${state.token}` },
    });

    if (!meRes.ok) throw new Error("Sesión inválida.");
    state.user = await meRes.json();

    // 2. Obtener configuración y datos del tenant
    const settingsRes = await fetch("/api/tenant/settings", {
      headers: { Authorization: `Bearer ${state.token}` },
    });

    if (settingsRes.ok) {
      state.tenant = await settingsRes.json();
    }

    // Mostrar UI principal
    document.getElementById("auth-overlay").style.display = "none";
    document.getElementById("app-layout").style.display = "block";

    renderHeader();
    renderSettingsForm();
    await loadTenantQuestions();
    initRealtimeEvents();
  } catch (e) {
    console.warn("Token expirado o inválido:", e);
    logoutTenant();
  }
}

// ── Render Topbar Header ───────────────────────────────────
function renderHeader() {
  const storeName = state.tenant?.nickname || state.user?.name || "Mi Tienda";
  const sellerId = state.tenant?.sellerId || state.user?.sellerId || "Sin vincular";
  const tokenHealth = state.tenant?.tokenHealth || "healthy";

  document.getElementById("header-store-name").textContent = storeName;
  document.getElementById("header-seller-id").textContent = `Seller ID: ${sellerId}`;

  const badgeEl = document.getElementById("header-token-badge");
  badgeEl.className = `token-health-badge ${tokenHealth}`;

  if (tokenHealth === "healthy") {
    badgeEl.textContent = "🟢 Conectado & Activo";
  } else if (tokenHealth === "expiring_soon") {
    badgeEl.textContent = "🟡 Token por Vencer";
  } else {
    badgeEl.textContent = "🔴 Desconectado";
  }

  // Actualizar Tab Conexión
  document.getElementById("conn-nickname").textContent = storeName;
  document.getElementById("conn-seller-id").textContent = sellerId;
  document.getElementById("conn-expires").textContent = state.tenant?.expiresInMinutes
    ? `${state.tenant.expiresInMinutes} minutos`
    : "Activo";
}

// ── Tab Switching ──────────────────────────────────────────
function switchTab(tabId) {
  state.activeTab = tabId;
  document.querySelectorAll(".nav-tab").forEach((btn) => {
    btn.classList.toggle("active", btn.getAttribute("data-tab") === tabId);
  });
  document.querySelectorAll(".tab-panel").forEach((panel) => {
    panel.classList.toggle("active", panel.id === `panel-${tabId}`);
  });
}

// ── Questions Management ───────────────────────────────────
async function loadTenantQuestions() {
  const listEl = document.getElementById("questions-list");
  try {
    const res = await fetch("/api/questions", {
      headers: { Authorization: `Bearer ${state.token}` },
    });

    if (!res.ok) throw new Error("Error cargando preguntas.");
    const data = await res.json();
    state.questions = data;

    renderQuestions();
  } catch (err) {
    listEl.innerHTML = `<div class="empty-state">${err.message}</div>`;
  }
}

function filterQuestions(filterType) {
  state.currentFilter = filterType;
  document.querySelectorAll(".filter-pill").forEach((btn) => {
    btn.classList.toggle("active", btn.getAttribute("data-filter") === filterType);
  });
  renderQuestions();
}

function renderQuestions() {
  const pendingList = state.questions.pending_review || [];
  const autoList = state.questions.auto_answered || [];
  const otherList = state.questions.other || [];
  const allList = [...pendingList, ...autoList, ...otherList];

  // Actualizar contadores
  document.getElementById("badge-pending-count").textContent = pendingList.length;
  document.getElementById("count-filter-pending").textContent = `(${pendingList.length})`;
  document.getElementById("count-filter-auto").textContent = `(${autoList.length})`;
  document.getElementById("count-filter-all").textContent = `(${allList.length})`;

  let displayList = [];
  if (state.currentFilter === "pending") displayList = pendingList;
  else if (state.currentFilter === "auto") displayList = autoList;
  else displayList = allList;

  const listEl = document.getElementById("questions-list");

  if (displayList.length === 0) {
    listEl.innerHTML = `
      <div class="empty-state">
        <div style="font-size: 2rem; margin-bottom: 8px;">📭</div>
        <h3>No hay preguntas en esta sección</h3>
        <p>Las consultas de tus compradores en Mercado Libre aparecerán acá automáticamente.</p>
      </div>
    `;
    return;
  }

  listEl.innerHTML = displayList
    .map((q) => {
      const isPending = q.appStatus === "pending_review";
      const intentLabel = q.intent ? q.intent.toUpperCase() : "GENERAL";
      const confidencePercent = q.confidence ? Math.round(q.confidence * 100) : 85;
      const statusLabel = isPending ? "⏳ Requiere Aprobación" : "✓ Respondida";
      const statusClass = isPending ? "pending" : "auto_answered";

      return `
        <div class="question-card" id="q-card-${q.id || q.questionId}">
          <div class="q-header">
            <span class="q-item-title">📦 Publicación: ${escapeHtml(q.itemId || q.item_id || "Ítem")}</span>
            <div class="q-badges">
              <span class="intent-badge">${intentLabel} (${confidencePercent}%)</span>
              <span class="status-badge ${statusClass}">${statusLabel}</span>
            </div>
          </div>

          <div class="q-body-quote">
            <strong>Pregunta del Comprador:</strong><br/>
            "${escapeHtml(q.text || "")}"
          </div>

          ${
            isPending
              ? `
            <div class="q-answer-box">
              <label>Borrador Sugerido por IA (Editable):</label>
              <textarea class="q-answer-textarea" id="textarea-ans-${q.id || q.questionId}" rows="3">${escapeHtml(
                  q.suggestedAnswer || q.suggested_answer || ""
                )}</textarea>
              <div class="q-actions-row">
                <button type="button" class="btn-reject" onclick="rejectQuestion('${q.id || q.questionId}')">
                  ✕ Descartar
                </button>
                <button type="button" class="btn-approve" onclick="approveQuestion('${q.id || q.questionId}')">
                  ✓ Aprobar y Publicar en MELI
                </button>
              </div>
            </div>
          `
              : `
            <div style="font-size: 0.88rem; color: var(--text-muted); background: rgba(30, 41, 59, 0.3); padding: 10px; border-radius: var(--radius-sm);">
              <strong style="color: var(--emerald-text);">Respuesta Publicada:</strong> ${escapeHtml(
                q.finalAnswer || q.final_answer || q.suggestedAnswer || ""
              )}
            </div>
          `
          }
        </div>
      `;
    })
    .join("");
}

async function approveQuestion(id) {
  const textarea = document.getElementById(`textarea-ans-${id}`);
  const text = textarea ? textarea.value.trim() : "";

  try {
    const res = await fetch(`/api/questions/${id}/approve`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${state.token}`,
      },
      body: JSON.stringify({ text }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Error al aprobar.");

    showToast("✅ Respuesta aprobada y publicada en Mercado Libre");
    await loadTenantQuestions();
  } catch (err) {
    showToast(`❌ Error: ${err.message}`);
  }
}

async function rejectQuestion(id) {
  try {
    const res = await fetch(`/api/questions/${id}/reject`, {
      method: "POST",
      headers: { Authorization: `Bearer ${state.token}` },
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Error al descartar.");

    showToast("🗑️ Pregunta descartada");
    await loadTenantQuestions();
  } catch (err) {
    showToast(`❌ Error: ${err.message}`);
  }
}

// ── Settings Management ────────────────────────────────────
function renderSettingsForm() {
  const s = state.tenant?.settings || {};

  document.getElementById("setting-auto-answer").checked = s.autoAnswerEnabled ?? true;
  document.getElementById("setting-threshold").value = s.confidenceThreshold ?? 0.75;
  document.getElementById("label-threshold-val").textContent = `${Math.round((s.confidenceThreshold ?? 0.75) * 100)}%`;
  document.getElementById("setting-instructions").value = s.customInstructions || "";
  // WhatsApp settings
  const mode = s.whatsappMode || "platform_shared";
  document.getElementById("setting-whatsapp-phone").value = s.whatsappAlertPhone || "";
  document.getElementById("setting-whatsapp-phone-byo").value = s.whatsappAlertPhone || "";
  document.getElementById("setting-custom-phone-id").value = s.customPhoneNumberId || "";
  document.getElementById("setting-custom-token").value = s.customAccessToken || "";
  document.getElementById("setting-custom-waba-id").value = s.customWabaId || "";

  // Set radio
  const radioShared = document.getElementById("radio-platform-shared");
  const radioByo = document.getElementById("radio-custom-byo");
  if (mode === "custom_byo") {
    radioByo.checked = true;
  } else {
    radioShared.checked = true;
  }
  onWaModeChange();

  // Quota bar
  const used = s.alertsSentThisMonth || 0;
  const limit = s.monthlyAlertsLimit || 150;
  const pct = Math.min(100, Math.round((used / limit) * 100));
  document.getElementById("quota-bar-fill").style.width = pct + "%";
  document.getElementById("quota-used-label").textContent = `${used} alerta${used !== 1 ? "s" : ""} usada${used !== 1 ? "s" : ""}`;
  document.getElementById("quota-limit-label").textContent = `de ${limit} este mes`;
  document.getElementById("quota-warning").style.display = pct >= 80 ? "block" : "none";
  const planNames = { starter: "Plan Starter", pro: "Plan Pro", enterprise: "Plan Enterprise" };
  document.getElementById("quota-plan-badge").textContent = planNames[s.planId] || "Plan Starter";
  const resetDate = s.cycleResetDate ? new Date(s.cycleResetDate).toLocaleDateString("es-AR") : "—";
  document.getElementById("quota-reset-date").textContent = resetDate;

  const tone = s.tone || "casual_rioplatense";
  const radio = document.querySelector(`input[name="setting-tone"][value="${tone}"]`);
  if (radio) radio.checked = true;
}

function updateThresholdLabel(val) {
  document.getElementById("label-threshold-val").textContent = `${Math.round(val * 100)}%`;
}

async function saveAISettings() {
  const autoAnswerEnabled = document.getElementById("setting-auto-answer").checked;
  const confidenceThreshold = parseFloat(document.getElementById("setting-threshold").value);
  const customInstructions = document.getElementById("setting-instructions").value.trim();
  const toneRadio = document.querySelector('input[name="setting-tone"]:checked');
  const tone = toneRadio ? toneRadio.value : "casual_rioplatense";

  try {
    const res = await fetch("/api/tenant/settings", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${state.token}`,
      },
      body: JSON.stringify({
        autoAnswerEnabled,
        confidenceThreshold,
        customInstructions,
        tone,
      }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Error guardando configuración.");

    state.tenant.settings = data.settings;
    showToast("💾 Configuración de IA guardada con éxito");
  } catch (err) {
    showToast(`❌ Error: ${err.message}`);
  }
}

function onWaModeChange() {
  const mode = document.querySelector('input[name="wa-mode"]:checked')?.value || "platform_shared";
  document.getElementById("panel-mode-shared").style.display = mode === "platform_shared" ? "block" : "none";
  document.getElementById("panel-mode-byo").style.display = mode === "custom_byo" ? "block" : "none";
}

async function saveWhatsAppSettings() {
  const mode = document.querySelector('input[name="wa-mode"]:checked')?.value || "platform_shared";

  const payload = {
    whatsappMode: mode,
  };

  if (mode === "platform_shared") {
    payload.whatsappAlertPhone = document.getElementById("setting-whatsapp-phone").value.trim();
  } else {
    payload.whatsappAlertPhone = document.getElementById("setting-whatsapp-phone-byo").value.trim();
    payload.customPhoneNumberId = document.getElementById("setting-custom-phone-id").value.trim();
    payload.customAccessToken = document.getElementById("setting-custom-token").value.trim();
    payload.customWabaId = document.getElementById("setting-custom-waba-id").value.trim();
  }

  try {
    const res = await fetch("/api/tenant/settings", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${state.token}`,
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Error guardando configuración.");

    state.tenant.settings = data.settings;
    showToast("📱 Configuración de WhatsApp guardada");
  } catch (err) {
    showToast(`❌ Error: ${err.message}`);
  }
}

// ── Realtime SSE Events ────────────────────────────────────
function initRealtimeEvents() {
  if (state.sseSource) state.sseSource.close();

  const sellerId = state.tenant?.sellerId || state.user?.sellerId;
  const url = sellerId ? `/api/events/stream?seller_id=${sellerId}` : "/api/events/stream";

  state.sseSource = new EventSource(url);

  state.sseSource.addEventListener("question_received", () => {
    showToast("📩 Nueva pregunta pre-venta recibida");
    loadTenantQuestions();
  });

  state.sseSource.addEventListener("answer_published", () => {
    loadTenantQuestions();
  });

  state.sseSource.addEventListener("claim_received", (e) => {
    showToast("⚠️ ALERTA: Nuevo reclamo post-venta recibido en Mercado Libre");
  });
}

// ── Helpers ────────────────────────────────────────────────
function showToast(msg) {
  const el = document.getElementById("toast-notif");
  el.textContent = msg;
  el.style.display = "block";
  setTimeout(() => {
    el.style.display = "none";
  }, 4000);
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ── DOM Ready ──────────────────────────────────────────────
window.addEventListener("DOMContentLoaded", () => {
  initTenantApp();
});
