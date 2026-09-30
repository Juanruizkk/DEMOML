# Seguridad — Tareas Pendientes

Fixes completados el 2026-09-15. Los siguientes puntos quedaron pendientes por requerir información externa o decisiones de infraestructura.

---

## Pendiente 1 — Verificación de firma en Webhooks

**Prioridad:** Alta  
**Afecta:** `/webhook/ml`, `/webhook/telegram`

### El problema

Cualquier persona en internet puede hacer un `POST` a estos endpoints con datos inventados. El sistema los procesaría como si fueran legítimos, lo que permitiría inyectar preguntas, reclamos o eventos falsos.

### La solución

MercadoLibre y Telegram firman cada request con una clave secreta compartida (HMAC). El server debe verificar esa firma antes de procesar el payload. Si no coincide → descartar el request con 401.

### Para implementarlo se necesita

- **MercadoLibre:** Activar la firma de webhooks en el [panel de desarrolladores de ML](https://developers.mercadolibre.com.ar/) y copiar el `secret` generado como variable de entorno `ML_WEBHOOK_SECRET`.
- **Telegram:** El bot de Telegram usa un `secret_token` que se configura al registrar el webhook con `setWebhook`. Guardar ese valor como `TELEGRAM_WEBHOOK_SECRET`.

### Implementación (una vez disponibles los secrets)

Agregar en `WebhookController.ts` y `TelegramWebhookController.ts` una verificación HMAC-SHA256 del header `x-signature` antes de llamar a los use cases.

---

## Pendiente 2 — Token JWT expuesto en URL (OAuth callback)

**Prioridad:** Media  
**Afecta:** Flujo OAuth de MercadoLibre → `AuthController.meliOAuthCallback`

### El problema

Al terminar el flujo OAuth, el servidor redirige a:

```
/onboarding.html?status=connected&token=eyJhbGci...JWT_COMPLETO...
```

El JWT queda visible en la URL, lo que significa que:
- Queda guardado en el historial del browser del usuario.
- Queda registrado en logs de servidores intermedios (Nginx, proxies, CDN).
- Puede filtrarse via el header `Referer` si la página carga recursos externos.

### La solución ideal

Reemplazar el token en la URL por una **cookie HttpOnly + Secure + SameSite=Strict**. El frontend lee la sesión desde la cookie en lugar del query param.

### Bloqueante

Requiere HTTPS y un dominio propio configurado. Las cookies `Secure` no funcionan en HTTP. Implementar cuando el dominio de producción esté definido.

### Mitigación temporal (ya aplicada)

El token tiene expiración de 7 días. No hay otra mitigación hasta tener HTTPS.

---

## Estado general de seguridad

| Fecha | Score estimado | Notas |
|-------|---------------|-------|
| 2026-09-15 (antes) | ~48/100 | Primer scan |
| 2026-09-15 (después) | ~72/100 | Rate limiting, auth obligatoria, error sanitization, JWT secret, Host Header Injection |
| Pendiente | ~85/100 | Al completar los 2 puntos de arriba + CORS con dominio real |
