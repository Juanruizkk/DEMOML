/* ─────────────────────────────────────────────
   admin.js — Super Admin Dashboard
───────────────────────────────────────────── */

const POLL_INTERVAL_MS    = 30_000;
const STORAGE_TOKEN_KEY   = 'admin_token';
const STORAGE_USER_KEY    = 'admin_user';

const INTENT_META = {
  stock:              { label: 'Stock',             icon: '📦', color: '#10b981' },
  precio:             { label: 'Precio',             icon: '💰', color: '#f59e0b' },
  precio_negociacion: { label: 'Negociación Precio', icon: '🏷️', color: '#f59e0b' },
  envio:              { label: 'Envío',              icon: '🚚', color: '#06b6d4' },
  factura:            { label: 'Factura',            icon: '🧾', color: '#8b5cf6' },
  garantia:           { label: 'Garantía',           icon: '🛡️', color: '#6366f1' },
  caracteristicas:    { label: 'Características',    icon: '🔧', color: '#3b82f6' },
  contacto_externo:   { label: 'Contacto Externo',   icon: '⛔', color: '#f43f5e' },
  otro:               { label: 'Otro',               icon: '❓', color: '#64748b' },
};

const TOKEN_HEALTH_META = {
  healthy:       { label: '🟢 Saludable',  cls: 'healthy' },
  expiring_soon: { label: '🟡 Por vencer', cls: 'expiring_soon' },
  expired:       { label: '🔴 Vencido',    cls: 'expired' },
};

const STATUS_LABELS = {
  auto_answered:  '⚡ Auto',
  pending_review: '⏳ Pendiente',
  approved:       '✅ Aprobada',
  rejected:       '❌ Rechazada',
  error:          '💥 Error',
};

// ── State ────────────────────────────────────────
const state = {
  token:          null,
  user:           null,
  countdownTimer: null,
  countdown:      POLL_INTERVAL_MS / 1000,
  isRefreshing:   false,
  currentSellerId: null,
};

// ── DOM helper ───────────────────────────────────
const $ = (id) => document.getElementById(id);

// ── API ──────────────────────────────────────────
async function apiFetch(path, options = {}) {
  const res = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(state.token ? { 'Authorization': `Bearer ${state.token}` } : {}),
      ...(options.headers || {}),
    },
  });

  if (res.status === 401) {
    logout();
    return null;
  }

  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try { const b = await res.json(); msg = b.message || b.error || msg; } catch (_) {}
    throw new Error(msg);
  }

  return res.json();
}

// ── Auth ─────────────────────────────────────────
async function handleLogin(e) {
  e.preventDefault();
  const btn     = $('login-btn');
  const btnText = $('login-btn-text');
  const errEl   = $('login-error');
  const email   = $('login-email').value.trim();
  const password = $('login-password').value;

  errEl.hidden = true;
  btn.disabled = true;
  btnText.textContent = 'Verificando...';

  try {
    const data = await apiFetch('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    if (!data) return;

    if (data.user?.role !== 'super_admin') {
      throw new Error('Acceso denegado: esta cuenta no tiene rol de Super Admin.');
    }

    state.token = data.token;
    state.user  = data.user;
    localStorage.setItem(STORAGE_TOKEN_KEY, data.token);
    localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(data.user));
    showDashboard();

  } catch (err) {
    errEl.textContent = err.message || 'Error al iniciar sesión. Verificá las credenciales.';
    errEl.hidden = false;
  } finally {
    btn.disabled = false;
    btnText.textContent = 'Ingresar al Panel';
  }
}

function logout() {
  stopPolling();
  state.token = null;
  state.user  = null;
  localStorage.removeItem(STORAGE_TOKEN_KEY);
  localStorage.removeItem(STORAGE_USER_KEY);

  $('dashboard').hidden = true;
  $('login-screen').style.display = 'flex';
  $('login-email').value    = '';
  $('login-password').value = '';
  $('login-error').hidden   = true;
  closeDrawer();
}

function checkStoredAuth() {
  const token   = localStorage.getItem(STORAGE_TOKEN_KEY);
  const userStr = localStorage.getItem(STORAGE_USER_KEY);
  if (!token || !userStr) return false;
  try {
    const user = JSON.parse(userStr);
    if (user.role !== 'super_admin') return false;
    state.token = token;
    state.user  = user;
    return true;
  } catch (_) { return false; }
}

