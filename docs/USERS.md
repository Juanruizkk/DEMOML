# 👥 Usuarios y Credenciales del Sistema

Este documento recopila todos los usuarios, credenciales, roles y cuentas de prueba configuradas en el ecosistema de **MELI AI Assistant**, tanto a nivel de la plataforma local como en el entorno **Sandbox de Mercado Libre / Mercado Pago**.

---

## 1. 🔐 Usuarios de la Plataforma (MELI AI Assistant)

Estos usuarios gestionan la aplicación, paneles de administración, portal de clientes y demostraciones en vivo.

| Rol | Nombre | Email / Usuario | Contraseña por defecto | Seller ID Asociado | URL / Acceso | Permisos & Alcance |
|---|---|---|---|---|---|---|
| **`super_admin`** | Super Admin | `admin@melibot.com` | `Admin123456!` | *Ninguno (Global)* | [`/admin`](http://localhost:5173/admin) | Control total, métricas globales, gestión de tenants, toggle `multiUserEnabled` y refresco de tokens OAuth. |
| **`demo`** | Demo User | `demo@melibot.com` | `Demo123456!` | `3680586616` | [`/demo`](http://localhost:5173/demo) | Acceso de solo lectura y simulación de preguntas/reclamos para reuniones comerciales. |
| **`tenant`** | Tienda Vendedor (Titular) | `test@test.com` | `Test123456!` | `3680586616` | [`/login`](http://localhost:5173/login) | Panel oficial del vendedor Sandbox, configuración de IA, preguntas, reclamos y equipo. |
| **`tenant` (Equipo)** | Colaborador Invitado | `vendedor@...` | *Definida en activación* | `3680586616` | [`/login`](http://localhost:5173/login) | Colaborador de equipo con acceso a preguntas, reclamos y notificaciones de la tienda. |

> 💡 **Nota de Inicialización:** Los usuarios `super_admin` y `demo` se crean automáticamente al arrancar el servidor (`npm run dev`) si no existen previamente en la base de datos SQLite.
>
> 👥 **Módulo Multi-Usuario & Equipo:** Cuando el Super Admin activa el permiso `multiUserEnabled` en una tienda, el titular puede invitar colaboradores desde [`/team`](http://localhost:5173/team). Cada colaborador recibe un correo vía Resend con un token para definir su contraseña y acceder con su cuenta propia al panel de la tienda.

---

## 2. 🛍️ Cuentas de Prueba Mercado Libre (DevCenter Sandbox)

Cuentas generadas a través del DevCenter de Mercado Libre Argentina (`MLA`) para simular el ciclo de vida completo de compras, preguntas pre-venta y reclamos post-venta.

| Rol en Prueba | User ID | Nickname | Password | Email | Función / Uso |
|---|---|---|---|---|---|
| **Vendedor (Seller)** | `3683312128` | `TESTUSER4803001026556945644` | `VXWe8yHVsI` | `test_user_4803001026556945644@testuser.com` | Cuenta titular de las publicaciones donde responde el bot. |
| **Comprador (Buyer)** | `3693647110` | `TESTUSER1491864555385308323` | `ZMHT5PqWv8` | `test_user_1491864555385308323@testuser.com` | Cuenta utilizada para hacer preguntas, compras y abrir reclamos. |

> ⚠️ **Importante sobre Sandbox de MELI:** Los usuarios de prueba expiran a los 60 días sin actividad. Si se requiere generar nuevos usuarios de test, ejecutá:
> ```powershell
> npm run meli:test-users
> ```
> O mediante PowerShell directo contra la API:
> ```powershell
> Invoke-RestMethod -Method Post -Uri "https://api.mercadolibre.com/users/test_user" `
>   -Headers @{ "Authorization" = "Bearer $TU_TOKEN_REAL"; "Content-Type" = "application/json" } `
>   -Body '{"site_id":"MLA"}'
> ```

### 2.1 Publicaciones Directas Activas para Pruebas (Vendedor Test 3683312128 / TESTUSER4803001026556945644)

Estas publicaciones están **activas en la cuenta del Vendedor de Test**, listas para recibir preguntas y compras del Comprador de Test sin restricciones de Sandbox:

| Producto | Item ID | Precio | Enlace Directo |
|---|---|---|---|
| **Cafetera Espresso Oster Prima Latte** | `MLA2101482683` | $185.000 | [Ver Cafetera en MELI](http://articulo.mercadolibre.com.ar/MLA-2101482683-cafetera-espresso-oster-prima-latte-roja-19-bares-_JM) |
| **Teclado Mecánico Gamer Redragon K552** | `MLA3964723090` | $52.000 | [Ver Teclado en MELI](http://articulo.mercadolibre.com.ar/MLA-3964723090-teclado-mecanico-gamer-redragon-k552-switch-blue-_JM) |
| **Termo Acero Inox Lumilagro 1L** | `MLA2101515609` | $38.000 | [Ver Termo en MELI](http://articulo.mercadolibre.com.ar/MLA-2101515609-termo-acero-inox-lumilagro-1l-tapon-cebador-_JM) |

---

## 3. 💳 Tarjetas de Prueba para Compradores (Mercado Pago Sandbox)

Al loguearse con la cuenta **Comprador (`3677130936`)**, utilizar estas tarjetas para simular pagos inmediatos en las publicaciones del vendedor:

| Resultado Esperado | Nombre del Titular | Número de Tarjeta | Código (CVV) | Vencimiento |
|---|---|---|---|---|
| **Aprobado** | `APRO APRO` | `4509 9535 6623 3704` (Visa) | `123` | `11/25` |
| **Pendiente (Revisión)** | `CONT CONT` | `5031 7557 3453 0604` (Mastercard) | `123` | `11/25` |
| **Rechazado (Fondos insuficientes)** | `FUND FUND` | `3711 803032 57522` (Amex) | `1234` | `11/25` |
| **Rechazado (Código inválido)** | `SECU SECU` | `4509 9535 6623 3704` (Visa) | `123` | `11/25` |

---

## 4. 🤖 Canales y Notificaciones (Telegram Bot)

Credenciales del bot de Telegram integrado para la notificación y aprobación en tiempo real de preguntas dudosas y reclamos:

* **Bot Username:** `@demomelibot`
* **Token:** Configurado en variable `TELEGRAM_BOT_TOKEN` en `.env`.
* **Deep Link de Vinculación:** `https://t.me/demomelibot?start=tenant_3680586616`

---

## 5. 🏪 Tenants Registrados en la Base de Datos Local (`meli_bot.db`)

Listado de tiendas conectadas actualmente en la base de datos:

| Seller ID | Nickname | Email de Contacto | Auto-Respuesta | Notificaciones Activas |
|---|---|---|---|---|
| `3680586616` | `TESTUSER4327702539223624795` | `test_user_4327702539223624795@testuser.com` | `true` | Telegram (`Chat ID: 1151233818`) |
| `3274140366` | `CBDFCHEAG65075` | `pruebatest4712@gmail.com` | `true` | — |

---

## 6. ⚙️ Variables de Entorno de Usuarios (`.env`)

Valores configurables para sobreescribir usuarios por defecto o credenciales:

```ini
# Super Admin
SUPER_ADMIN_EMAIL=admin@melibot.com
SUPER_ADMIN_PASSWORD=Admin123456!
SUPER_ADMIN_NAME="Super Admin"

# Demo User
DEMO_EMAIL=demo@melibot.com
DEMO_PASSWORD=Demo123456!
DEMO_NAME="Demo User"
DEMO_SELLER_ID=3680586616

# Mercado Libre Seller Activo
ML_SELLER_ID=3680586616
```
