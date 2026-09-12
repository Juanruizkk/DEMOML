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

> ℹ️ **Nota sobre usuarios de test de MELI:** Expiran a los 60 días sin actividad. Si necesitás regenerarlos, podés crearlos desde la API de MELI:
> ```powershell
> Invoke-RestMethod -Method Post -Uri "https://api.mercadolibre.com/users/test_user" `
>   -Headers @{ "Authorization" = "Bearer $TU_TOKEN_REAL"; "Content-Type" = "application/json" } `
>   -Body '{"site_id":"MLA"}'
> ```

---

## 6. 🔄 Flujos de Uso

1. **Onboarding de un nuevo cliente:** Entrar a `http://localhost:3000/onboarding.html`, registrar una cuenta y hacer clic en *"Conectar con Mercado Libre"*.
2. **Operación y Aprobador Live:** Entrar a `http://localhost:3000/` para ver las preguntas entrantes, simular escenarios y usar el aprobador WhatsApp.
3. **Control y Monitoreo:** Entrar a `http://localhost:3000/admin.html` para ver métricas globales, pausar/activar tiendas y forzar refrescos de tokens OAuth.