// ── Dashboard ────────────────────────────────────
function showDashboard() {
  $('login-screen').style.display = 'none';
  $('dashboard').hidden = false;
  $('user-email-display').textContent = state.user?.email || '';
  loadAll();
  startPolling();
}

async function loadAll() {
  if (state.isRefreshing) return;
  state.isRefreshing = true;
  setSyncState(true);

  try {
    await Promise.all([loadMetrics(), loadTenants()]);
    $('metrics-updated-at').textContent = `Actualizado: ${fmtTime(new Date())}`;
  } catch (err) {
    console.error('[Admin] Error cargando datos:', err);
  } finally {
    state.isRefreshing = false;
    setSyncState(false);
  }
}

function setSyncState(syncing) {
  const dot = $('refresh-dot');
  const btn = $('btn-refresh');
  if (syncing) {
    dot.classList.add('syncing');
    btn.classList.add('spinning');
    $('refresh-text').textContent = 'Sincronizando...';
  } else {
    dot.classList.remove('syncing');
    btn.classList.remove('spinning');
  }
}

// ── Metrics ──────────────────────────────────────
async function loadMetrics() {
  const m = await apiFetch('/api/admin/metrics');
  if (!m) return;
  renderKPICards(m);
  renderIntentDistribution(m.intentDistribution);
  $('metrics-updated-at').textContent = `Actualizado: ${fmtTime(new Date())}`;
}

function renderKPICards(m) {
  const cards = [
    {
      icon: '💬', color: 'c-indigo',
      value: m.totalQuestions.toLocaleString('es-AR'),
      label: 'Total Preguntas',
      sub: `${m.pendingReviewCount} pendientes · ${m.errorCount} errores`,
    },
    {
      icon: '⚡', color: 'c-emerald',
      value: `${(+m.autoAnswerRatePercent).toFixed(1)}%`,
      label: 'Tasa Auto-Respuesta',
      sub: `${m.autoAnsweredCount} auto · ${m.approvedCount} aprobadas`,
    },
    {
      icon: '⏱️', color: 'c-amber',
      value: `${Math.round(m.averageLatencyMs)}ms`,
      label: 'Latencia Promedio',
      sub: 'tiempo de respuesta IA',
    },
    {
      icon: '🏪', color: 'c-violet',
      value: m.totalActiveTenants.toLocaleString('es-AR'),
      label: 'Tenants Activos',
      sub: 'tiendas integradas',
    },
  ];

  $('kpi-cards').innerHTML = cards.map(c => `
    <div class="kpi-card ${esc(c.color)}">
      <div class="kpi-top">
        <div class="kpi-icon">${c.icon}</div>
      </div>
      <div class="kpi-value">${esc(c.value)}</div>
      <div class="kpi-label">${esc(c.label)}</div>
      <div class="kpi-sub">${esc(c.sub)}</div>
    </div>
  `).join('');
}

function renderIntentDistribution(dist) {
  if (!dist) return;
  const entries = Object.entries(dist)
    .filter(([, v]) => v > 0)
    .sort(([, a], [, b]) => b - a);

  if (!entries.length) {
    $('intent-bars').innerHTML = '<div class="empty-state">Sin datos de intención todavía</div>';
    $('intent-total').textContent = '';
    return;
  }

  const total = entries.reduce((s, [, v]) => s + v, 0);
  $('intent-total').textContent = `${total.toLocaleString('es-AR')} clasificadas`;

  $('intent-bars').innerHTML = entries.map(([key, count]) => {
    const meta = INTENT_META[key] || { label: key, icon: '•', color: '#64748b' };
    const pct  = ((count / total) * 100).toFixed(1);
    return `
      <div class="intent-row">
        <span class="intent-name">${meta.icon} ${esc(meta.label)}</span>
        <div class="intent-bar-wrap">
          <div class="intent-bar-fill" style="width:${pct}%;background:${meta.color};"></div>
        </div>
        <span class="intent-count">${count}</span>
      </div>
    `;
  }).join('');
}

// ── Tenants ──────────────────────────────────────
async function loadTenants() {
  const data = await apiFetch('/api/admin/tenants');
  if (!data) return;
  renderTenantsTable(Array.isArray(data) ? data : []);
}

