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

### 2. Casos de Uso y Templates
1. **Verificación / Conexión**: Comprobación inicial de integración con Resend.
2. **Preguntas que requieren revisión humana**: Notificación con producto, pregunta del comprador, respuesta sugerida por IA y botón directo al portal.
3. **Reclamos con SLA crítico (< 12hs)**: Notificación urgente de vencimiento para proteger la reputación en Mercado Libre.
4. **Activación de Cuenta / Invitación de Tenant**: Bienvenida y enlace seguro para activar la cuenta de vendedor y conectar Mercado Libre.
5. **Restablecimiento de Contraseña**: Enlace seguro con tiempo de expiración para recuperación de clave.

### 3. Ejecución del Suite de Prueba
Para disparar todos los emails de prueba a tu cuenta registrada:
```powershell
npx tsx scripts/send-test-emails.ts
```

### 4. Modo Sandbox vs Producción
* **Sandbox**: Remitente `onboarding@resend.dev` (envía únicamente al email con el que te registraste en Resend, sin necesidad de configurar DNS).
* **Producción**: Remitente de tu dominio propio (ej: `alertas@tudominio.com`) previa verificación de DKIM, SPF y DMARC en Resend.
