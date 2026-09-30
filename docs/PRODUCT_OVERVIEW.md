# MELI AI Assistant — Documento de Producto

**Versión:** 1.0 · **Fecha:** Septiembre 2026

---

## ¿Qué es MELI AI Assistant?

MELI AI Assistant es una plataforma SaaS que automatiza la atención pre-venta y post-venta de vendedores de Mercado Libre. Cuando un comprador hace una pregunta en una publicación, la IA la lee, entiende el contexto del producto y responde automáticamente en segundos. Cuando hay un reclamo abierto con un plazo de resolución próximo a vencer, el sistema alerta al vendedor por WhatsApp, Telegram o email con el tiempo restante y las acciones disponibles.

El vendedor opera desde un panel web en tiempo real. Cada tienda tiene su propio acceso aislado. El equipo de ventas o de soporte del cliente puede incorporar colaboradores adicionales sin compartir contraseñas.

---

## Problema que resuelve

Los vendedores medianos y grandes de Mercado Libre reciben docenas (o cientos) de preguntas por día. Responder tarde o mal afecta directamente la tasa de conversión y la reputación de la tienda. Además, los reclamos post-venta tienen plazos de mediación estrictos de Mercado Libre: un reclamo no atendido en tiempo puede derivar en penalización automática.

La mayoría de los vendedores hoy responden a mano, tarde, o directamente no responden. MELI AI Assistant elimina ese cuello de botella.

---

## Funcionalidades del Producto

### 1. Respuesta Automática de Preguntas Pre-Venta

El sistema recibe las preguntas de compradores en tiempo real mediante los webhooks de Mercado Libre. Para cada pregunta:

1. Recupera la ficha técnica de la publicación (título, precio, stock, atributos, condición).
2. Genera una respuesta contextual usando un modelo de lenguaje (LLM) con el tono configurado por el vendedor.
3. Aplica un filtro de moderación determinístico que bloquea respuestas que incluyan números de teléfono, WhatsApp camuflado, links externos o intentos de cobro por fuera de la plataforma (causas de sanción directa en ML).
4. Si la confianza del modelo supera el umbral configurado y pasa la moderación: publica la respuesta automáticamente en Mercado Libre.
5. Si no supera el umbral o la moderación la bloquea: la envía a la cola de revisión humana y notifica al vendedor.

**Tiempo de respuesta end-to-end: 1-3 segundos** desde que el comprador pregunta hasta que recibe la respuesta.

---

### 2. Cola de Revisión y Aprobación Humana

Las preguntas que no se responden automáticamente aparecen en el panel del vendedor con:
- El texto de la pregunta.
- La respuesta sugerida por la IA.
- El motivo por el que requiere revisión (baja confianza, moderación bloqueada, etc.).

El vendedor puede:
- **Aprobar** la sugerencia con un clic → se publica en Mercado Libre.
- **Editar** el texto y luego aprobar.
- **Rechazar** la pregunta (no responder).

Esta aprobación se puede hacer desde el panel web, desde WhatsApp o desde Telegram.

---

### 3. Gestión de Reclamos Post-Venta

El sistema también recibe y procesa los webhooks de reclamos de Mercado Libre. Para cada reclamo:

- Consulta el detalle completo del reclamo en la API de Mercado Libre (tipo, motivo, comprador, orden, acciones disponibles).
- Calcula la urgencia según el tiempo restante hasta el vencimiento del SLA:
  - **Crítico** (≤ 12 horas): alerta inmediata multicanal.
  - **Alto** (≤ 24 horas): alerta de advertencia.
  - **Normal** (> 24 horas): notificación estándar.
- Envía la alerta al vendedor por WhatsApp y/o Telegram con botones de acción.
- Muestra el reclamo en el panel web con badge de urgencia y cuenta regresiva.

**Tipos de reclamo soportados:** devolución, mediación por no recibido, mediación por diferente al anunciado, cancelación de compra.

---

### 4. Notificaciones Multicanal

Cuando hay una pregunta pendiente o un reclamo urgente, el vendedor recibe la alerta por los canales que configure:

