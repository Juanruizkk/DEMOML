# 👥 Usuarios y Credenciales del Sistema

Este documento recopila todos los usuarios, credenciales, roles y cuentas de prueba configuradas en el ecosistema de **MELI AI Assistant**, tanto a nivel de la plataforma local como en el entorno **Sandbox de Mercado Libre / Mercado Pago**.

---

## 1. 🔐 Usuarios de la Plataforma (MELI AI Assistant)

Estos usuarios gestionan la aplicación, paneles de administración, portal de clientes y demostraciones en vivo.

| Rol | Nombre | Email / Usuario | Contraseña por defecto | Seller ID Asociado | URL / Acceso | Permisos & Alcance |
|---|---|---|---|---|---|---|
| **`super_admin`** | Super Admin | `admin@melibot.com` | `Admin123456!` | *Ninguno (Global)* | [`/admin.html`](http://localhost:3000/admin.html) | Control total, métricas globales, gestión de tenants y refresco de tokens OAuth. |
| **`demo`** | Demo User | `demo@melibot.com` | `Demo123456!` | `3680586616` | [`/demo`](http://localhost:3000/demo) | Acceso de solo lectura y simulación de preguntas/reclamos para reuniones comerciales. |
| **`tenant`** | Tienda de Prueba | `test@test.com` | `Test123456!` | `3274140366` | [`/login`](http://localhost:5173/login) | Panel exclusivo del vendedor, configuración de IA, prompts y vinculación OAuth. |
| **`tenant`** | Tienda Vendedor 2 | `test2@test.com` | `Test123456!` | `3680586616` | [`/login`](http://localhost:5173/login) | Panel exclusivo del vendedor asociado al seller ID de demo. |

> 💡 **Nota de Inicialización:** Los usuarios `super_admin` y `demo` se crean automáticamente al arrancar el servidor (`npm run dev`) si no existen previamente en la base de datos SQLite.

---

## 2. 🛍️ Cuentas de Prueba Mercado Libre (DevCenter Sandbox)

Cuentas generadas a través del DevCenter de Mercado Libre Argentina (`MLA`) para simular el ciclo de vida completo de compras, preguntas pre-venta y reclamos post-venta.

| Rol en Prueba | User ID | Nickname | Password | Función / Uso |
|---|---|---|---|---|
| **Vendedor (Seller)** | `3680586616` | `TESTUSER4327702539223624795` | `QFxIljwqcj` | Cuenta titular de las publicaciones donde responde el bot. |
| **Comprador (Buyer)** | `3677130936` | `TESTUSER2533156973119126771` | `0PZfM1kGU1` | Cuenta utilizada para hacer preguntas, compras y abrir reclamos. |

> ⚠️ **Importante sobre Sandbox de MELI:** Los usuarios de prueba expiran a los 60 días sin actividad. Si se requiere generar un nuevo usuario de test, podés ejecutar:
> ```powershell
> Invoke-RestMethod -Method Post -Uri "https://api.mercadolibre.com/users/test_user" `
>   -Headers @{ "Authorization" = "Bearer $TU_TOKEN_REAL"; "Content-Type" = "application/json" } `
>   -Body '{"site_id":"MLA"}'
> ```

### 2.1 Publicaciones Activas para Pruebas (Seller 3680586616)

| Producto | Item ID | Categoría | Precio | Enlace a Publicación |
|---|---|---|---|---|
| **Cafetera Oster Prima Latte** | `MLA2087991267` | Electrodomésticos | $185.000 | [Ver en MELI](http://articulo.mercadolibre.com.ar/MLA-2087991267-cafetera-oster-prima-latte-roja-bvstem6603r-_JM) |
| **Teclado Mecánico Redragon Kumara** | `MLA3946551378` | Computación / Gaming | $52.000 | [Ver en MELI](http://articulo.mercadolibre.com.ar/MLA-3946551378-teclado-redragon-kumara-k552-switch-azul-teclado-de-color-negro-_JM) |
| **Smartwatch Haylou LS12** | `MLA3946551334` | Relojes / Smart | $68.000 | [Ver en MELI](http://articulo.mercadolibre.com.ar/MLA-3946551334-smartwatch-haylou-ls12-rs4-_JM) |
| **Termo Stanley Classic 1L** | `MLA2087991273` | Camping / Bazar | $79.000 | [Ver en MELI](http://articulo.mercadolibre.com.ar/MLA-2087991273-termo-stanley-classic-tapon-1l-1l-negroliso-negro-_JM) |
| **Mouse Gamer Logitech G203** | `MLA2087991281` | Computación / Gaming | $32.000 | [Ver en MELI](http://articulo.mercadolibre.com.ar/MLA-2087991281-mouse-gamer-gamer-logitech-gg-series-g203-lightsync-g203-white-_JM) |

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
