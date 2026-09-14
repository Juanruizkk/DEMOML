# 🛠️ Guía de Setup y Runbook: MELI AI Assistant

Guía paso a paso para configurar, desplegar y operar la plataforma **MELI AI Assistant** en entornos locales y de desarrollo.

---

## 1. 📋 Prerrequisitos

* **Node.js**: v20.x o v22+
* **npm**: v10+
* **ngrok**: Cuenta gratuita con dominio estático reservado (o túnel dinámico).
* **Mercado Libre Developers**: Aplicación creada en el [DevCenter de Mercado Libre](https://developers.mercadolibre.com.ar/devcenter).
* **Proveedor de LLM**: API Key de Groq (recomendada por latencia y costo cero), OpenAI o Anthropic.

---

## 2. ⚙️ Instalación y Configuración

1. **Clonar e instalar dependencias:**
   ```powershell
   git clone <repo>
   cd DEMOML
   npm install
   ```

2. **Crear archivo de entorno:**
   ```powershell
   copy .env.example .env
   ```

3. **Variables requeridas en `.env`:**
   ```ini
   PORT=3000
   JWT_SECRET=super_secret_jwt_key_random_value_123456
   AUTO_ANSWER_ENABLED=true

   # Credenciales de Mercado Libre DevCenter
   ML_CLIENT_ID=4321332576904880
   ML_CLIENT_SECRET=tu_client_secret_aqui
   ML_REDIRECT_URI=https://tu-dominio.ngrok-free.dev/oauth/callback
   ML_SELLER_ID=3680586616

   # Proveedor de Inteligencia Artificial
   LLM_PROVIDER=groq
   GROQ_API_KEY=gsk_tu_api_key_aqui
   LLM_MODEL=openai/gpt-oss-120b
   ```

---

## 3. 🌐 Levantar el Túnel ngrok

Mercado Libre requiere una URL pública HTTPS para recibir webhooks de preguntas y completar el flujo OAuth:

```powershell
ngrok http --domain=tu-dominio.ngrok-free.dev 3000
```

En el **DevCenter de Mercado Libre**, configurá:
* **Redirect URIs**: `https://tu-dominio.ngrok-free.dev/oauth/callback`
* **Notificaciones Callback URL**: `https://tu-dominio.ngrok-free.dev/webhook/ml` con el tópico `questions` tildado.

---

## 4. 🚀 Iniciar el Servidor

```powershell
# Modo Desarrollo (con recarga automática y TypeScript en caliente)
npm run dev

# Ejecutar suite de pruebas unitarias
npm test

# Compilar proyecto TypeScript a JavaScript
npm run build
```

Al iniciar, verás en consola:
```
🚀 [Clean Architecture] MELI AI Assistant corriendo en http://localhost:3000
   Panel Live:       http://localhost:3000
   Super Admin:      http://localhost:3000/admin.html
   Onboarding:       http://localhost:3000/onboarding.html
   OAuth login:      http://localhost:3000/oauth/login
   Health check:     http://localhost:3000/api/health
```

---

## 5. 🔑 Credenciales del Sistema
> 💡 *Para una referencia exhaustiva de roles, tenants y cuentas de prueba, consultá [docs/USERS.md](file:///c:/JUAN%20RUIZ/Trabajos/DEMOML/docs/USERS.md).*

### 5.1 Super Administrador (Acceso Global)
El usuario Super Admin se inicializa automáticamente al primer inicio:
* **URL:** `http://localhost:3000/admin.html`
* **Email:** `admin@melibot.com`
* **Contraseña:** `Admin123456!`

### 5.2 Usuarios de Prueba Mercado Libre (Sandbox)
| Rol | User ID | Nickname | Password |
|---|---|---|---|
| **Vendedor** | `3680586616` | `TESTUSER4327702539223624795` | `QFxIljwqcj` |
| **Comprador** | `3677130936` | `TESTUSER2533156973119126771` | `0PZfM1kGU1` |

### 5.3 Tarjetas de Crédito de Prueba (Sandbox)

Usá estas tarjetas logueado como el **usuario comprador** para simular pagos aprobados. El nombre del titular controla el resultado:

| Resultado | Nombre titular |
|---|---|
| Aprobado | `APRO APRO` |
| Pendiente (revisión) | `CONT CONT` |
| Rechazado - fondos insuficientes | `FUND FUND` |
| Rechazado - código de seguridad inválido | `SECU SECU` |

| Red | Número | CVV | Vencimiento |
|---|---|---|---|
| Visa | `4509 9535 6623 3704` | `123` | `11/25` |
| Mastercard | `5031 7557 3453 0604` | `123` | `11/25` |
| American Express | `3711 803032 57522` | `1234` | `11/25` |

> ℹ️ **No uses Pago Fácil / Rapipago en tests** — son pagos en efectivo y quedan en estado `pending` indefinidamente en sandbox. Usá tarjeta para obtener aprobación inmediata.

> ℹ️ **Nota sobre usuarios de test de MELI:** Expiran a los 60 días sin actividad. Si necesitás regenerarlos, podés crearlos desde la API de MELI:
> ```powershell
> Invoke-RestMethod -Method Post -Uri "https://api.mercadolibre.com/users/test_user" `
>   -Headers @{ "Authorization" = "Bearer $TU_TOKEN_REAL"; "Content-Type" = "application/json" } `
>   -Body '{"site_id":"MLA"}'
> ```

### 5.4 Usuario Demo (Presentaciones)

Usuario pre-seeded para usar en reuniones con clientes potenciales. Accede a `/demo` y tiene visibilidad del tenant de prueba.

* **URL:** `http://localhost:3000/demo`
* **Email:** `demo@melibot.com`
* **Contraseña:** `Demo123456!`
* **Seller vinculado:** `TESTUSER4327702539223624795` (sellerId: `3680586616`)
* **Rol:** `demo` — puede ver datos del tenant de prueba pero no puede acceder al panel de admin ni al portal de otros tenants

> Antes de una presentación, loguear y hacer clic en **"Preparar Demo"** para poblar preguntas y reclamos ficticios en el panel.

---

## 6. 🔄 Flujos de Uso

1. **Onboarding de un nuevo cliente:** Entrar a `http://localhost:3000/onboarding.html`, registrar una cuenta y hacer clic en *"Conectar con Mercado Libre"*.
2. **Operación y Aprobador Live:** Entrar a `http://localhost:3000/` para ver las preguntas entrantes, simular escenarios y usar el aprobador WhatsApp.
3. **Control y Monitoreo:** Entrar a `http://localhost:3000/admin.html` para ver métricas globales, pausar/activar tiendas y forzar refrescos de tokens OAuth.

---

## 7. 📚 Documentación Adicional & Guías de Canales

* 📧 **[Guía de Integración de Resend (Alertas por Email)](file:///c:/JUAN%20RUIZ/Trabajos/DEMOML/docs/resend/RESEND_INTEGRATION_GUIDE.md)**: Configuración de API Key, templates HTML responsive y alertas por correo para preguntas y reclamos urgentes.
* 🤖 **[Guía del Asistente & Tools en Telegram](file:///c:/JUAN%20RUIZ/Trabajos/DEMOML/docs/telegram/TELEGRAM_TOOLS_GUIDE.md)**: Catálogo de herramientas conversacionales (`get_pending_questions`, `get_claims`, `get_claim_detail`, `get_recent_alerts`, `get_store_metrics`) y flujo de botones interactivos.
* 🔑 **[Referencia de Usuarios y Credenciales](file:///c:/JUAN%20RUIZ/Trabajos/DEMOML/docs/USERS.md)**: Lista de usuarios de prueba, tenants y claves maestras.
