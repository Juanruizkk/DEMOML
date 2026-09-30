# Comparativa de Modelos de Negocio — Consumo de LLM y Alertas WhatsApp

## Contexto

La plataforma tiene **dos costos variables independientes** que deben definirse por separado:

- **LLM** — el modelo de inteligencia artificial que lee y responde preguntas automáticamente
- **WhatsApp** — las notificaciones de alerta que recibe el vendedor cuando hay una pregunta o reclamo nuevo

Cada uno tiene dos opciones: lo paga la plataforma o lo paga el cliente. Son decisiones independientes y combinables.

---

## Modelo A — Plataforma absorbe el costo de LLM

El cliente paga una suscripción fija. El LLM corre en la cuenta del operador de la plataforma. Se pueden imponer límites de uso (por preguntas, alertas, etc.) para proteger el margen.

## Modelo B — Cliente trae su propia API key (BYOK)

El cliente paga una suscripción fija. El LLM corre en su propia cuenta del proveedor elegido (Groq, OpenAI, Anthropic). Sin límites de uso por parte de la plataforma.

> **Nota:** Groq ofrece un free tier muy generoso. La mayoría de los clientes pequeños/medianos no pagarían nada en LLM con este proveedor.

---

## Tabla Comparativa

| | Modelo A — Plataforma paga LLM | Modelo B — Cliente paga LLM (BYOK) |
|---|---|---|
| **Precio para el cliente** | Todo en una factura | Suscripción + factura del proveedor LLM (generalmente gratis con Groq) |
| **Límites de uso** | Necesarios para proteger el margen | Ninguno — usa lo que quiera |
| **Fricción en onboarding** | Mínima — entra y listo | Media — debe crear cuenta y generar API key en Groq/OpenAI |
| **Riesgo financiero para la plataforma** | Alto si un cliente crece mucho o abusa | Nulo — el costo variable es del cliente |
| **Control de calidad del servicio** | Total — el operador elige modelo y proveedor | Parcial — el cliente puede configurar mal |
| **Soporte** | Simple — todo centralizado | Más complejo — fallas del proveedor externo afectan al cliente |
| **Escalabilidad del negocio** | Requiere monitoreo de costos LLM por cliente | Escala libremente sin impacto en costos propios |
| **Percepción del cliente** | "Todo incluido", más simple | Más profesional, más control propio |
| **Complejidad técnica actual** | Ya implementado | Requiere ~3-5 días de desarrollo adicional |
| **Ideal para** | Primeros clientes, validar producto | Escalar, clientes más técnicos o con mayor volumen |

---

## Ventajas y Desventajas Detalladas

### Modelo A

**Ventajas:**
- Onboarding sin fricciones — el cliente no necesita configurar nada técnico
- Una sola factura, propuesta de valor más clara
- Control total sobre el modelo de IA utilizado y su calidad
- Ya implementado en el código — sin inversión técnica adicional

**Desventajas:**
- El margen se erosiona si un cliente tiene alto volumen de preguntas
- Obliga a imponer límites artificiales (por alertas, consultas, etc.) que incomodan al cliente
- Requiere monitoreo de costos por tenant para evitar pérdidas
- No escala bien financieramente sin ajuste de precios o cuotas

---

### Modelo B (BYOK)

**Ventajas:**
- Sin límites de uso para el cliente — usa la plataforma a plena capacidad
- Riesgo financiero variable eliminado para el operador
- El cliente tiene visibilidad y control de lo que gasta en IA
- Posicionamiento más profesional / enterprise
- Escala sin impacto en costos propios
- Groq free tier: muchos clientes no pagarían nada de LLM

**Desventajas:**
- Fricción en onboarding: el cliente debe crear cuenta en Groq/OpenAI y generar una API key
- Soporte más complejo: fallas o errores del proveedor externo llegan como reclamos a la plataforma
- Menos control sobre calidad: si el cliente elige mal el proveedor o modelo, los resultados bajan
- Requiere desarrollo adicional para implementarlo

