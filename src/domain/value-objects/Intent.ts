export type IntentType =
  | "stock"
  | "envio"
  | "caracteristicas"
  | "garantia"
  | "facturacion"
  | "precio_negociacion"
  | "reclamo"
  | "contacto_externo"
  | "otro";

export const INTENT_DESCRIPTIONS: Record<IntentType, string> = {
  stock: "Preguntas sobre disponibilidad de unidades, colores o retiro inmediato",
  envio: "Preguntas sobre costos, métodos, tiempos o agilidad de envío",
  caracteristicas: "Preguntas técnicas sobre especificaciones, medidas, compatibilidad o materiales",
  garantia: "Consultas sobre garantía oficial, plazos de cobertura o soporte técnico",
  facturacion: "Consultas sobre factura A, B, ticket fiscal o condición impositiva",
  precio_negociacion: "Pedidos de descuento, rebajas por cantidad o regateo de precio",
  reclamo: "Quejas, reclamos por compras anteriores o disconformidad",
  contacto_externo: "Intentos de evadir la plataforma (pedir WhatsApp, teléfono, email, dirección exacta previa a la compra)",
  otro: "Otras consultas generales no contempladas en las categorías anteriores",
};
