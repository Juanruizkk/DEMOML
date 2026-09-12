# Fase 6 — Frontend del Super Admin Dashboard

Este documento describe la implementación del panel de administración global (`/admin.html`), su estructura, lógica de negocio y relación con los endpoints del backend.

---

## Archivos creados

| Archivo | Capa | Descripción |
|---|---|---|
| `public/admin.html` | Presentación | Estructura HTML: pantalla de login, dashboard, drawer de detalle |
| `public/admin.css` | Presentación | Estilos dark mode; mismo design system que `styles.css` |
| `public/admin.js` | Presentación | Lógica de autenticación, polling, renderizado y llamadas API |

> Ningún archivo fuera de `public/` fue modificado.

---

## Acceso

```
GET /admin.html
```

Credenciales de seed: `admin@melibot.com` / `Admin123456!`

---

## Flujo de autenticación

```
┌──────────────────────────────────────────────────────┐
│  Carga /admin.html                                    │
│                                                      │
│  ¿admin_token en localStorage?                       │
│       ├─ SÍ → ¿role === "super_admin"?               │
│       │         ├─ SÍ  → showDashboard()             │
│       │         └─ NO  → login screen                │
│       └─ NO → login screen                           │
│                                                      │
│  Login: POST /api/auth/login                         │
│       └─ response.user.role !== "super_admin"        │
│             → error "Acceso denegado"                │
│       └─ OK → localStorage + showDashboard()         │
└──────────────────────────────────────────────────────┘
```

El token se persiste en `localStorage` bajo las claves `admin_token` y `admin_user`. Cualquier respuesta `HTTP 401` de la API dispara `logout()` automáticamente, limpiando el estado local.

---

## Pantallas y componentes

### 1. Login Screen

Pantalla completa centrada con fondo oscuro y halos violeta/índigo. Muestra error inline si las credenciales son inválidas o si el rol no es `super_admin`.

### 2. Header (sticky)

| Elemento | Descripción |
|---|---|
| Brand + badge "Super Admin" | Identidad del panel |
| Countdown de refresh | Indica segundos hasta el próximo auto-refresh (30s) |
| Botón 🔄 | Fuerza un `loadAll()` manual y resetea el countdown |
| Email del usuario | Leído de `localStorage` |
| Botón Salir | Limpia estado, redirige a login |

### 3. KPI Cards (métricas globales)

Consume `GET /api/admin/metrics` → `GlobalMetricsDTO`.

| Card | Campo fuente | Color |
|---|---|---|
| 💬 Total Preguntas | `totalQuestions` | Índigo |
| ⚡ Tasa Auto-Respuesta | `autoAnswerRatePercent` | Verde |
| ⏱️ Latencia Promedio | `averageLatencyMs` | Ámbar |
| 🏪 Tenants Activos | `totalActiveTenants` | Violeta |

### 4. Distribución de Intenciones

Barras horizontales generadas dinámicamente desde `intentDistribution` (campo `Record<IntentType | "otro", number>`). Las barras se ordenan de mayor a menor y el ancho es proporcional al total. Intenciones soportadas con íconos:

| Clave | Ícono |
|---|---|
| `stock` | 📦 |
| `precio` / `precio_negociacion` | 💰 / 🏷️ |
| `envio` | 🚚 |
| `factura` | 🧾 |
| `garantia` | 🛡️ |
| `caracteristicas` | 🔧 |
| `contacto_externo` | ⛔ |
| `otro` | ❓ |

Cualquier clave desconocida se renderiza con `•` como fallback.

### 5. Tabla de Tenants

Consume `GET /api/admin/tenants` → `TenantOverviewDTO[]`.