| Canal | Contenido | Acciones desde el canal |
|---|---|---|
| **WhatsApp** | Pregunta + respuesta sugerida o detalle del reclamo | Aprobar / Rechazar / Responder texto libre |
| **Telegram** | Ídem WhatsApp + herramientas de consulta en lenguaje natural | Aprobar / Rechazar / Consultar métricas |
| **Email** (Resend) | Template HTML con pregunta, respuesta sugerida, link al panel | Solo lectura (la acción se hace en el panel) |
| **Web (SSE)** | Notificación push en el panel abierto en el navegador | Todas las acciones |

El vendedor puede configurar qué canales quiere activar desde el panel de configuración. No es necesario activar todos.

---

### 5. Bot de Telegram con Asistente IA

Además de las alertas, el vendedor puede **consultar el estado de su tienda en lenguaje natural** desde Telegram. El bot tiene acceso a herramientas de negocio:

| Herramienta | Descripción |
|---|---|
| `get_pending_questions` | Lista preguntas pendientes de revisión con botones para aprobar/rechazar. |
| `get_claims` | Lista reclamos abiertos con urgencia y SLA restante. |
| `get_claim_detail` | Detalla comprador, motivo, acciones disponibles y tiempo restante de un reclamo. |
| `get_recent_alerts` | Muestra los últimos eventos y moderaciones del día. |
| `get_store_metrics` | Resumen de actividad: tasa de auto-respuesta, volumen total y distribución de intenciones. |

Ejemplos de consultas en lenguaje natural:
- *"¿Cuántas preguntas respondió el bot hoy?"*
- *"¿Tengo reclamos urgentes?"*
- *"Mostrá los reclamos de esta semana"*

---

### 6. Panel Web del Vendedor

Interfaz web React responsive con las siguientes secciones:

**Preguntas**
- Vista en tiempo real de preguntas recibidas, separadas por estado: auto-respondidas, pendientes de revisión, aprobadas, rechazadas.
- Editor inline para modificar la respuesta sugerida antes de aprobar.
- Paginación y filtros.

**Reclamos**
- Listado de reclamos activos con badge de urgencia (Crítico / Alto / Normal), tipo de reclamo, comprador, número de orden y tiempo restante.

**Configuración de la Tienda**
- Activar/desactivar el modo de auto-respuesta.
- Ajustar el umbral de confianza mínimo para auto-publicar (0% a 100%).
- Elegir el tono de respuesta: `Casual Rioplatense`, `Formal Profesional` o `Conciso y Directo`.
- Ingresar instrucciones de negocio: texto libre que el modelo usa como contexto ("Somos una tienda de electrónica. Siempre aclarar que enviamos por Correo Argentino.").
- Configurar número de WhatsApp para alertas.
- Vincular bot de Telegram.
- Activar alertas por email.

**Equipo & Colaboradores** *(ver sección 7)*

---

### 7. Gestión de Equipo Multi-Usuario

Una tienda de Mercado Libre tiene una sola cuenta, pero puede ser atendida por múltiples vendedores o agentes de soporte.

Desde el panel, el titular de la tienda puede:
- Invitar colaboradores por email → cada uno recibe un link de activación y define su propia contraseña.
- Ver el estado de cada colaborador: Activo o Pendiente de activación.
- Revocar accesos con un clic.

Todos los colaboradores ven las mismas preguntas y reclamos de la tienda. Si dos vendedores intentan aprobar la misma pregunta al mismo tiempo, el sistema bloquea la acción duplicada y notifica que ya fue respondida.

> Esta funcionalidad se habilita por tienda desde el panel de Super Admin. Puede ofrecerse como parte de un plan superior.

---

### 8. Wizard de Onboarding

Un flujo guiado paso a paso para que los nuevos clientes se conecten solos:

1. Registro con email y contraseña.
2. Clic en *"Conectar con Mercado Libre"* → flujo OAuth oficial.
3. Mercado Libre autoriza el acceso y redirige de vuelta con el token.
4. El sistema crea la cuenta del tenant con el nickname oficial de la tienda.
5. El panel queda listo para recibir preguntas.

No requiere asistencia técnica por parte del equipo de la plataforma.

---

### 9. Panel de Super Administrador

Vista exclusiva del operador de la plataforma para gestionar todos los clientes activos:

**Métricas Globales**
- Total de preguntas procesadas, tasa de auto-respuesta, latencia promedio.
- Distribución de intenciones detectadas (stock, envíos, características, garantía, etc.).
- Tenants activos y volumen por tienda.

