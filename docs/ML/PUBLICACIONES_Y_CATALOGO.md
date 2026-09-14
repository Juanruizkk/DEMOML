# 🛍️ Guía de Publicaciones y Catálogo en Mercado Libre

Esta guía explica en detalle cómo funciona la creación de productos en Mercado Libre, la diferencia crítica entre publicaciones tradicionales y de catálogo, cómo evitar bloqueos de moderación en entornos Sandbox, y cómo el bot de IA aprovecha esta estructura para responder con máxima precisión.

---

## 1. 📌 Modalidades de Publicación en Mercado Libre

En Mercado Libre existen dos formas principales de publicar un producto:

### A. Publicación Tradicional
* Cada vendedor redacta su propio título, sube sus fotos, define su descripción y carga los atributos manualmente.
* **Desventaja en Sandbox / Pruebas:** Si se cargan datos ficticios (ej. fotos genéricas con títulos como *"Item de prueba"* o marcas inexistentes), el sistema automatizado de moderación de Mercado Libre suele pausar la publicación con el estado **`Inactiva para revisar`** (`under_review` / `waiting_for_patch`).

### B. Publicación de Catálogo (`catalog_listing`)
* El vendedor se asocia a la **ficha oficial** de un producto ya catalogado y verificado en la base de datos central de Mercado Libre (ej. *Cafetera Oster Prima Latte*, *Teclado Redragon Kumara*, *Smartwatch Haylou*, etc.).

---

## 2. 🌟 Beneficios del Catálogo Oficial para Pruebas y Producción

Al publicar productos vinculados al Catálogo Oficial (`catalog_listing: true`):

* ⭐ **Opiniones unificadas de producto:**  
  Mercado Libre asocia automáticamente las calificaciones con estrellas, reseñas y comentarios reales que miles de compradores dejaron sobre ese **modelo de producto** en toda la plataforma (las opiniones pertenecen al producto en sí, no a la cuenta del vendedor).
* 📋 **Ficha técnica completa y fotos oficiales:**  
  Hereda de inmediato fotografías oficiales en alta resolución, tabla de atributos de fábrica (dimensiones, voltaje, materiales, compatibilidad, colores) y descripción verificada.
* 🤖 **Gran ventaja para el Bot de Inteligencia Artificial:**  
  Cuando un comprador hace una pregunta técnica específica (ej. *“¿Qué tipo de switch trae el teclado?”*, *“¿Cuántas tazas rinde la cafetera?”*, *“¿El termo mantiene frío 24hs?”*), la API de Mercado Libre le entrega a nuestro bot la ficha técnica enriquecida y el LLM responde con exactitud quirúrgica sin alucinar.
* ⚡ **Aprobación inmediata en Sandbox:**  
  No sufre demoras ni bloqueos por moderación de fotos o títulos.

---

## 3. 🛠️ Cómo Crear Productos

### Método 1: Desde la Web de Mercado Libre (Panel Vendedor)
1. Iniciá sesión en [Mercado Libre Argentina](https://www.mercadolibre.com.ar/) con la cuenta del vendedor de prueba:
   * **Usuario:** `TESTUSER4327702539223624795`
   * **Contraseña:** `QFxIljwqcj`
2. Andá a **"Vender"** arriba a la derecha.
3. Buscá el producto en el catálogo (ej. *Teclado Redragon Kumara*).
4. Seleccioná el producto oficial del catálogo para asociar tu publicación a la ficha existente.
5. Definí precio y stock disponible.

---

### Método 2: Por API Programática (`POST /items`)

Para publicar vía API, se envía una petición con el token de acceso del vendedor y el `catalog_product_id`:

#### 1. Buscar el ID de catálogo del producto deseado:
```bash
GET https://api.mercadolibre.com/products/search?status=active&site_id=MLA&q=Smartwatch+Haylou
```

#### 2. Publicar el ítem:
```http
POST https://api.mercadolibre.com/items
Authorization: Bearer {SELLER_ACCESS_TOKEN}
Content-Type: application/json

{
  "catalog_product_id": "MLA19600457",
  "catalog_listing": true,
  "category_id": "MLA352679",
  "price": 68000,
  "currency_id": "ARS",
  "available_quantity": 10,
  "buying_mode": "buy_it_now",
  "listing_type_id": "gold_special",
  "condition": "new",
  "pictures": [
    { "source": "https://http2.mlstatic.com/D_NQ_NP_654681-MLU72649541011_112023-F.jpg" }
  ]
}
```

> ⚠️ **Importante al usar `catalog_listing: true`:** No se debe incluir el campo `title` en el payload JSON; Mercado Libre asigna el título oficial directamente desde el catálogo.

---

## 4. 📦 Productos Activos Creados en el Proyecto

Estos son los productos del catálogo oficial actualmente publicados y listos para pruebas en el entorno de desarrollo:

| Producto | Item ID | Categoría | Precio | Stock | Enlace a Publicación |
|---|---|---|---|---|---|
| ☕ **Cafetera Oster Prima Latte** | `MLA2087991267` | Electrodomésticos | $185.000 | 12 u. | [Ver en MELI](http://articulo.mercadolibre.com.ar/MLA-2087991267-cafetera-oster-prima-latte-roja-bvstem6603r-_JM) |
| ⌨️ **Teclado Mecánico Redragon Kumara** | `MLA3946551378` | Computación / Gaming | $52.000 | 20 u. | [Ver en MELI](http://articulo.mercadolibre.com.ar/MLA-3946551378-teclado-redragon-kumara-k552-switch-azul-teclado-de-color-negro-_JM) |
| ⌚ **Smartwatch Haylou LS12** | `MLA3946551334` | Relojes / Smart | $68.000 | 10 u. | [Ver en MELI](http://articulo.mercadolibre.com.ar/MLA-3946551334-smartwatch-haylou-ls12-rs4-_JM) |
| 🧉 **Termo Stanley Classic 1L** | `MLA2087991273` | Camping / Bazar | $79.000 | 15 u. | [Ver en MELI](http://articulo.mercadolibre.com.ar/MLA-2087991273-termo-stanley-classic-tapon-1l-1l-negroliso-negro-_JM) |
| 🖱️ **Mouse Gamer Logitech G203** | `MLA2087991281` | Computación / Gaming | $32.000 | 25 u. | [Ver en MELI](http://articulo.mercadolibre.com.ar/MLA-2087991281-mouse-gamer-gamer-logitech-gg-series-g203-lightsync-g203-white-_JM) |

---

## 5. 🧪 Flujo de Pruebas de Preguntas y Respuestas con IA

1. Abrí una **ventana de incógnito** en tu navegador.
2. Ingresá a Mercado Libre e iniciá sesión con la cuenta de **Comprador** (`TESTUSER2533156973119126771` / `0PZfM1kGU1`).
3. Ingresá a cualquiera de los enlaces de las publicaciones activas.
4. Escribí una pregunta técnica en la sección de preguntas pre-venta.
5. Verificá en la consola del backend o en el panel de control (`http://localhost:3000/`) cómo el bot procesa el evento del webhook, extrae los atributos técnicos del catálogo y publica la respuesta automáticamente.