| Columna | Descripción |
|---|---|
| **Tienda** | Nickname (o sellerId si no tiene) + ID en fuente mono |
| **Token** | Badge semáforo `🟢 Saludable` / `🟡 Por vencer` / `🔴 Vencido` + tiempo restante |
| **Preguntas** | Total + auto-respondidas |
| **Auto-Resp.** | Umbral de confianza (%) + tono configurado |
| **Habilitado** | Toggle CSS puro; `onChange` → `POST /api/admin/tenants/:id/toggle` |
| **Acciones** | Botón "🔑 Refrescar" + "👁 Detalle" |

Los eventos de la tabla se manejan con **event delegation** sobre `#tenants-tbody` para evitar `onclick` inline.

#### Toggle de auto-respuesta

```
usuario cambia switch
  → handleToggle(sellerId, enabled)
  → POST /api/admin/tenants/:sellerId/toggle  { enabled }
  → error: recargar tabla para restaurar estado real
```

#### Refresco de token OAuth

```
click "🔑 Refrescar"
  → botón disabled + "⏳ Renovando..."
  → POST /api/admin/tenants/:sellerId/refresh-token
  → OK  → "✅ Renovado" → 2.2s → recarga tabla
  → ERR → "❌ Error"   → 2.2s → re-habilita botón
```

### 6. Drawer de Detalle

Panel lateral deslizable desde la derecha. Se abre con `👁 Detalle` y consume `GET /api/admin/tenants/:sellerId` → `TenantDetailDTO`.

**Secciones del drawer:**

1. **Resumen** — token health, tiempo de vencimiento, totales, fechas de creación/actualización
2. **Configuración** — autoAnswerEnabled, confidenceThreshold, tone, whatsappAlertPhone, customInstructions
3. **Últimas Preguntas** — hasta 5, con texto, intención, confianza, estado y timestamp
4. **Auditoría** — eventos recientes con tipo, mensaje y timestamp

**Cierre:** botón `✕`, click en el backdrop, o tecla `Escape`.

---

## Auto-refresh

```
startPolling()
  → setInterval cada 1s
  → countdown-- hasta 0
  → loadAll() → resetea countdown a 30
  → muestra "Actualiza en Xs" en header
```

`loadAll()` lanza `loadMetrics()` y `loadTenants()` en paralelo con `Promise.all`. El botón manual de refresh y el botón "Actualizar tabla" también resetean el countdown.

---

## Seguridad

- Todos los strings renderizados con `innerHTML` pasan por `esc()` (escape de `&`, `<`, `>`, `"`), previniendo XSS.
- El token JWT se envía en el header `Authorization: Bearer <token>` en cada llamada.
- Cualquier `401` del servidor llama a `logout()` automáticamente.
- La pantalla de login verifica explícitamente `role === "super_admin"` en el cliente además de la validación del servidor.
- `confidenceThreshold` se normaliza como decimal (0–1) → porcentaje; si el valor ya es > 1 se usa directamente.

---

## Design system

`admin.css` replica los tokens CSS de `styles.css` para mantener consistencia visual:

```
--bg-app:     #080c14   (fondo)
--bg-surface: #0f172a   (cards, paneles)
--bg-card:    #1e293b   (elementos internos)
--indigo:     #6366f1   (acento primario)
--violet:     #8b5cf6   (acento secundario)
--emerald:    #10b981   (éxito / activo)
--amber:      #f59e0b   (advertencia)
--rose:       #f43f5e   (error / peligro)
```

El drawer usa `transform: translateX(100%)` → `translateX(0)` para el slide-in, sin `display:none`, permitiendo que la animación funcione correctamente.

---

## Relación con endpoints del backend

| Acción UI | Método | Endpoint |
|---|---|---|
| Login | `POST` | `/api/auth/login` |
| KPI Cards + Intenciones | `GET` | `/api/admin/metrics` |
| Tabla de Tenants | `GET` | `/api/admin/tenants` |
| Drawer de Detalle | `GET` | `/api/admin/tenants/:sellerId` |
| Toggle auto-respuesta | `POST` | `/api/admin/tenants/:sellerId/toggle` |
| Refrescar token OAuth | `POST` | `/api/admin/tenants/:sellerId/refresh-token` |