---

## Mitigación de Riesgos (Modelo B)

| Riesgo | Solución propuesta |
|--------|--------------------|
| Onboarding técnico difícil | Tutorial paso a paso dentro del panel + video guía |
| Fallas del proveedor externo | Mensajes de error claros que identifiquen el origen del problema con enlace a solución |
| Cliente elige mal el proveedor | Recomendar Groq por defecto — free, rápido, más que suficiente para el volumen típico |
| API key expirada o sin saldo | Alerta visible en el panel del cliente antes de que falle |

---

## Canal de Alertas — WhatsApp

Además del LLM, la plataforma envía notificaciones al vendedor por WhatsApp cada vez que hay una pregunta o reclamo que requiere atención. Este canal también tiene dos modelos.

### Opción 1 — Número de la plataforma (compartido)
- Todos los clientes reciben alertas desde el mismo número del operador
- Meta le cobra al operador por cada conversación
- Para proteger el margen es necesario imponer un límite mensual de alertas por cliente
- Onboarding simple: el cliente solo ingresa su número de teléfono

### Opción 2 — Número propio del cliente (Portfolio de Meta)
- El operador crea un **Meta Business Portfolio** y cada cliente vincula su propio número de WhatsApp Business dentro de ese portfolio
- Las alertas salen desde el número del cliente, con su propia cuenta de Meta
- Meta le cobra directamente al cliente — el operador no asume ningún costo de mensajería
- Sin límite de alertas — el cliente usa lo que necesita
- Onboarding: el cliente copia sus credenciales de Meta (Phone Number ID + Access Token) en el panel

### Estado actual en el código

El backend ya soporta completamente la Opción 2. Cada cliente puede tener sus propias credenciales y la plataforma envía usando su número sin cuotas. **Lo que falta es la UI** para que el cliente ingrese esas credenciales desde su panel (estimado: 1-2 días de desarrollo).

### Comparativa WhatsApp

| | Opción 1 — Número de la plataforma | Opción 2 — Número propio del cliente |
|---|---|---|
| **¿Quién paga a Meta?** | La plataforma | El cliente directamente |
| **Límites de alertas** | Sí, necesarios para proteger margen | No — usa lo que quiera |
| **Fricción en onboarding** | Mínima | Baja — pegar credenciales en el panel |
| **Riesgo financiero** | Variable según volumen de clientes | Nulo para la plataforma |
| **Número que ve el vendedor** | Número genérico de la plataforma | Su propio número de negocio |
| **Estado en el código** | Implementado | Backend listo, falta UI (1-2 días) |

---

## Combinaciones posibles

| | WhatsApp de la plataforma (límites) | WhatsApp del cliente (sin límites) |
|---|---|---|
| **LLM de la plataforma** | Plataforma paga todo — necesita límites en ambos | Plataforma paga solo LLM |
| **LLM del cliente (BYOK)** | Plataforma paga solo WhatsApp | **Plataforma no paga nada variable** ✓ |

La combinación más limpia y escalable es **LLM del cliente + WhatsApp del cliente**: la plataforma cobra solo la suscripción y no tiene exposición a costos variables.

---

## Recomendación

**Fase 1 — Validación:** Arrancar con **Modelo A (LLM plataforma)** usando Groq en free tier + **WhatsApp compartido** con límite generoso. El costo real es prácticamente cero hasta los primeros 50-100 clientes y el onboarding es simple.

**Fase 2 — Escala:** Migrar a **LLM del cliente (BYOK) + WhatsApp propio (portfolio de Meta)**. La plataforma deja de tener costos variables y el cliente gana control total. Ofrecerlo como diferencial del plan superior (Pro / Enterprise).

Este enfoque permite validar rápido sin inversión técnica adicional y transicionar al modelo más sostenible a medida que crece el negocio.
