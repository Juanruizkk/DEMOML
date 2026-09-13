// demo.js — Login gate for the demo dashboard

const DEMO_TOKEN_KEY = "demo_token";
const DEMO_USER_KEY = "demo_user";

function getDemoToken() {
  return localStorage.getItem(DEMO_TOKEN_KEY);
}

function getDemoUser() {
  try {
    const raw = localStorage.getItem(DEMO_USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    console.warn("[Demo] Corrupted demo user in localStorage, clearing...");
    localStorage.removeItem(DEMO_USER_KEY);
    return null;
  }
}

function demoLogout() {
  localStorage.removeItem(DEMO_TOKEN_KEY);
  localStorage.removeItem(DEMO_USER_KEY);
  window.location.reload();
}

async function demoLogin(email, password) {
  const res = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error("Credenciales inválidas");
  const data = await res.json();
  if (data.user.role !== "demo" && data.user.role !== "super_admin") {
    throw new Error("Esta cuenta no tiene acceso demo");
  }
  localStorage.setItem(DEMO_TOKEN_KEY, data.token);
  localStorage.setItem(DEMO_USER_KEY, JSON.stringify(data.user));
  return data;
}

document.addEventListener("DOMContentLoaded", () => {
  const loginScreen = document.getElementById("demo-login-screen");
  const dashboard = document.getElementById("demo-dashboard");

  if (getDemoToken()) {
    loginScreen.style.display = "none";
    dashboard.style.display = "block";
    applyDemoContext();
  } else {
    loginScreen.style.display = "flex";
    dashboard.style.display = "none";
  }

  const form = document.getElementById("demo-login-form");
  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = document.getElementById("demo-email").value;
      const password = document.getElementById("demo-password").value;
      const errorEl = document.getElementById("demo-login-error");
      errorEl.textContent = "";
      try {
        await demoLogin(email, password);
        loginScreen.style.display = "none";
        dashboard.style.display = "block";
        applyDemoContext();
      } catch (err) {
        errorEl.textContent = err.message;
      }
    });
  }

  const logoutBtn = document.getElementById("demo-logout-btn");
  if (logoutBtn) logoutBtn.addEventListener("click", demoLogout);

  const seedBtn = document.getElementById("demo-seed-btn");
  if (seedBtn) {
    seedBtn.addEventListener("click", async () => {
      seedBtn.disabled = true;
      seedBtn.textContent = "Preparando...";
      try {
        const res = await fetch("/api/demo/seed", {
          method: "POST",
          headers: { Authorization: `Bearer ${getDemoToken()}` },
        });
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(errorData.error || `Error HTTP ${res.status}`);
        }
        const data = await res.json();
        seedBtn.textContent = `✓ ${data.message}`;
        setTimeout(() => {
          seedBtn.textContent = "Preparar Demo";
          seedBtn.disabled = false;
        }, 3000);
      } catch {
        seedBtn.textContent = "Error al preparar";
        seedBtn.disabled = false;
      }
    });
  }
});

function applyDemoContext() {
  const user = getDemoUser();
  // Expose for app.js to use
  window.DEMO_AUTH_TOKEN = getDemoToken();
  window.DEMO_SELLER_ID = user?.sellerId;

  const sellerEl = document.getElementById("demo-seller-id-display");
  if (sellerEl && user?.sellerId) sellerEl.textContent = user.sellerId;
}
