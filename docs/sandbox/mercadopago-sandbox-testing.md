# MercadoPago Sandbox Testing — Reference Guide

> Researched 2026-09-12 from primary sources via MercadoLibre Developers MCP server.
> Citations link to `developers.mercadolibre.com.ar` and `mercadopago.com.ar/developers`.

---

## 1. Entorno de pruebas: no hay sandbox, hay Usuarios de Test

MercadoLibre/MercadoPago **no tiene un ambiente de sandbox separado**. En cambio, provee **usuarios de test** que operan directamente en producción sin generar cargos reales ni afectar reputación.

### Crear un usuario de test

```bash
curl -X POST \
  -H 'Authorization: Bearer $ACCESS_TOKEN' \
  -H "Content-type: application/json" \
  -d '{"site_id":"MLA"}' \
  'https://api.mercadolibre.com/users/test_user'
```

**Respuesta:**
```json
{
  "id": 120506781,
  "nickname": "TEST0548",
  "password": "qatest328",
  "site_status": "active"
}
```

**Consideraciones clave:**
- Se pueden crear hasta **10 usuarios de test** por cuenta real.
- Guardar credenciales al crearlos; no hay endpoint para recuperarlas después.
- Los usuarios inactivos por 60 días se eliminan automáticamente.
- Las publicaciones deben titularse "Item de Prueba - Por favor, NO OFERTAR".
- Los usuarios de test solo pueden comprar/vender entre sí (no con cuentas reales).
- El código de validación de email de un usuario de test es igual a los **últimos 4-6 dígitos de su user_id**.