function renderTenantsTable(tenants) {
  const tbody = $('tenants-tbody');

  if (!tenants.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="table-loading">No hay tenants registrados</td></tr>';
    return;
  }

  tbody.innerHTML = tenants.map(t => {
    const health    = TOKEN_HEALTH_META[t.tokenHealth] || TOKEN_HEALTH_META.expired;
    const expiryTxt = buildExpiryText(t);
    const confPct   = confidencePct(t.confidenceThreshold);

    return `
      <tr>
        <td>
          <div class="tenant-name-cell">
            <span class="tenant-nickname">${esc(t.nickname || t.sellerId)}</span>
            <span class="tenant-seller-id">ID: ${esc(t.sellerId)}</span>
          </div>
        </td>
        <td>
          <div class="token-cell">
            <span class="token-badge ${health.cls}">${health.label}</span>
            <span class="token-expiry">${esc(expiryTxt)}</span>
          </div>
        </td>
        <td>
          <div class="questions-cell">
            <span class="q-total">${t.totalQuestions.toLocaleString('es-AR')} total</span>
            <span class="q-auto">⚡ ${t.autoAnsweredQuestions.toLocaleString('es-AR')} auto</span>
          </div>
        </td>
        <td>
          <div class="config-cell">
            <span class="config-confidence">${confPct}% confianza</span>
            <span class="config-tone">${esc(t.tone)}</span>
          </div>
        </td>
        <td>
          <label class="toggle-switch" title="${t.autoAnswerEnabled ? 'Pausar' : 'Activar'} auto-respuesta">
            <input type="checkbox" ${t.autoAnswerEnabled ? 'checked' : ''}
              data-seller-id="${esc(t.sellerId)}" class="toggle-input" />
            <span class="toggle-slider"></span>
          </label>
        </td>
        <td>
          <div class="actions-cell">
            <button class="btn-action btn-refresh-token" data-seller-id="${esc(t.sellerId)}"
              title="Forzar renovación del token OAuth de MELI">
              🔑 Refrescar
            </button>
            <button class="btn-action btn-view-detail" data-seller-id="${esc(t.sellerId)}"
              title="Ver ficha técnica del tenant">
              👁 Detalle
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

// ── Toggle ────────────────────────────────────────
async function handleToggle(sellerId, enabled) {
  try {
    await apiFetch(`/api/admin/tenants/${encodeURIComponent(sellerId)}/toggle`, {
      method: 'POST',
      body: JSON.stringify({ enabled }),
    });
  } catch (err) {
    console.error('[Admin] Toggle error:', err);
    loadTenants();
  }
}

// ── Refresh Token ─────────────────────────────────
async function handleRefreshToken(sellerId, btn) {
  btn.disabled = true;
  btn.textContent = '⏳ Renovando...';

  try {
    await apiFetch(`/api/admin/tenants/${encodeURIComponent(sellerId)}/refresh-token`, {
      method: 'POST',
    });
    btn.textContent = '✅ Renovado';
    setTimeout(() => {
      btn.disabled    = false;
      btn.textContent = '🔑 Refrescar';
      loadTenants();
    }, 2200);
  } catch (err) {
    btn.textContent = '❌ Error';
    setTimeout(() => {
      btn.disabled    = false;
      btn.textContent = '🔑 Refrescar';
    }, 2200);
  }
}

// ── Detail Drawer ─────────────────────────────────
async function handleOpenDetail(sellerId) {
  state.currentSellerId = sellerId;
  const drawer  = $('detail-drawer');
  const backdrop = $('drawer-backdrop');
  const body    = $('drawer-body');

  $('drawer-tenant-name').textContent = sellerId;
  $('drawer-seller-id').textContent   = `ID: ${sellerId}`;
  body.innerHTML = '<div class="drawer-loading">Cargando detalle...</div>';

  backdrop.hidden = false;
  drawer.classList.add('open');
  document.body.style.overflow = 'hidden';

  try {
    const data = await apiFetch(`/api/admin/tenants/${encodeURIComponent(sellerId)}`);
    if (!data) return;
    $('drawer-tenant-name').textContent = data.tenant.nickname || sellerId;
    renderDrawerDetail(data);
  } catch (err) {
    body.innerHTML = `<div class="drawer-loading">⚠️ ${esc(err.message)}</div>`;
  }
}

function populatePermissions(permissions) {
  if (!permissions) return;
  document.querySelectorAll('.perm-toggle').forEach(checkbox => {
    const key = checkbox.dataset.perm;
    if (key && permissions[key] !== undefined) {
      checkbox.checked = permissions[key];
    }
  });
}

async function savePermissions() {
  const sellerId = state.currentSellerId;
  if (!sellerId) return;

  const statusEl = $('permissions-status');
  const btn = $('save-permissions-btn');
  const permissions = {};
  document.querySelectorAll('.perm-toggle:not([disabled])').forEach(checkbox => {
    permissions[checkbox.dataset.perm] = checkbox.checked;
  });

  btn.disabled = true;
  if (statusEl) statusEl.textContent = 'Guardando...';

  try {
    await apiFetch(`/api/admin/tenants/${encodeURIComponent(sellerId)}/permissions`, {
      method: 'PUT',
      body: JSON.stringify({ permissions }),
    });
    if (statusEl) { statusEl.textContent = 'Guardado'; setTimeout(() => { statusEl.textContent = ''; }, 2000); }
  } catch (err) {
    if (statusEl) statusEl.textContent = 'Error al guardar';
    console.error('[Admin] Error saving permissions:', err);
  } finally {
    btn.disabled = false;
  }
}

function renderDrawerDetail({ tenant, settings, recentQuestions, recentEvents }) {
  const health    = TOKEN_HEALTH_META[tenant.tokenHealth] || TOKEN_HEALTH_META.expired;
  const expiryTxt = buildExpiryText(tenant);
  const confPct   = confidencePct(settings.confidenceThreshold);

  $('drawer-body').innerHTML = `
    <!-- Overview -->
    <div class="drawer-section">
      <div class="drawer-section-title">Resumen</div>
      <div class="config-grid">
        <div class="config-item">
          <div class="config-item-label">Token</div>
          <div class="config-item-value">
            <span class="token-badge ${health.cls}">${health.label}</span>
          </div>
        </div>
        <div class="config-item">
          <div class="config-item-label">Vencimiento</div>
          <div class="config-item-value mono">${esc(expiryTxt)}</div>
        </div>
        <div class="config-item">
          <div class="config-item-label">Preguntas Total</div>
          <div class="config-item-value">${tenant.totalQuestions.toLocaleString('es-AR')}</div>
        </div>
        <div class="config-item">
          <div class="config-item-label">Auto-respondidas</div>
          <div class="config-item-value">${tenant.autoAnsweredQuestions.toLocaleString('es-AR')}</div>
        </div>
        <div class="config-item">
          <div class="config-item-label">Creado</div>
          <div class="config-item-value mono">${fmtDate(tenant.createdAt)}</div>
        </div>
        <div class="config-item">
          <div class="config-item-label">Actualizado</div>
          <div class="config-item-value mono">${fmtDate(tenant.updatedAt)}</div>
        </div>
      </div>
    </div>

    <!-- Settings -->
    <div class="drawer-section">
      <div class="drawer-section-title">Configuración</div>
      <div class="config-grid">
        <div class="config-item">
          <div class="config-item-label">Auto-Respuesta</div>
          <div class="config-item-value">${settings.autoAnswerEnabled ? '✅ Activa' : '⏸️ Pausada'}</div>
        </div>
        <div class="config-item">
          <div class="config-item-label">Confianza Mínima</div>
          <div class="config-item-value">${confPct}%</div>
        </div>
        <div class="config-item">
          <div class="config-item-label">Tono</div>
          <div class="config-item-value" style="text-transform:capitalize">${esc(settings.tone)}</div>
        </div>
        <div class="config-item">
          <div class="config-item-label">WhatsApp Alertas</div>
          <div class="config-item-value mono">${esc(settings.whatsappAlertPhone || '—')}</div>
        </div>
        ${settings.customInstructions ? `
        <div class="config-item span-2">
          <div class="config-item-label">Instrucciones Personalizadas</div>
          <div class="config-item-value soft">${esc(settings.customInstructions)}</div>
        </div>` : ''}
      </div>
    </div>

    <!-- Recent Questions -->
    <div class="drawer-section">
      <div class="drawer-section-title">Últimas Preguntas</div>
      <div class="questions-mini-list">
        ${recentQuestions.length === 0
          ? '<div class="empty-state">Sin preguntas recientes</div>'
          : recentQuestions.map(q => `
            <div class="question-mini-item">
              <div class="q-mini-text">${esc(q.text)}</div>
              <div class="q-mini-meta">
                ${q.intent ? `<span class="q-mini-tag q-mini-tag-intent">${esc(q.intent)}</span>` : ''}
                ${q.confidence != null
                  ? `<span class="q-mini-tag q-mini-tag-conf">${(+q.confidence * 100).toFixed(0)}%</span>`
                  : ''}
                <span class="q-mini-tag q-mini-status-${esc(q.appStatus)}">
                  ${esc(STATUS_LABELS[q.appStatus] || q.appStatus)}
                </span>
                <span class="q-mini-time">${fmtDate(q.receivedAt)}</span>
              </div>
            </div>
          `).join('')}
      </div>
    </div>

    <!-- Audit Events -->
    <div class="drawer-section">
      <div class="drawer-section-title">Auditoría</div>
      <div class="events-list">
        ${recentEvents.length === 0
          ? '<div class="empty-state">Sin eventos recientes</div>'
          : recentEvents.map(ev => `
            <div class="event-item">
              <span class="event-type">${esc(ev.type)}</span>
              <span class="event-message">${esc(ev.message)}</span>
              <span class="event-time">${fmtDate(ev.createdAt)}</span>
            </div>
          `).join('')}
      </div>
    </div>
  `;

  // Append permissions panel from template
  const tpl = document.getElementById('permissions-panel-tpl');
  if (tpl) {
    const clone = tpl.content.cloneNode(true);
    $('drawer-body').appendChild(clone);
    populatePermissions(settings.permissions);
    const saveBtn = $('save-permissions-btn');
    if (saveBtn) saveBtn.addEventListener('click', savePermissions);
  }
}

function closeDrawer() {
  $('detail-drawer').classList.remove('open');
  $('drawer-backdrop').hidden = true;
  document.body.style.overflow = '';
}

// ── Polling ───────────────────────────────────────
function startPolling() {
  stopPolling();
  state.countdown = POLL_INTERVAL_MS / 1000;
  updateCountdownDisplay();

  state.countdownTimer = setInterval(() => {
    state.countdown--;
    if (state.countdown <= 0) {
      state.countdown = POLL_INTERVAL_MS / 1000;
      loadAll();
    }
    updateCountdownDisplay();
  }, 1000);
}

function stopPolling() {
  if (state.countdownTimer) {
    clearInterval(state.countdownTimer);
    state.countdownTimer = null;
  }
}

function updateCountdownDisplay() {
  const el = $('refresh-text');
  if (!el) return;
  el.textContent = state.isRefreshing
    ? 'Sincronizando...'
    : `Actualiza en ${state.countdown}s`;
}

function resetPoll() {
  state.countdown = POLL_INTERVAL_MS / 1000;
  updateCountdownDisplay();
}

// ── Utils ─────────────────────────────────────────
function esc(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fmtTime(date) {
  return new Date(date).toLocaleTimeString('es-AR', {
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

function fmtDate(str) {
  if (!str) return '—';
  const d = new Date(str);
  return d.toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function confidencePct(val) {
  if (val == null) return '—';
  return val <= 1 ? Math.round(val * 100) : Math.round(val);
}

function buildExpiryText(t) {
  if (t.tokenHealth === 'expired') return 'Vencido';
  if (t.expiresInMinutes == null)  return '—';
  return t.expiresInMinutes > 60
    ? `Vence en ${Math.floor(t.expiresInMinutes / 60)}h ${t.expiresInMinutes % 60}m`
    : `Vence en ${t.expiresInMinutes}m`;
}

// ── Event Listeners ───────────────────────────────
function setupListeners() {
  $('login-form').addEventListener('submit', handleLogin);
  $('btn-logout').addEventListener('click', logout);

  $('btn-refresh').addEventListener('click', () => {
    resetPoll();
    loadAll();
  });

  $('btn-refresh-table').addEventListener('click', () => {
    resetPoll();
    loadTenants();
  });

  $('btn-close-drawer').addEventListener('click', closeDrawer);
  $('drawer-backdrop').addEventListener('click', closeDrawer);

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeDrawer();
  });

  // Delegated events on tenants table
  $('tenants-tbody').addEventListener('change', e => {
    const input = e.target.closest('.toggle-input');
    if (input) handleToggle(input.dataset.sellerId, input.checked);
  });

  $('tenants-tbody').addEventListener('click', e => {
    const refreshBtn = e.target.closest('.btn-refresh-token');
    if (refreshBtn) { handleRefreshToken(refreshBtn.dataset.sellerId, refreshBtn); return; }

    const detailBtn = e.target.closest('.btn-view-detail');
    if (detailBtn) { handleOpenDetail(detailBtn.dataset.sellerId); return; }
  });
}

// ── Init ──────────────────────────────────────────
function init() {
  setupListeners();
  if (checkStoredAuth()) {
    showDashboard();
  } else {
    $('login-screen').style.display = 'flex';
  }
}

document.addEventListener('DOMContentLoaded', init);
