# TODO — Features pendientes

## Panel de control — Métricas oficiales de Mercado Libre

**Fuente:** https://vendedores.mercadolibre.com.ar/nota/analiza-tus-metricas-de-atencion-y-reduci-problemas-en-tus-ventas

### Feature: Dashboard de métricas de atención al comprador

Mostrar en el panel las métricas oficiales que Mercado Libre usa para calcular la reputación del vendedor, con semáforo visual (verde/amarillo/naranja/rojo) y umbral de alerta.

**Métricas a mostrar (ventana móvil de 60 días):**

| Métrica                        | Umbral verde (MX/AR)  | Fuente             |
|--------------------------------|-----------------------|--------------------|
| Envíos no conformes            | < 10% de las órdenes  | ML oficial         |
| Reclamos sobre ventas          | < 1.5%                | ML oficial         |
| Cancelaciones                  | < umbral por categoría| ML oficial         |
| Envíos fuera de plazo          | ML lo calcula solo    | ML oficial         |
| Calificaciones negativas       | ML lo calcula solo    | ML oficial         |
| Tiempo de respuesta preguntas  | < 10 minutos ideal    | ML oficial         |
| Respuesta mensajes post-venta  | < 8 hs hábiles        | ML oficial         |

**Referencia de colores de reputación (ventana 60 días):**
- 🟢 Verde: envíos no conformes < 10%
- 🟡 Amarillo: entre 10% y 15%
- 🟠 Naranja: entre 15% y 22%
- 🔴 Rojo: > 22%

*(Ver detalles completos en `docs/anuncios/seller-reputation.md`)*

**Lo que habría que hacer:**
- [ ] Consumir la API de métricas de ML por tenant (`/users/{user_id}/seller_reputation`)
- [ ] Mostrar un widget en el Dashboard con el estado actual de cada métrica
- [ ] Indicar con color (verde/amarillo/rojo) si está en zona de riesgo
- [ ] Mostrar la tendencia de los últimos 30/60 días en un mini gráfico
- [ ] Alertar por Telegram/email si alguna métrica entra en zona naranja o roja

---

## Análisis del Asistente oficial de ML — Qué podemos replicar

**Contexto:** Mercado Libre lanzó su propio asistente en https://vendedores.mercadolibre.com.ar/asistente con varias funcionalidades dirigidas a vendedores. Analizar qué tiene sentido implementar en nuestro producto.

### Funcionalidades del asistente oficial de ML

| Feature ML                          | Descripción                                                                 |
|-------------------------------------|-----------------------------------------------------------------------------|
| Sugerencia de respuestas            | Sugiere respuestas a preguntas de compradores en base al producto           |
| Estado de reputación                | Podés consultarle cómo está tu reputación actual                            |
| Programas y beneficios              | Informa sobre programas de vendedor y beneficios de productos               |
| Gestión de reclamos                 | Ayuda a que reclamos no afecten la reputación ("bajo control")              |
| Análisis de publicaciones           | Revisa fotos, título y descripción y sugiere mejoras para rankear mejor     |
| Historial de conversaciones         | Los chats quedan guardados, se puede retomar una conversación anterior      |

### Análisis: ¿qué implementamos nosotros?

#### ✅ Ya implementado
- **Respuesta automática a preguntas** — nuestro core, va más allá (automatiza, no solo sugiere)
- **Alertas de reclamos** — notificaciones a Telegram/WhatsApp cuando hay reclamos

#### 🟡 Interesante — analizar si tiene sentido agregar
- **Historial de conversaciones por publicación** — guardar el hilo de preguntas/respuestas de cada producto para dar contexto al LLM y mejorar respuestas futuras
- **Consulta de estado de reputación** — widget en dashboard (ver TODO de métricas oficiales arriba)
- **Gestión asistida de reclamos** — cuando llega un reclamo, el sistema sugiere qué responder para cerrar sin afectar reputación (prompt con contexto del reclamo + historial del comprador)

#### 🔵 Diferenciador potencial fuerte — ML no lo hace automático, nosotros sí
- **Análisis y mejora de publicaciones con IA** — pasar el título, fotos (descripción alt), descripción y atributos de una publicación por el LLM y recibir sugerencias concretas: "tu título no tiene la palabra clave principal", "te faltan los atributos de garantía", "la descripción no menciona compatibilidades". ML te lo muestra pero no lo hace automático.
- **Optimización masiva de catálogo** — analizar todas las publicaciones de un tenant de una vez y priorizar cuáles tienen más impacto en mejorar

#### ❌ No implementar por ahora
- Programas y beneficios — información estática que ML maneja bien, poco valor agregado

### Tareas concretas

- [ ] **Historial de Q&A por publicación:** guardar en DB las preguntas respondidas por publicación y usarlas como contexto RAG enriquecido
- [ ] **Widget de reputación en dashboard:** ya está en el TODO de métricas arriba
- [ ] **Sugerencia de respuesta a reclamos:** cuando llega un reclamo (post-venta), generar un borrador de respuesta con IA orientado a cerrar el reclamo sin escalarlo, enviarlo por Telegram para aprobación humana
- [ ] **Análisis de publicación con IA:** endpoint `/api/products/:itemId/analyze` que recibe una publicación y devuelve un score + lista de mejoras priorizadas (título, descripción, atributos faltantes, fotos)
- [ ] **Vista en panel "Mejorar publicaciones":** página que lista las publicaciones con peor score y permite ver/aplicar las sugerencias de IA una por una
