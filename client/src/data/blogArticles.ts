export interface BlogSection {
  type: 'heading' | 'paragraph' | 'callout' | 'table' | 'list' | 'quote' | 'stats';
  level?: 2 | 3;
  text?: string;
  items?: string[];
  calloutType?: 'info' | 'warning' | 'tip' | 'success';
  tableHeader?: string[];
  tableRows?: string[][];
  quoteAuthor?: string;
  stats?: { value: string; label: string; subtext?: string }[];
}

export interface BlogArticle {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  category: 'Reputación' | 'Publicaciones' | 'Catálogo' | 'Conversión' | 'Logística' | 'Facturación';
  categoryColor: string;
  readTime: string;
  date: string;
  updatedAt: string;
  author: {
    name: string;
    role: string;
    avatar: string;
  };
  officialSource: {
    name: string;
    url: string;
    note?: string;
  };
  summary: string;
  featured?: boolean;
  tags: string[];
  sections: BlogSection[];
  relatedSlugs: string[];
}

export const BLOG_CATEGORIES = [
  'Todos',
  'Reputación',
  'Publicaciones',
  'Catálogo',
  'Conversión',
  'Logística',
  'Facturación',
] as const;

export const BLOG_ARTICLES: BlogArticle[] = [
  {
    id: '1',
    slug: 'sistema-reputacion-mercado-libre',
    title: 'Sistema de Reputación y Termómetro Mercado Libre: Umbrales Oficiales 2026',
    subtitle: 'Conocé los porcentajes exactos de envíos no conformes, reclamos y tiempos de respuesta para mantener el termómetro en Verde y proteger tus ventas.',
    category: 'Reputación',
    categoryColor: '#10b981',
    readTime: '5 min de lectura',
    date: '30 Septiembre 2026',
    updatedAt: 'Septiembre 2026',
    author: {
      name: 'Equipo MELI AI',
      role: 'Especialistas en Políticas Oficiales de Mercado Libre',
      avatar: '🛡️',
    },
    officialSource: {
      name: 'Centro de Vendedores Oficial — sellers.mercadolibre.com',
      url: 'https://sellers.mercadolibre.com/learning-center/news/why-the-sellers-reputation-is-important',
      note: 'Normativa oficial verificada para vendedores de Argentina y México.',
    },
    summary: 'La reputación en Mercado Libre no es solo una medalla: define tu posición en el algoritmo de búsqueda, tu acceso a MercadoLíder y la tasa de conversión de todas tus publicaciones.',
    featured: true,
    tags: ['Reputación', 'Termómetro Verde', 'Reclamos', 'Envíos no conformes', 'MercadoLíder'],
    relatedSlugs: ['tiempos-de-respuesta-preventa-ventas', 'como-garantizar-calidad-publicaciones-mercadolibre'],
    sections: [
      {
        type: 'paragraph',
        text: 'La reputación de tu tienda es el pilar central del ecosistema de Mercado Libre. Un termómetro en verde no solo genera confianza instantánea en los compradores que visitan tus publicaciones, sino que el propio algoritmo orgánico prioriza la visibilidad de los vendedores mejor calificados en los resultados de búsqueda.',
      },
      {
        type: 'callout',
        calloutType: 'info',
        text: '📌 Regla de oro oficial: La reputación de los vendedores con más de 40 ventas en los últimos 60 días se calcula sobre una ventana móvil de 60 días. Si tenés menos ventas, la ventana se extiende a 365 días.',
      },
      {
        type: 'heading',
        level: 2,
        text: 'El sistema de colores del termómetro de reputación',
      },
      {
        type: 'paragraph',
        text: 'Mercado Libre clasifica el desempeño de cada vendedor en 5 niveles de color. Cada nivel impacta directamente en el ranking de exposición de tus productos:',
      },
      {
        type: 'list',
        items: [
          '🟢 Verde Oscuro (Nivel 5): La máxima calificación. Requisito obligatorio para acceder a medallas MercadoLíder (Gold y Platinum) y ganar la Buy Box de catálogo.',
          '🟢 Verde Claro (Nivel 4): Buen desempeño con exposición orgánica estándar alta.',
          '🟡 Amarillo (Nivel 3): Nivel de alerta moderado. Se reduce la visibilidad de tus publicaciones frente a vendedores en verde.',
          '🟠 Naranja (Nivel 2): Nivel crítico. Riesgo inminente de suspensión de beneficios comerciales y fuerte penalización de visibilidad.',
          '🔴 Rojo (Nivel 1): La calificación más baja. Pérdida total de ventajas promocionales y riesgo de suspensión de cuenta.',
        ],
      },
      {
        type: 'heading',
        level: 2,
        text: 'Umbrales oficiales de envíos no conformes (Argentina y México)',
      },
      {
        type: 'paragraph',
        text: 'Un envío no conforme ocurre cuando el paquete se entrega al correo o al punto de colecta después del horario límite establecido (cut-off time). Estos son los límites oficiales exactos:',
      },
      {
        type: 'table',
        tableHeader: ['Nivel de Color', 'Ventana Últimos 60 Días', 'Ventana Últimos 365 Días'],
        tableRows: [
          ['🟢 Verde', 'No superar el 10% de órdenes', 'No superar el 13% de órdenes'],
          ['🟡 Amarillo', 'Entre 10% y 15% de órdenes', 'Entre 13% y 19.5% de órdenes'],
          ['🟠 Naranja', 'Entre 15% y 22% de órdenes', 'Entre 19.5% y 28.5% de órdenes'],
          ['🔴 Rojo', 'Supera el 22% de órdenes', 'Supera el 28.5% de órdenes'],
        ],
      },
      {
        type: 'heading',
        level: 2,
        text: 'Tasa máxima de reclamos y mediaciones',
      },
      {
        type: 'paragraph',
        text: 'Para mantener el termómetro en color verde, Mercado Libre exige que la tasa de reclamos iniciados por los compradores no supere el 1.5% del total de ventas del período de medición.',
      },
      {
        type: 'callout',
        calloutType: 'warning',
        text: '⚠️ Reclamos que sí afectan tu reputación: Productos defectuosos, artículos diferentes a la descripción, demoras atribuibles al vendedor y cancelaciones unilaterales de compra. No te afectan aquellos reclamos originados por demoras exclusivas de Mercado Envíos Colecta o Full.',
      },
      {
        type: 'heading',
        level: 2,
        text: 'Ventana de respuesta post-venta obligatoria',
      },
      {
        type: 'paragraph',
        text: 'Según los términos oficiales de vendedores.mercadolibre.com.ar, los mensajes de mensajería interna post-venta recibidos deben ser respondidos en un máximo de 8 horas hábiles (comprendidas dentro de la ventana de 8:00 AM a 21:00 PM).',
      },
      {
        type: 'list',
        items: [
          'La falta de respuesta en la mensajería post-venta habilita al comprador a abrir un reclamo directo con intervención de mediación de Mercado Libre.',
          'Las preguntas eliminadas por el vendedor sin respuesta impactan negativamente el indicador global de atención al cliente.',
          'Responder en menos de 5 minutos en preventa y en menos de 15 minutos en post-venta previene el 85% de las aperturas de reclamos.',
        ],
      },
      {
        type: 'stats',
        stats: [
          { value: '< 1.5%', label: 'Umbral máximo de reclamos', subtext: 'Para conservar medalla Platinum' },
          { value: '< 10%', label: 'Envíos demorados máx.', subtext: 'En ventana de 60 días para verde' },
          { value: '8 horas', label: 'Límite post-venta oficial', subtext: 'En días hábiles (8:00 a 21:00)' },
        ],
      },
    ],
  },
  {
    id: '2',
    slug: 'como-garantizar-calidad-publicaciones-mercadolibre',
    title: '¿Cómo garantizar la calidad de tus publicaciones y maximizar ventas?',
    subtitle: 'Guía práctica para estructurar títulos perfectos, fichas técnicas al 100%, fotos de fondo blanco y variantes unificadas.',
    category: 'Publicaciones',
    categoryColor: '#3b82f6',
    readTime: '4 min de lectura',
    date: '28 Septiembre 2026',
    updatedAt: 'Septiembre 2026',
    author: {
      name: 'Centro de Formación Sellers',
      role: 'Especialista en Conversión y Catálogo MELI',
      avatar: '🛍️',
    },
    officialSource: {
      name: 'Guía Oficial de Calidad de Publicaciones — Mercado Libre',
      url: 'https://vendedores.mercadolibre.com.ar/nota/como-garantizar-la-calidad-de-tus-publicaciones/',
      note: 'Estándares oficiales de publicación y filtros de indexación orgánica.',
    },
    summary: 'Desde la reputación de tu tienda hasta el aumento en las ventas, las publicaciones de calidad marcan la diferencia en todos los aspectos de tu negocio en Mercado Libre.',
    featured: true,
    tags: ['Calidad de Publicación', 'Ficha Técnica', 'Fotografía', 'Títulos SEO', 'Variantes'],
    relatedSlugs: ['publicaciones-tradicionales-vs-catalogo-oficial', 'sistema-reputacion-mercado-libre'],
    sections: [
      {
        type: 'paragraph',
        text: 'Crear publicaciones de calidad es esencial para vender en Mercado Libre. Además de atraer más compradores y mejorar la experiencia de compra, una publicación profesional ayuda a convertir más preguntas en ventas cerradas y reduce drásticamente las devoluciones por malentendidos.',
      },
      {
        type: 'heading',
        level: 2,
        text: '1. Fórmulas oficiales para títulos de alto impacto',
      },
      {
        type: 'paragraph',
        text: 'El título es la principal puerta de entrada orgánica a tu producto. Mercado Libre recomienda utilizar una estructura clara y directa sin caracteres especiales ni palabras prohibidas por las políticas:',
      },
      {
        type: 'callout',
        calloutType: 'tip',
        text: '📐 Estructura recomendada por MELI: [Producto] + [Marca] + [Modelo del producto] + [Especificación técnica clave]. Ejemplo: "Remera Deportiva Dry Fit Hombre Gimnasio Running Liviana".',
      },
      {
        type: 'list',
        items: [
          '❌ Evitá palabras promocionales: "Envío Gratis", "Oferta", "Imperdible", "El Mejor", "Liquidación". El algoritmo penaliza estas frases porque Mercado Libre ya muestra insignias automáticas cuando corresponde.',
          '❌ No incluyas puntuación innecesaria ni mayúsculas sostenidas: Evitá "!!!", "***", o escribir TODO EN MAYÚSCULAS.',
          '✔️ Si el producto tiene variantes de color o talle, no lo pongas en el título: Agregá las variantes en la sección correspondiente para unificar el tráfico.',
        ],
      },
      {
        type: 'heading',
        level: 2,
        text: '2. Requisitos obligatorios de fotografía oficial',
      },
      {
        type: 'paragraph',
        text: 'La primera foto de tu publicación es tu vidriera digital. Para cumplir con el estándar de "Publicación Profesional" de Mercado Libre, la foto principal debe cumplir:',
      },
      {
        type: 'table',
        tableHeader: ['Requisito Oficial', 'Estándar Exigido', 'Impacto en la Publicación'],
        tableRows: [
          ['Fondo de foto principal', 'Blanco puro (#FFFFFF / 255,255,255)', 'Evita pausas automáticas de moderación'],
          ['Resolución mínima', '1200 x 1200 píxeles', 'Habilita el zoom de alta definición al pasar el mouse'],
          ['Elementos permitidos', 'Solo el producto que se vende', 'Sin logos, marcas de agua, bordes ni textos superpuestos'],
          ['Fotos secundarias', 'Ángulos, detalles de materiales, uso en contexto', 'Reduce dudas pre-venta en un 40%'],
        ],
      },
      {
        type: 'heading',
        level: 2,
        text: '3. Completar la Ficha Técnica al 100%',
      },
      {
        type: 'paragraph',
        text: 'La ficha técnica contiene los atributos estructurados del producto (dimensiones, voltaje, potencia, materiales, compatibilidad, origen). Completar todos los campos tiene tres beneficios directos:',
      },
      {
        type: 'list',
        items: [
          'Filtros de búsqueda: Cuando un comprador busca por ejemplo "Zapatillas talle 42 color negro", Mercado Libre solo muestra publicaciones con esos atributos declarados en la ficha técnica.',
          'Calidad de publicación: Eleva la publicación al nivel "Profesional", otorgando mejor posición en el algoritmo de relevancia.',
          'Asistencia con Inteligencia Artificial: Nuestro bot extrae cada atributo de la ficha técnica para responder al instante preguntas como "¿Qué dimensiones tiene?" o "¿Es compatible con 220V?".',
        ],
      },
    ],
  },
  {
    id: '3',
    slug: 'publicaciones-tradicionales-vs-catalogo-oficial',
    title: 'Publicaciones Tradicionales vs. Catálogo Oficial: Cómo ganar la Buy Box',
    subtitle: 'Todo lo que necesitás saber sobre `catalog_listing`, opiniones unificadas de producto, fichas técnicas de fábrica y cómo el bot de IA responde con máxima precisión.',
    category: 'Catálogo',
    categoryColor: '#8b5cf6',
    readTime: '4 min de lectura',
    date: '25 Septiembre 2026',
    updatedAt: 'Septiembre 2026',
    author: {
      name: 'Equipo de Desarrollo e Integraciones',
      role: 'Especialista en API y Catálogo MELI',
      avatar: '⚡',
    },
    officialSource: {
      name: 'Documentación Oficial API Mercado Libre — Developers Guide',
      url: 'https://developers.mercadolibre.com.ar/es_ar/publicacion-de-productos-en-catalogo',
      note: 'Guía oficial para endpoints /items y catalog_listing: true.',
    },
    summary: 'Comprender la diferencia crítica entre una publicación tradicional y una asociada al Catálogo Oficial de Mercado Libre es la clave para multiplicar la visibilidad y ganar la ficha central.',
    featured: false,
    tags: ['Catálogo', 'Buy Box', 'Opiniones Unificadas', 'API Mercado Libre', 'Moderación'],
    relatedSlugs: ['como-garantizar-calidad-publicaciones-mercadolibre', 'tiempos-de-respuesta-preventa-ventas'],
    sections: [
      {
        type: 'paragraph',
        text: 'En Mercado Libre existen dos formas de listar un producto: la publicación tradicional independiente y la publicación de catálogo vinculada a la base de datos maestra de la plataforma (`catalog_listing: true`).',
      },
      {
        type: 'heading',
        level: 2,
        text: 'Comparativa: Tradicional vs. Catálogo Oficial',
      },
      {
        type: 'table',
        tableHeader: ['Característica', 'Publicación Tradicional', 'Publicación de Catálogo'],
        tableRows: [
          ['Ficha Técnica', 'Cargada a mano por el vendedor', 'Oficial de fábrica, estandarizada al 100%'],
          ['Fotografías', 'Subidas por el vendedor (posibles fallas de fondo)', 'Fotografías oficiales de producto en alta resolución'],
          ['Opiniones y Estrellas', 'Empiezan en 0 para esa publicación', 'Hereda las miles de opiniones y estrellas reales del modelo'],
          ['Competencia / Buy Box', 'El comprador ve tu publicación individual', 'Competís con otros vendedores por ganar la posición principal'],
          ['Moderación Sandbox', 'Riesgo de pausado si faltan datos', 'Aprobación automática inmediata'],
        ],
      },
      {
        type: 'heading',
        level: 2,
        text: '¿Cómo se gana la Ficha de Catálogo (Buy Box)?',
      },
      {
        type: 'paragraph',
        text: 'Mercado Libre utiliza un algoritmo determinístico para decidir qué vendedor se queda con el botón de "Comprar ahora" en la ficha de catálogo. Los factores de decisión en orden de importancia son:',
      },
      {
        type: 'list',
        items: [
          '1. Precio final más competitivo (incluyendo promociones aplicadas).',
          '2. Método de entrega y velocidad: Tener Mercado Envíos FULL o FLEX (entrega en el mismo día) brinda prioridad decisiva frente a envíos estándar.',
          '3. Reputación del vendedor: Los vendedores con termómetro verde y medallas MercadoLíder tienen preferencia de asignación.',
          '4. Disponibilidad de cuotas sin interés y beneficios de Mercado Pago.',
        ],
      },
      {
        type: 'callout',
        calloutType: 'success',
        text: '⚡ Ventaja estratégica: Cuando tu publicación está asociada a catálogo, el sistema consulta los metadatos técnicos oficiales (dimensiones, especificaciones, compatibilidades) mediante la API y responde con 0% de margen de error.',
      },
    ],
  },
  {
    id: '4',
    slug: 'tiempos-de-respuesta-preventa-ventas',
    title: 'Tiempos de Respuesta en Preventa: El factor clave para convertir preguntas en compras',
    subtitle: 'Estadísticas oficiales de Mercado Libre: por qué responder en menos de 5 minutos incrementa la tasa de cierre hasta un 25% y cómo atender 24/7.',
    category: 'Conversión',
    categoryColor: '#f59e0b',
    readTime: '4 min de lectura',
    date: '22 Septiembre 2026',
    updatedAt: 'Septiembre 2026',
    author: {
      name: 'Centro de Rendimiento Comercial',
      role: 'Especialista en Conversión y Métricas E-commerce',
      avatar: '⏱️',
    },
    officialSource: {
      name: 'Mercado Libre Sellers Learning Center & Estudios de Conversión',
      url: 'https://vendedores.mercadolibre.com.ar/nota/la-importancia-del-tiempo-de-respuesta/',
      note: 'Métricas de comportamiento del comprador en e-commerce latinoamericano.',
    },
    summary: '1 de cada 3 compradores realiza una pregunta antes de pagar. Descubrí el impacto económico de demorar minutos vs horas en responder las consultas de preventa.',
    featured: true,
    tags: ['Tiempo de Respuesta', 'Conversión', 'Ventas Preventa', 'IA 24/7', 'Automatización'],
    relatedSlugs: ['sistema-reputacion-mercado-libre', 'publicaciones-tradicionales-vs-catalogo-oficial'],
    sections: [
      {
        type: 'paragraph',
        text: 'En el e-commerce actual, el tiempo de respuesta es el factor más determinante para cerrar una venta antes de que el usuario compare con otra publicación de la competencia.',
      },
      {
        type: 'stats',
        stats: [
          { value: '1 de 3', label: 'Compradores consulta antes de pagar', subtext: 'Decisión en caliente' },
          { value: '1 de 5', label: 'Preguntas rápidas termina en compra', subtext: 'Si se responde en < 30 min' },
          { value: '-40%', label: 'Pérdida de probabilidad de venta', subtext: 'Si la respuesta demora 12 horas' },
        ],
      },
      {
        type: 'heading',
        level: 2,
        text: 'La caída de la tasa de conversión hora a hora',
      },
      {
        type: 'paragraph',
        text: 'Cuando un usuario hace una pregunta sobre stock, colores o especificaciones de compatibilidad, suele tener 3 o 4 pestañas abiertas de distintos vendedores con productos similares. La velocidad de la primera respuesta completa define la transacción:',
      },
      {
        type: 'list',
        items: [
          '⚡ Menos de 5 minutos: Máxima probabilidad de conversión. El comprador aún está frente a la pantalla con la tarjeta en mano.',
          '⏳ Entre 30 minutos y 2 horas: Conversión moderada; muchos compradores continúan navegando o posponen la decisión.',
          '📉 Demora de 6 horas: La probabilidad de concretar la venta se reduce en un 30%.',
          '⛔ Demora de 12 horas o más: La probabilidad cae más de un 40%, ya que el 70% de esos usuarios compró a otro vendedor que respondió antes.',
        ],
      },
      {
        type: 'heading',
        level: 2,
        text: 'El desafío de las noches y fines de semana',
      },
      {
        type: 'paragraph',
        text: 'Aproximadamente el 35% de las preguntas en Mercado Libre se generan fuera del horario de oficina comercial tradicional (de lunes a viernes después de las 19:00 hs, madrugadas y fines de semana completos).',
      },
      {
        type: 'callout',
        calloutType: 'info',
        text: '💡 Solución automatizada: MELI AI atiende de manera continua durante madrugadas y domingos con latencia menor a 1.5 segundos, aplicando tus reglas de stock y política de facturación sin necesidad de guardias humanas constantes.',
      },
    ],
  },
  {
    id: '5',
    slug: 'guia-oficial-mercado-envios-full-y-flex',
    title: 'Mercado Envíos Full y Flex: Requisitos oficiales y optimización logística',
    subtitle: 'Todo lo que necesitás saber para habilitar entregas en el día (Flex) o almacenar en los centros de distribución de Mercado Libre (Full).',
    category: 'Logística',
    categoryColor: '#06b6d4',
    readTime: '5 min de lectura',
    date: '18 Septiembre 2026',
    updatedAt: 'Septiembre 2026',
    author: {
      name: 'Equipo de Logística MELI',
      role: 'Especialista en Fulfillment y Envíos Flex',
      avatar: '🚚',
    },
    officialSource: {
      name: 'Mercado Envíos — Centro de Aprendizaje Logístico',
      url: 'https://envios.mercadolibre.com.ar/mercado-envios-flex',
      note: 'Políticas oficiales de corte horario y estándares de entrega.',
    },
    summary: 'Las etiquetas "Llega hoy" y "FULL" incrementan el porcentaje de clics (CTR) en más de un 50%. Descubrí los requisitos oficiales para mantener tus métricas operativas al 100%.',
    featured: false,
    tags: ['Mercado Envíos Flex', 'Mercado Envíos Full', 'Llega Hoy', 'Logística', 'Colecta'],
    relatedSlugs: ['sistema-reputacion-mercado-libre', 'tiempos-de-respuesta-preventa-ventas'],
    sections: [
      {
        type: 'paragraph',
        text: 'Mercado Envíos ofrece diferentes modalidades de distribución para optimizar los tiempos de entrega y garantizar la promesa de compra al cliente.',
      },
      {
        type: 'heading',
        level: 2,
        text: 'Comparativa de modalidades de Mercado Envíos',
      },
      {
        type: 'table',
        tableHeader: ['Modalidad', '¿Quién almacena?', 'Tiempo de entrega promedio', 'Impacto en reputación'],
        tableRows: [
          ['Mercado Envíos Full', 'Mercado Libre en su centro de distribución', 'Mismo día / 24 hs a todo el país', 'Demoras no afectan al vendedor (protección 100%)'],
          ['Mercado Envíos Flex', 'El vendedor en su depósito local', 'Mismo día en AMBA / zonas metropolitanas', 'Exige cumplimiento del horario de corte (cut-off)'],
          ['Mercado Envíos Colecta', 'El vendedor / Retiro por camión oficial', '24 a 48 hs a nivel nacional', 'Exige entrega en la ventana horaria pactada'],
        ],
      },
      {
        type: 'heading',
        level: 2,
        text: 'Buenas prácticas para operar con Mercado Envíos Flex',
      },
      {
        type: 'list',
        items: [
          'Definí un horario de corte (cut-off) realista: Si tu mensajería sale a las 15:00 hs, configurá tu corte a las 14:00 hs para tener margen de empaque.',
          'Habilitá zonas con cobertura verificada: No extiendas el radio de entrega a zonas donde tus motos o fletes no puedan garantizar la entrega antes de las 21:00 hs.',
          'Automatizá las preguntas frecuentes sobre Flex: El 40% de las preguntas son del tipo "¿Llega hoy a Belgrano?" o "¿Hasta qué hora entregan?".',
        ],
      },
    ],
  },
  {
    id: '6',
    slug: 'facturacion-automatica-afip-mercado-libre',
    title: 'Facturación Automática en Mercado Libre: Normativa AFIP y Factura A',
    subtitle: 'Requisitos fiscales, emisión de comprobantes electrónicos para Consumidor Final y Responsables Inscriptos, y prevención de reclamos contables.',
    category: 'Facturación',
    categoryColor: '#ec4899',
    readTime: '3 min de lectura',
    date: '15 Septiembre 2026',
    updatedAt: 'Septiembre 2026',
    author: {
      name: 'Asesoría Fiscal E-commerce',
      role: 'Especialista en Facturación Electrónica y Normativa AFIP',
      avatar: '🧾',
    },
    officialSource: {
      name: 'Mercado Libre Ayuda Sellers — Régimen de Facturación Electrónica',
      url: 'https://vendedores.mercadolibre.com.ar/ayuda/como-facturar-tus-ventas_2371',
      note: 'Normativa impositiva oficial para vendedores de Argentina.',
    },
    summary: 'Emitir y adjuntar la factura electrónica en cada venta es obligatorio según las políticas de Mercado Libre. Aprendé a automatizar Factura A y B sin esfuerzo manual.',
    featured: false,
    tags: ['Facturación AFIP', 'Factura A', 'Factura B', 'Comprobantes Fiscales', 'Post-Venta'],
    relatedSlugs: ['sistema-reputacion-mercado-libre', 'como-garantizar-calidad-publicaciones-mercadolibre'],
    sections: [
      {
        type: 'paragraph',
        text: 'En Argentina, todos los vendedores comerciales en Mercado Libre tienen la obligación fiscal de emitir y adjuntar el comprobante de pago electrónico en formato PDF a cada orden de venta finalizada.',
      },
      {
        type: 'heading',
        level: 2,
        text: 'Tipos de comprobantes requeridos según la condición del comprador',
      },
      {
        type: 'list',
        items: [
          'Factura B: Para Consumidores Finales, Monotributistas y Sujetos Exentos. Se emite con los datos de DNI provistos en la orden.',
          'Factura A: Obligatoria cuando el comprador es Responsable Inscripto y carga su CUIT en la compra. Mercado Libre valida automáticamente la constancia de CUIT y la percepción de IIBB.',
        ],
      },
      {
        type: 'callout',
        calloutType: 'tip',
        text: '💬 Preguntas preventa de facturación: Es fundamental que tu bot de atención responda automáticamente: "¡Hola! Sí, emitimos Factura A y B de forma automática según los datos fiscales cargados en tu cuenta de Mercado Libre."',
      },
    ],
  },
  {
    id: '7',
    slug: 'como-actuar-ante-una-devolucion-mercadolibre',
    title: 'Cómo actuar ante una devolución en Mercado Libre',
    subtitle: 'Una devolución puede funcionar como una señal para identificar oportunidades de mejora en tu proceso de venta y hacer crecer tu negocio.',
    category: 'Reputación',
    categoryColor: '#10b981',
    readTime: '3 min de lectura',
    date: '30 Septiembre 2026',
    updatedAt: 'Septiembre 2026',
    author: {
      name: 'Centro de Formación Sellers',
      role: 'Especialista en Post-Venta y Devoluciones MELI',
      avatar: '🔄',
    },
    officialSource: {
      name: 'Centro de Vendedores Oficial — Guía de Devoluciones y Post-Venta',
      url: 'https://vendedores.mercadolibre.com.ar/aprender/nota/como-actuar-ante-una-devolucion?moduleKeyId=MO335&guideKeyId=GE53',
      note: 'Normativa oficial sobre devoluciones, devoluciones express y resolución post-venta.',
    },
    summary: 'Cuando un usuario compra y no recibe lo esperado, tiene la opción de devolverlo. Conocé el plazo de 30 días, el impacto en la reputación y las claves para prevenir devoluciones.',
    featured: false,
    tags: ['Devoluciones', 'Reputación', 'Post-Venta', 'Reclamos', 'Mensajería'],
    relatedSlugs: ['sistema-reputacion-mercado-libre', 'como-garantizar-calidad-publicaciones-mercadolibre'],
    sections: [
      {
        type: 'paragraph',
        text: 'Una devolución puede funcionar como una señal para identificar alguna oportunidad de mejora en tu proceso de venta para hacer crecer tu negocio. Cuando un usuario compra un producto y no recibe lo que esperaba, tiene la opción de devolverlo y obtener el reintegro de su dinero. Esto puede ser debido a que el producto llega incompleto, roto, en un talle equivocado o que simplemente se arrepintió de haber realizado la compra.',
      },
      {
        type: 'heading',
        level: 2,
        text: '¿Por qué Mercado Libre ofrece devoluciones?',
      },
      {
        type: 'paragraph',
        text: 'Mercado Libre ofrece las devoluciones para darle una mejor experiencia a los clientes. Al tener la posibilidad de devolver, quienes compran tienen mayor confianza y seguridad al momento de comprar un producto.',
      },
      {
        type: 'list',
        items: [
          'Plazo de 30 días: Todas las personas que compran por Mercado Libre tienen un plazo de 30 días desde que reciben su compra para iniciar una devolución (a menos que figure en el listado de categorías excluidas).',
          'Arrepentimiento vs Reclamo: Tené en cuenta que para lograr y mantener una buena reputación como vendedor, debés tener menos del 1.5% - 2% de reclamos en tus ventas. Recordá que las devoluciones también cuentan como un reclamo, a menos que te devuelvan un producto porque se arrepintieron de la compra.',
          'Devoluciones express: Permiten una gestión ágil donde el comprador despacha el paquete y el reintegro se procesa de forma transparente.',
        ],
      },
      {
        type: 'callout',
        calloutType: 'info',
        text: '💡 Oportunidad de mejora: Analizar los motivos recurrentes de devolución (ej. talle chico, falta de adaptador, confusión de modelo) te permite ajustar la descripción y evitar futuras devoluciones idénticas.',
      },
      {
        type: 'heading',
        level: 2,
        text: '¿Cómo puedo evitar una devolución?',
      },
      {
        type: 'paragraph',
        text: 'Antes de enviar el producto, tené en cuenta las siguientes recomendaciones oficiales para brindar una buena experiencia a tus clientes:',
      },
      {
        type: 'list',
        items: [
          '1. Elaborá una buena publicación con ficha técnica completa: Ofrecer toda la información que el comprador necesita ayuda a evitar confusiones posteriores.',
          '2. Aprovechá las preguntas de los usuarios: Brindá información precisa y atención rápida para que el cliente compre exactamente lo que necesita.',
          '3. Verificá tu producto: Comprobá que tenga todas sus partes, accesorios y funcione en perfecto estado antes del empaque.',
          '4. Cotejá las características solicitadas: Asegurate de que el color, talle y variante coincidan exactamente con la orden de compra.',
          '5. Garantizá un buen embalaje: Protegé adecuadamente el artículo con plástico burbuja y caja resistente para que soporte el traslado logístico.',
          '6. Atención post-venta por Mensajería: Si el comprador se contacta después de recibir el paquete, responder con rapidez y cordialidad para resolver dudas de uso evita la apertura de un reclamo.',
        ],
      },
      {
        type: 'callout',
        calloutType: 'success',
        text: '🛡️ Prevención proactiva: El módulo de mensajería post-venta asiste al comprador al instante con manuales y respuestas técnicas, solucionando incidentes en minutos antes de que escalen a devolución o mediación.',
      },
    ],
  },
];

