# 🤖 Asistente de Telegram & Bot de Alertas — MELI AI Assistant

El módulo de Telegram permite a los vendedores de Mercado Libre recibir alertas en tiempo real, responder preguntas con botones interactivos en 1-click y consultar el estado de su negocio en lenguaje natural.

---

## 📑 Documentación Detallada

* 📖 **[Guía Completa del Asistente & Tools en Telegram](file:///c:/JUAN%20RUIZ/Trabajos/DEMOML/docs/telegram/TELEGRAM_TOOLS_GUIDE.md)**: Arquitectura, catálogo de herramientas (`get_pending_questions`, `get_claims`, `get_claim_detail`, `get_recent_alerts`, `get_store_metrics`), fallback determinístico y suite de pruebas.

---

## 🚀 Métodos de Vinculación de Tiendas (Multi-Tenant)

### 1. Enlace Automático en 1-Click (Deep Link) — *Recomendado*
Cada tienda cuenta con un enlace directo:
```
https://t.me/<TELEGRAM_BOT_USERNAME>?start=tenant_<SELLER_ID>
```
Al hacer clic en **"Conectar Telegram"** desde el panel web (`/channels`), se abre Telegram y al presionar **Iniciar**, el bot vincula automáticamente el `chat_id` al `seller_id` del vendedor.

### 2. Vinculación Manual (Chat ID)
1. El vendedor abre el bot y envía `/start`.
2. El bot le devuelve su `Chat ID` (ej: `1151233818`).
3. El vendedor copia ese número y lo guarda en el panel de control bajo **Canales & Alertas**.

---

## ⚡ Catálogo de Herramientas del Asistente

| Herramienta | Qué hace | Botones Interactivos |
|---|---|---|
| **`get_pending_questions`** | Trae preguntas en revisión humana. | `[✅ Aprobar]` `[❌ Rechazar]` |
| **`get_claims`** | Lista reclamos abiertos y urgencias de SLA. | `[🔍 Detalle Reclamo]` |
| **`get_claim_detail`** | Detalla comprador, motivo y plazo del reclamo. | `[✅ Confirmar Lectura]` |
| **`get_recent_alerts`** | Muestra los últimos eventos y moderaciones. | — |
| **`get_store_metrics`** | Resumen de % de auto-respuesta y actividad. | — |

---

## 🧪 Pruebas de Verificación

```powershell
npx vitest run src/tests/TelegramAssistantService.test.ts src/tests/HandleTelegramWebhookUseCase.test.ts
```
