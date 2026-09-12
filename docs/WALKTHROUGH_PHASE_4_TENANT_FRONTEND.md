# Walkthrough: Fase 4 — Frontend del Tenant (Portal del Vendedor)

En esta fase se construyó el portal web exclusivo para clientes/vendedores (`/tenant.html`), permitiendo que cada vendedor gestione sus preguntas, configure el tono de la inteligencia artificial, edite el prompt de su negocio y defina su número de WhatsApp para alertas.

---

## 🎯 Objetivos Cumplidos

1. **Portal del Vendedor (`public/tenant.html`, `public/tenant.css`, `public/tenant.js`)**:
   - **Autenticación & Sesión**: Login y registro para inquilinos con token JWT.
   - **Pestaña 1 (Mis Preguntas)**: Visualización exclusiva de las preguntas pertenecientes a la tienda (`seller_id`), con filtros por estado (*Pendientes de revisión*, *Auto-respondidas*, *Todas*), editor en vivo de respuestas sugeridas y botones de aprobación/publicación en 1 clic.
   - **Pestaña 2 (Configuración de IA)**:
     - Toggle de Auto-Respuesta ON/OFF.
     - Selector de Tono (*Rioplatense Cercano*, *Formal & Profesional*, *Conciso & Directo*).
     - Slider de Umbral de Confianza (`60%` a `95%`).
     - Editor de Instrucciones de Negocio / FAQ (Prompt personalizado).
   - **Pestaña 3 (WhatsApp & Alertas)**:
     - Campo de configuración de número de celular (`whatsappAlertPhone`) para recibir alertas reales vía Meta Cloud API.
   - **Pestaña 4 (Conexión Mercado Libre)**:
     - Semáforo de salud del token OAuth y botón de reconexión directa.
2. **Endpoints Backend Fastify**:
   - `GET /api/tenant/settings`: Retorna la configuración actual del tenant autenticado.
   - `PUT /api/tenant/settings`: Guarda en base de datos las preferencias del vendedor.
3. **Preservación de Vistas de Demostración**:
   - La vista dividida de demo (`public/index.html`) se mantiene 100% intacta para demostraciones comerciales en vivo.
4. **Navegación Unificada**:
   - Accesos directos entre `◫ Demo Live`, `🏪 Portal Vendedor`, `🔗 Conectar Tienda` y `👑 Super Admin`.
