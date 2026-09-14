# Plan de Implementación: Sistema de Alertas en Tiempo Real (Campana de Notificaciones) & Configuración por Tenant

Este plan detalla la arquitectura y diseño para implementar un sistema de **campana de notificaciones en tiempo real** en la plataforma, con centro de alertas desplegable, sonido opcional y un panel de configuración exclusivo para el vendedor/tenant donde podrá definir el alcance (todas, solo preguntas o solo reclamos).

> **Preparado para ejecución directa por Claude Code.**

---

## 📌 1. Resumen de Requerimientos

1. **Campana de Notificaciones en Pantalla (`NotificationBell`)**:
   - Ubicada en la barra superior / header global de la aplicación (`Layout.tsx`).
   - Badge numérico con contador de alertas no leídas.
   - Animación de campana (*pulse/ring*) al recibir nuevos eventos en vivo vía Server-Sent Events (SSE).
   - Sonido de alerta sutil generado con Web Audio API sintetizada (sin dependencias de mp3 externos).
   - Menú desplegable (*Notification Center*):
     - Lista cronológica de notificaciones (Pregunta recibida, Reclamo nuevo, SLA crítico).
     - Marcado individual y masivo como leídas.
     - Enlace directo al ítem correspondiente (`/questions` o `/claims`).
     - Acceso rápido a la configuración.

2. **Panel de Configuración del Tenant (Vista Vendedor / Usuario, no Superadmin)**:
   - Configuración en `client/src/pages/TenantPage.tsx` (pestaña *Canales & Alertas* `/channels`):
     - **Habilitar/Deshabilitar** notificaciones en pantalla.
     - **Selector de alcance (*Scope*)**:
       - `all`: Todas las alertas (Preguntas + Reclamos).
       - `questions_only`: Solo preguntas pre-venta.
       - `claims_only`: Solo reclamos post-venta.
     - **Toggle de sonido de alerta**: Activar / desactivar campanilla audible.
     - **Toggle de notificaciones de escritorio (*Browser Push*)**: Alertas nativas del navegador con solicitud interactiva de permisos.

---

## 🏗️ 2. Arquitectura Técnica

```mermaid
flowchart TD
    A[Mercado Libre Webhook / Simulador] --> B[Fastify Backend / UseCases]
    B --> C[FastifySseNotifier - broadcastToSeller]
    C -->|SSE Stream /api/events/stream| D[NotificationContext React]
    D --> E{Verificar Configuración Tenant}
    E -->|Scope Match & Enabled| F[Campana de Notificaciones + Badge]
    E -->|soundEnabled = true| H[Audio Chime Sound (Web Audio API)]
    E -->|desktopPushEnabled = true| I[Browser Web Notification]
    E -->|Disabled or Filtered Out| J[Ignorar evento]
    
    K[Tenant en /channels] -->|PUT /api/tenant/settings| L[SQLite Tenant Table]
    L --> D
```

---

## 📂 3. Archivos a Modificar / Crear

### A. Backend

#### `src/domain/entities/Tenant.ts`
- Extender la interfaz `TenantSettings` con la configuración de notificaciones web:
  ```ts
  export interface WebNotificationsSettings {
    enabled: boolean;
    scope: "all" | "questions_only" | "claims_only";
    soundEnabled: boolean;
    desktopPushEnabled: boolean;
  }

  export interface TenantSettings {
    // ... campos existentes
    webNotifications?: WebNotificationsSettings;
  }
  ```
- En `Tenant.createDefault`, inicializar `webNotifications` con valores por defecto activos:
  ```ts
  webNotifications: {
    enabled: true,
    scope: "all",
    soundEnabled: true,
    desktopPushEnabled: false,
  }
  ```

---

### B. Frontend

#### `client/src/context/NotificationContext.tsx`
- Contexto global de React que:
  1. Mantiene el array de `notifications: NotificationItem[]` en memoria y persistido en `localStorage` (`meli_notifications_${sellerId}`).
  2. Conecta el `EventSource` a `/api/events/stream?seller_id=${sellerId}`.
  3. Evalúa las preferencias del tenant cargadas desde `/api/tenant/settings`:
     - Si `webNotifications.enabled === false`, omite alertas.
     - Si `scope === 'questions_only'`, procesa solo `question_*`.
     - Si `scope === 'claims_only'`, procesa solo `claim_*`.
  4. Dispara:
     - Audio Chime (utilizando Web Audio API sintetizada).
     - `Notification.requestPermission()` y `new Notification(...)` si `desktopPushEnabled` está activo.
  5. Proporciona funciones: `markAsRead(id)`, `markAllAsRead()`, `clearAll()`, `unreadCount`, `webSettings`, `updateWebSettings(partial)`, `requestDesktopPermission()`.

#### `client/src/App.tsx`
- Envolver las rutas con `<NotificationProvider>`:
  ```tsx
  import { NotificationProvider } from './context/NotificationContext'

  export default function App() {
    // ...
    return (
      <NotificationProvider>
        <Suspense fallback={<PageLoading />}>
          <Routes>
            {/* Rutas */}
          </Routes>
        </Suspense>
      </NotificationProvider>
    )
  }
  ```

#### `client/src/components/NotificationBell.tsx` & `NotificationBell.css`
- Componente de campana para el layout:
  - Botón con icono Lucide (`Bell` / `BellRing`) y badge numérico con animación.
  - Menú desplegable flotante (*Dropdown / Glass Panel*):
    - Encabezado con contador, botón "Leídas" y botón "Borrar".
    - Lista de notificaciones con icono diferenciado (💬 preguntas en azul, 🔴 reclamos en rojo).
    - Clic en notificación: Marca como leída y navega con `react-router-dom` a `/questions` o `/claims`.
    - Enlace inferior directo a `/channels`.

#### `client/src/components/Layout.tsx` & `Layout.css`
- Incorporar `<NotificationBell />` en el bloque derecho del header superior (`.top-nav-right`).

#### `client/src/pages/TenantPage.tsx` & `TenantPage.css`
- En la pestaña **Canales & Alertas** (`activeTab === 'channels'`):
  - Añadir sección **"🔔 Notificaciones en Plataforma Web"**:
    - Toggle general: *Habilitar alertas en vivo en la campana*.
    - Selector de alcance (*Scope*): `🔔 Todas las alertas` | `💬 Solo Preguntas` | `⚖️ Solo Reclamos`.
    - Toggle: *Sonido de alerta audible*.
    - Toggle: *Notificaciones de escritorio (Push del navegador)* con solicitud de permisos nativos.
  - Guardar preferencias a través de `PUT /api/tenant/settings`.

---

## 🧪 4. Plan de Verificación y Testing

### 1. Tests Unitarios Backend
```bash
npm test
```
- Verificar que las 59 suites de tests pasen al 100% en verde.

### 2. Compilación del Frontend
```bash
npm --prefix client run build
```
- Asegurar cero errores de TypeScript y empaquetado Vite.

### 3. Verificación Manual Integral
1. Ingresar como vendedor en `http://localhost:5173/channels`.
2. Modificar la configuración a "Solo Reclamos" y guardar.
3. Disparar una simulación de pregunta desde `/demo` o la API ➔ Verificar que **NO** suene ni aparezca en la campana.
4. Disparar una simulación de reclamo ➔ Verificar que aparezca el badge en la campana, suene el chime y se agregue a la lista.
5. Hacer clic en la notificación ➔ Comprobar que redirige a `/claims` y reduce el contador de no leídas.
