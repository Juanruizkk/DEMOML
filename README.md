# 🤖 MELI AI Assistant — Auto-Responder Inteligente para Mercado Libre

Plataforma SaaS Multi-Tenant para la **automatización inteligente de respuestas pre-venta en Mercado Libre Argentina**, construida con **Clean Architecture**, **TypeScript**, **Fastify**, inferencia **LLM con Structured Outputs** y moderación determinística anti-sanciones.

---

## 🌟 Características Principales

* ⚡ **Auto-Respuesta en Tiempo Real**: Procesamiento y publicación automática en ~1-2 segundos.
* 🛡️ **Blindaje Determinístico de Moderación**: Filtros regex que interceptan teléfonos, emails, enlaces y pedidos de contacto ilegal antes de publicar.
* 👥 **Aprobación Humana / Copiloto**: Preguntas sobre negociación, descuentos o casos complejos pasan a la cola de revisión o al simulador de WhatsApp.
* 🏢 **Arquitectura Multi-Tenant Nativa**: Aislamiento estricto de preguntas, publicaciones y tokens por vendedor (`seller_id`).
* 🔐 **Seguridad JWT & Roles**: Control de acceso granular para `super_admin` y `tenant`.
* 👑 **Dashboard de Super Admin**: Métricas consolidadas, semáforos de salud de tokens OAuth (🟢/🟡/🔴) y control remoto de clientes.
* 🚀 **Onboarding Self-Service**: Wizard de 3 pasos para registro autónomo y vinculación OAuth con Mercado Libre.

---

## 🛠️ Stack Tecnológico

| Capa | Tecnologías |
|---|---|
| **Backend & API** | Node.js, TypeScript, Fastify |
| **Inteligencia Artificial** | LangChain.js, Groq / OpenAI / Anthropic con Structured Output (`zod`) |
| **Base de Datos** | SQLite (`better-sqlite3`) en modo WAL con migraciones automáticas |
| **Tiempo Real** | Server-Sent Events (SSE) nativo multi-canal |
| **Testing** | Vitest (100% de cobertura en dominio, auth y casos de uso) |
| **Frontend** | Vanilla JS, CSS3 Modern Glassmorphism, Responsive & Dark Theme |

---

## 🚀 Inicio Rápido

1. **Instalar dependencias:**
   ```bash
   npm install
   cp .env.example .env
   ```

2. **Ejecutar tests:**
   ```bash
   npm test
   ```

3. **Iniciar en modo desarrollo:**
   ```bash
   npm run dev
   ```

---

## 🌐 Módulos y Accesos

| Módulo | Ruta | Descripción |
|---|---|---|
| **Panel Operativo Live** | `/` | Consola en vivo de preguntas pre-venta y chatbot WhatsApp. |
| **Super Admin Dashboard** | `/admin.html` | Panel de control global (`admin@melibot.com` / `Admin123456!`). |
| **Onboarding Vendedores** | `/onboarding.html` | Wizard de registro y vinculación OAuth para clientes. |
| **Health Check** | `/api/health` | Estado del servidor, SQLite y credenciales de Mercado Libre. |

---

## 📚 Documentación Técnica

* [👥 Usuarios y Credenciales](docs/USERS.md)
* [🛍️ Publicaciones y Catálogo Mercado Libre](docs/ML/PUBLICACIONES_Y_CATALOGO.md)
* [📖 Referencia de API](docs/API_REFERENCE.md)
* [🏛️ Arquitectura del Sistema](docs/ARCHITECTURE.md)
* [🛠️ Guía de Setup y Runbook](docs/SETUP.md)
* [🎯 Fase 1 — Cimientos Clean Architecture](docs/WALKTHROUGH_PHASE_1_FOUNDATION.md)
* [🎯 Fase 2 — Autenticación & Roles JWT](docs/WALKTHROUGH_PHASE_2_AUTH_AND_ROLES.md)
* [🎯 Fase 3 — Backend Super Admin](docs/WALKTHROUGH_PHASE_3_SUPER_ADMIN.md)
* [🎯 Fase 5 — Onboarding & Flujo OAuth](docs/WALKTHROUGH_PHASE_5_ONBOARDING.md)
* [🎯 Fase 6 — Frontend Super Admin](docs/WALKTHROUGH_PHASE_6_SUPERADMIN_FRONTEND.md)