**Gestión de Tenants**
- Tabla con semáforo de salud del token OAuth de cada tienda (Saludable / Próximo a vencer / Expirado).
- Activar/pausar la auto-respuesta de cualquier tienda de forma remota.
- Forzar refresco del token OAuth sin intervención del vendedor.
- Configurar permisos por tienda: habilitar/deshabilitar Multi-Usuario.
- Ver el detalle de preguntas recientes y logs de auditoría de cualquier tenant.

---

## Moderación de Seguridad (Anti-Sanciones ML)

Mercado Libre sanciona o elimina cuentas de vendedores que:
- Comparten teléfonos o WhatsApp fuera de la plataforma.
- Incluyen links a sitios externos.
- Intentan cerrar ventas por fuera del marketplace.

El motor de moderación del sistema detecta estos patrones de forma determinística (no depende del LLM) usando expresiones regulares y heurísticas. Si una respuesta generada por el modelo contiene cualquiera de estos elementos, es bloqueada automáticamente y enviada a revisión humana. El vendedor nunca publica accidentalmente contenido que pueda costarle su cuenta.

---

## Configuración del LLM (Inteligencia Artificial)

El sistema soporta múltiples proveedores de modelos de lenguaje, configurables en el archivo de entorno:

| Proveedor | Variable | Estado |
|---|---|---|
| **Groq** | `GROQ_API_KEY` | Recomendado para producción — free tier generoso, latencia baja. |
| **OpenAI** | `OPENAI_API_KEY` | Soporte completo, modelos GPT-4o y superiores. |
| **Anthropic** | `ANTHROPIC_API_KEY` | Soporte completo, modelos Claude. |

**Modelo de costos LLM:**

El cliente es responsable del costo del LLM. Hay dos formas de instrumentarlo:

- **BYOK (Bring Your Own Key):** El cliente crea su propia cuenta en Groq, OpenAI o Anthropic y pega la API key en el panel. El operador no tiene ninguna exposición a costos variables.
- **Configuración asistida:** El operador crea y gestiona la cuenta del proveedor en nombre del cliente, y le factura el costo directamente. Útil para clientes sin perfil técnico.

> Groq ofrece un free tier muy generoso — la mayoría de los clientes con volumen estándar no pagarían nada de LLM en ese proveedor.

---

## Configuración de WhatsApp

El sistema soporta dos modos de operación para las alertas de WhatsApp:

### Modo A — Número de la Plataforma (Default)

El operador configura un único número de WhatsApp Business mediante la API de Meta Cloud. Los vendedores solo ingresan su número de celular en el panel. Las alertas llegan desde el número de la plataforma.

- **Onboarding del cliente:** Solo ingresar el número. Cero fricción.
- **Costo:** Meta cobra al operador por conversación iniciada. Recomendado limitar cuota mensual por tenant para proteger el margen.
- **Cuotas sugeridas por plan:**
  - Starter: 150 alertas/mes
  - Pro: 600 alertas/mes
  - Enterprise: 2.000 alertas/mes

### Modo B — Número Propio del Cliente (BYO)

El cliente configura sus propias credenciales de Meta Business (Phone Number ID + Access Token) en el panel. Las alertas salen desde su número corporativo.

- **Onboarding del cliente:** Pegar dos valores desde su cuenta de Meta. Bajo nivel de fricción para clientes técnicos.
- **Costo:** Meta cobra directamente al cliente. El operador no tiene costo de mensajería.
- **Ventaja para el cliente:** Las alertas salen con su nombre y número de negocio.

> **Estado actual:** El backend soporta ambos modos. El panel del vendedor para configurar BYO está pendiente de implementación (estimado 1-2 días).

---

## Arquitectura y Stack Tecnológico

| Componente | Tecnología |
|---|---|
| **Backend** | Node.js + TypeScript + Fastify |
| **Frontend** | React + TypeScript (Vite) |
| **Base de datos** | PostgreSQL con Drizzle ORM |
| **Autenticación** | JWT firmados con HMAC-SHA256 + scrypt para contraseñas |
| **LLM** | LangChain.js — compatible con Groq, OpenAI y Anthropic |
| **WhatsApp** | Meta Graph API v21.0 |
| **Telegram** | Telegram Bot API + asistente con Tools |
| **Email** | Resend (SDK oficial para Node.js) |
| **Notificaciones web** | Server-Sent Events (SSE) por tenant |
| **Infraestructura** | Docker + Docker Compose listo para despliegue |

