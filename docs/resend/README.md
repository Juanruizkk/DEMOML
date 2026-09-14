# 📧 Documentación de Resend & Alertas por Email

Bienvenido a la documentación de integración de **Resend** en **MELI AI Assistant**.

Para consultar la guía paso a paso completa con ejemplos de código, templates HTML, variables de entorno y arquitectura limpia, accedé a:

👉 **[Guía Completa de Integración: Resend & Alertas por Email](file:///c:/JUAN%20RUIZ/Trabajos/DEMOML/docs/resend/RESEND_INTEGRATION_GUIDE.md)**

---

## ⚡ Resumen Rápido

### 1. Variables en `.env`
```ini
RESEND_API_KEY=re_123456789...
EMAIL_FROM=MELI AI Assistant <onboarding@resend.dev>
EMAIL_ENABLED=true
```

### 2. Casos de Uso
1. **Preguntas que requieren revisión humana**: Notificación con producto, pregunta, respuesta sugerida y botón para aprobar/responder.
2. **Reclamos con SLA crítico (< 12hs)**: Notificación urgente de vencimiento de tiempo de respuesta para no afectar reputación en Mercado Libre.
3. **Email de prueba**: Verificación de conectividad desde el Portal del Tenant.

### 3. Modo Sandbox vs Producción
* **Sandbox**: Remitente `onboarding@resend.dev` (envía únicamente al email con el que te registraste en Resend, sin necesidad de configurar DNS).
* **Producción**: Remitente de tu dominio propio (ej: `alertas@tudominio.com`) previa verificación de DKIM, SPF y DMARC en Resend.