> **Fuente:** [Realiza pruebas — developers.mercadolibre.com.ar/es_ar/realiza-pruebas](https://developers.mercadolibre.com.ar/es_ar/realiza-pruebas)

---

## 2. Tarjetas de prueba (Test Credit Cards)

Las tarjetas de prueba para MercadoPago están documentadas en el portal de MercadoPago Developers (sitio separado del de MercadoLibre Developers).

### URL canónica por país

```
https://www.mercadopago.com.ar/developers/es/docs/subscriptions/additional-content/your-integrations/test/cards
```

> Sustituir `.com.ar` por el dominio del país correspondiente (`.com.mx`, `.com.br`, etc.).
> El link **solo está disponible para países con MercadoPago activo**.

### Cómo controlar el resultado del pago con el nombre del titular

Al realizar el checkout con una tarjeta de prueba, el resultado del pago se controla poniendo un **código especial en el campo "Nombre y Apellido del titular"**:

| Nombre del titular | Resultado del pago |
|--------------------|-------------------|
| `APRO APRO` | Pago **aprobado** |
| `CONT CONT` | Pago **pendiente** (revisión manual) |
| `CALL CALL` | Rechazado — llamar a la entidad emisora |
| `FUND FUND` | Rechazado — fondos insuficientes |
| `SECU SECU` | Rechazado — código de seguridad inválido |
| `EXPI EXPI` | Rechazado — fecha de vencimiento inválida |
| `FORM FORM` | Rechazado — error de formulario |

> Los datos del titular (número de documento, dirección, etc.) deben ser **ficticios**. Por seguridad, MercadoPago no indica el nombre del banco emisor de las tarjetas de prueba.

> **Fuente:** [Realiza pruebas — developers.mercadolibre.com.ar/es_ar/realiza-pruebas](https://developers.mercadolibre.com.ar/es_ar/realiza-pruebas) (contiene referencia directa al link de tarjetas y la técnica del nombre del titular)

### Donde obtener los números de tarjeta

Acceder a la URL de tarjetas de prueba del país correspondiente. MercadoPago publica números de Visa, Mastercard, Amex y otras marcas en esas páginas. El portal no expone esos números en la API de MercadoLibre Developers, deben consultarse directamente en:

- Argentina: `https://www.mercadopago.com.ar/developers/es/docs/subscriptions/additional-content/your-integrations/test/cards`
- México: `https://www.mercadopago.com.mx/developers/es/docs/subscriptions/additional-content/your-integrations/test/cards`
- Brasil: `https://www.mercadopago.com.br/developers/pt/docs/subscriptions/additional-content/your-integrations/test/cards`

---

## 3. Completar un pago en sandbox (estado "approved")

Un pago queda en estado `pending` por defecto si el nombre del titular no se especifica correctamente. Para que el pago sea **aprobado** (completado):

1. Usar una tarjeta de la lista oficial de tarjetas de prueba del país.
2. En el campo **Nombre y Apellido del titular**, ingresar exactamente: **`APRO APRO`**
3. El CVV puede ser cualquier número de 3 dígitos; la fecha de vencimiento debe ser futura.
4. El pago resultará con `status: approved`.

Para obtener un pago en estado **pendiente** usar el nombre `CONT CONT`.

> Los estados de pago posibles son: `approved`, `pending`, `rejected`, `in_process`, `cancelled`, `refunded`, `charged_back`.

> **Fuente:** [Realiza pruebas — developers.mercadolibre.com.ar/es_ar/realiza-pruebas](https://developers.mercadolibre.com.ar/es_ar/realiza-pruebas)

---

## 4. Abrir un reclamo (disputa) sobre una compra de prueba

La API de reclamos de MercadoLibre/MercadoPago opera bajo el prefijo `/post-purchase/v1/claims`. Los reclamos se crean cuando un comprador reporta un problema con su orden.

### 4.1 Tipos de reclamo

| Tipo | Código `reason_id` | Descripción |
|------|-------------------|-------------|
| Producto No Recibido | `PNR…` | El comprador no recibió el producto |
| Producto Diferente/Defectuoso | `PDD…` | El producto llegó diferente o dañado |
| Compra Cancelada | `CS…` | Cancelación de la compra |

### 4.2 Consultar un reclamo existente

```bash
curl -X GET \
  -H 'Authorization: Bearer $ACCESS_TOKEN' \
  https://api.mercadolibre.com/post-purchase/v1/claims/$CLAIM_ID
```

### 4.3 Buscar reclamos por order_id

```bash
curl -X GET \
  -H 'Authorization: Bearer $ACCESS_TOKEN' \
  "https://api.mercadolibre.com/post-purchase/v1/claims/search?order_id=$ORDER_ID&limit=30"
```

### 4.4 Buscar reclamos de un usuario (como vendedor)

```bash
curl -X GET \
  -H 'Authorization: Bearer $ACCESS_TOKEN' \
  "https://api.mercadolibre.com/post-purchase/v1/claims/search?players.user_id=$USER_ID&players.role=respondent&status=opened&limit=30"
```

> **Importante:** No usar `status=opened` como único filtro; siempre acotar con `players.user_id` + `players.role` u `order_id` para evitar errores 400 y rate limiting.

### 4.5 Escalar a disputa/mediación (abrir disputa)

Una vez que el reclamo existe en etapa `claim`, se puede escalar a mediación con MercadoLibre:

```bash
curl -X POST \
  -H 'Authorization: Bearer $ACCESS_TOKEN' \
  https://api.mercadolibre.com/post-purchase/v1/claims/$CLAIM_ID/actions/open-dispute
```

**Respuesta ejemplo:**
```json
{
  "id": 5204934310,
  "status": "opened",
  "type": "mediations",
  "stage": "dispute",
  "resource": "order"
}
```

> Al activar mediación, la comunicación con el comprador se redirige a un canal exclusivo con MercadoLibre; los mensajes deben enviarse al `mediator`, no al `complainant`.

### 4.6 Flujo completo de reclamo (stages)

```
Compra → Reclamo abierto (stage: claim) → Disputa/Mediación (stage: dispute) → Cierre
```

**Estados posibles de un reclamo:**
- `opened` — en curso
- `closed` — resuelto

**Etapas (stage):**
- `claim` — entre comprador y vendedor
- `dispute` — con intervención de MercadoLibre
- `recontact` — reapertura post-cierre
- `stale` — casos `ml_case`

### 4.7 Opciones de resolución disponibles para el vendedor

Una vez abierto el reclamo, el vendedor puede tomar las siguientes acciones según el campo `available_actions` del claim:

| Acción | Descripción |
|--------|-------------|
| `refund` | Devolución total del dinero al comprador |
| `allow_partial_refund` | Devolución parcial (solo PDD) |
| `allow_return` | Generar etiqueta de devolución del producto |
| `open_dispute` | Escalar a mediación con MercadoLibre |
| `send_message_to_complainant` | Enviar mensaje al comprador |
| `add_shipping_evidence` | Adjuntar evidencia de envío |

### 4.8 Emitir devolución total (cierre del reclamo)

```bash
curl -X POST \
  -H 'Authorization: Bearer $ACCESS_TOKEN' \
  https://api.mercadolibre.com/post-purchase/v1/claims/$CLAIM_ID/expected-resolutions/refund
```

### 4.9 Consultar el historial de acciones del reclamo

```bash
curl -X GET \
  -H 'Authorization: Bearer $ACCESS_TOKEN' \
  https://api.mercadolibre.com/post-purchase/v1/claims/$CLAIM_ID/actions-history
```

> **Fuentes:**
> - [Gestionar reclamos — developers.mercadolibre.com.ar/es_ar/que-es-un-reclamo](https://developers.mercadolibre.com.ar/es_ar/que-es-un-reclamo)
> - [Gestionar resolución de reclamos — developers.mercadolibre.com.ar/es_ar/gestionar-resolucion-de-reclamos](https://developers.mercadolibre.com.ar/es_ar/gestionar-resolucion-de-reclamos)
> - [Gestionar evidencia de reclamos — developers.mercadolibre.com.ar/es_ar/gestionar-evidencia-de-reclamos](https://developers.mercadolibre.com.ar/es_ar/gestionar-evidencia-de-reclamos)
> - [Gestionar mensajes de un reclamo — developers.mercadolibre.com.ar/es_ar/gestionar-mensaje-de-un-reclamo](https://developers.mercadolibre.com.ar/es_ar/gestionar-mensaje-de-un-reclamo)

---

## 5. Notificaciones de reclamos (webhooks)

Para recibir notificaciones cuando se crea o actualiza un reclamo, suscribir la aplicación a los topics en "Mis Aplicaciones" > "Post Purchase":

- **`claims`** — notifica cuando se abre un reclamo sobre una venta.
- **`claims_actions`** — notifica cuando se ejecuta una acción en un reclamo existente.

> **Fuente:** [Gestionar reclamos — developers.mercadolibre.com.ar/es_ar/que-es-un-reclamo](https://developers.mercadolibre.com.ar/es_ar/que-es-un-reclamo)

---

## 6. API de testing logística (Delivery/Proximity)

Para proyectos que usan MercadoPago Delivery (Proximity), existe una API específica para simular cambios de estado logístico **solo con usuarios de prueba**:

```bash
curl -X POST \
  'https://api.mercadopago.com/proximity-integration/v1/testing/notifications' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer $ACCESS_TOKEN' \
  -d '{"shipmentId": 42202706921, "notification": "DELIVERED"}'
```

| Valor `notification` | Estado resultante |
|---------------------|------------------|
| `ON_ROUTE_TO_PICKUP` | Repartidor en camino al local |
| `PICKING_UP` | Repartidor recogiendo el pedido |
| `SHIPPED` | Pedido en camino al cliente |
| `DELIVERED` | Pedido entregado |

> **Fuente:** [API TEST - Logistica Dropoff — developers.mercadolibre.com.ar/es_ar/api-test-logistica-dropoff](https://developers.mercadolibre.com.ar/es_ar/api-test-logistica-dropoff)

---

## Resumen ejecutivo

| Tarea | Mecanismo |
|-------|-----------|
| Obtener números de tarjeta de prueba | Ir a `mercadopago.com.ar/developers` → sección "Test cards" del país |
| Aprobar un pago en test | Usar tarjeta de prueba + nombre del titular: `APRO APRO` |
| Dejar pago pendiente | Nombre del titular: `CONT CONT` |
| Crear usuario de test | `POST /users/test_user` con `site_id` del país |
| Ver reclamos de una orden | `GET /post-purchase/v1/claims/search?order_id=...` |
| Abrir disputa/mediación | `POST /post-purchase/v1/claims/$CLAIM_ID/actions/open-dispute` |
| Emitir reembolso desde reclamo | `POST /post-purchase/v1/claims/$CLAIM_ID/expected-resolutions/refund` |