La arquitectura sigue principios de **Clean Architecture / Hexagonal**: el dominio de negocio no tiene dependencias externas, cada componente externo (MELI, LLM, WhatsApp, email) está aislado detrás de una interfaz intercambiable.

---

## Seguridad y Aislamiento Multi-Tenant

- **Aislamiento por `sellerId`:** Cada vendedor solo puede ver y operar sus propias preguntas, reclamos y configuración. Es imposible que un tenant acceda a datos de otro.
- **JWT firmados:** Todos los endpoints (excepto webhooks y OAuth) requieren token válido.
- **Protección CSRF en webhooks de Meta:** Verificación de token de desafío en el handshake del webhook.
- **Mutex de token OAuth:** Evita race conditions durante la renovación simultánea de tokens cuando varios workers procesan preguntas al mismo tiempo.
- **Rate limiting:** Protección contra abuso en todos los endpoints públicos.
- **Hashing criptográfico:** Las contraseñas nunca se almacenan en texto plano — se hashean con `scrypt` y sal aleatoria.

---

## Requisitos para el Setup (por cliente)

Para que una tienda quede operativa, el vendedor necesita:

1. **Cuenta activa en Mercado Libre** con publicaciones propias.
2. **Número de celular con WhatsApp** (si quiere alertas por ese canal).
3. **Cuenta de Telegram** (si quiere el bot de alertas y consultas).

El operador de la plataforma necesita configurar (una sola vez):

1. **Aplicación en el DevCenter de Mercado Libre:** genera `Client ID` y `Client Secret` para el flujo OAuth.
2. **URL pública HTTPS:** para recibir webhooks de ML y el callback OAuth. Puede ser un dominio propio o un túnel ngrok en staging.
3. **API Key de Groq (o proveedor LLM elegido):** para la inferencia de respuestas.
4. **Número de WhatsApp Business en Meta Cloud API:** para alertas por WhatsApp (Modo A).
5. **Bot de Telegram:** creado en @BotFather, token configurado en el servidor.
6. **Cuenta en Resend:** para alertas por email.

---

## Modos de Uso y Planes Sugeridos

| Característica | Starter | Pro | Enterprise |
|---|---|---|---|
| Auto-respuesta de preguntas | ✅ | ✅ | ✅ |
| Moderación anti-sanciones | ✅ | ✅ | ✅ |
| Panel web en tiempo real | ✅ | ✅ | ✅ |
| Alertas WhatsApp | 150/mes | 600/mes | 2.000/mes |
| Bot de Telegram con asistente | ❌ | ✅ | ✅ |
| Alertas por Email | ❌ | ✅ | ✅ |
| Gestión de Reclamos | ❌ | ✅ | ✅ |
| Multi-usuario / Equipo | ❌ | ❌ | ✅ |
| Tono y configuración avanzada | ✅ | ✅ | ✅ |

> Los planes son una sugerencia. El Super Admin puede habilitar o deshabilitar cualquier funcionalidad por tienda de forma individual.

---

## Demo Interactiva

La plataforma incluye un modo de demostración pensado para reuniones comerciales:

- **Usuario demo pre-configurado** que accede a un panel operativo real con datos de prueba.
- **Botón "Preparar Demo"** que inyecta preguntas y reclamos ficticios con distintos niveles de urgencia para mostrar el flujo completo.
- **Simulador de preguntas** que ejecuta el pipeline completo de IA y moderación sin hacer llamadas reales a Mercado Libre.

---

## Roadmap — Próximas Funcionalidades

- UI para configuración de WhatsApp BYO (1-2 días de desarrollo — backend ya listo).
- BYOK: soporte para que el cliente ingrese su propia API key de LLM desde el panel.
- Dashboard de métricas por tienda: gráficos de volumen, tasa de auto-respuesta y latencia a lo largo del tiempo.
- Respuestas automáticas a reclamos con IA (draft sugerido para que el vendedor apruebe).
- Integración con Mercado Pago para alertas de pagos y contracargos.
