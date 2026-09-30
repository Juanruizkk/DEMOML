export interface ClaimReasonInfo {
  code: string;
  category: 'defect' | 'missing_parts' | 'wrong_item' | 'not_as_described' | 'shipping_delay' | 'not_received' | 'return' | 'cancellation' | 'other';
  categoryLabel: string;
  title: string;
  description: string;
  recommendation: string;
  severity: 'high' | 'medium' | 'low';
}

const KNOWN_REASONS: Record<string, ClaimReasonInfo> = {
  // PDD: Producto Defectuoso / Inconvenientes de Producto
  PDD9949: {
    code: 'PDD9949',
    category: 'defect',
    categoryLabel: 'Producto Defectuoso / No Funciona',
    title: 'Producto con falla técnica o no enciende',
    description: 'El comprador recibió el producto pero indica que no funciona adecuadamente, presenta fallas eléctricas/mecánicas de fábrica o no enciende.',
    recommendation: 'Contactá al comprador por chat para orientarlo sobre el uso, solicitar video del defecto, o coordinar el cambio/devolución directa antes de que expire el SLA.',
    severity: 'high',
  },
  PDD9549: {
    code: 'PDD9549',
    category: 'missing_parts',
    categoryLabel: 'Faltan Accesorios o Piezas',
    title: 'Paquete o producto incompleto',
    description: 'El comprador manifiesta que en la caja faltan cables, piezas, manuales o accesorios promocionados en la publicación.',
    recommendation: 'Ofrecé enviar las piezas faltantes de inmediato por correo o proponer un reintegro parcial.',
    severity: 'medium',
  },
  PDD9548: {
    code: 'PDD9548',
    category: 'wrong_item',
    categoryLabel: 'Modelo / Color Diferente',
    title: 'Producto distinto al solicitado',
    description: 'El comprador recibió una variante, color o modelo diferente al que seleccionó en la orden de compra.',
    recommendation: 'Generá una etiqueta de cambio o retiro sin costo para enviar la variante correcta.',
    severity: 'high',
  },
  PDD9547: {
    code: 'PDD9547',
    category: 'not_as_described',
    categoryLabel: 'No Coincide con la Publicación',
    title: 'Discrepancia con la descripción',
    description: 'El producto recibido no cumple con las especificaciones técnicas, dimensiones o características detalladas en la publicación.',
    recommendation: 'Aclarar las dudas técnicas por mensaje o aceptar la devolución sin objeciones para resguardar la reputación.',
    severity: 'medium',
  },
  PDD9546: {
    code: 'PDD9546',
    category: 'defect',
    categoryLabel: 'Producto Dañado en Transporte',
    title: 'Embalaje o producto roto / golpeado',
    description: 'El paquete llegó con golpes visibles o rotura producida durante el traslado logístico.',
    recommendation: 'Pedir fotos del embalaje y solicitar intervención de Mercado Envíos para que el seguro cubra el siniestro.',
    severity: 'high',
  },

  // PNR: Paquete No Recibido / Envíos
  PNR9910: {
    code: 'PNR9910',
    category: 'shipping_delay',
    categoryLabel: 'Envío Demorado en Tránsito',
    title: 'Demora en la entrega del paquete',
    description: 'El paquete superó la fecha estimada de entrega y el comprador consulta por su paradero.',
    recommendation: 'Revisá el código de tracking con el correo y transmitile tranquilidad y número de seguimiento al comprador.',
    severity: 'medium',
  },
  PNR9949: {
    code: 'PNR9949',
    category: 'not_received',
    categoryLabel: 'Paquete No Recibido',
    title: 'El comprador no recibió el paquete',
    description: 'El sistema figura como entregado o extraviado pero el comprador afirma no tener el producto en sus manos.',
    recommendation: 'Verificá el comprobante de entrega con la empresa de envíos antes de responder a la mediación.',
    severity: 'high',
  },

  // Devoluciones y Cancelaciones
  RET9949: {
    code: 'RET9949',
    category: 'return',
    categoryLabel: 'Devolución Voluntaria',
    title: 'Compra protegida / Arrepentimiento de compra',
    description: 'El comprador decidió devolver el producto dentro de los 30 días de Compra Protegida.',
    recommendation: 'Aceptá el retorno. Una vez que el producto llegue al depósito en óptimas condiciones se libera el reintegro.',
    severity: 'low',
  },
  ML0001: {
    code: 'ML0001',
    category: 'cancellation',
    categoryLabel: 'Cancelación Solicitada',
    title: 'Solicitud de cancelación de compra',
    description: 'El comprador pide cancelar la orden antes de que sea despachada.',
    recommendation: 'Frená el empaquetado del paquete y emití el reembolso directo.',
    severity: 'low',
  },
};

export function getClaimReasonInfo(reasonCode: string): ClaimReasonInfo {
  const normalized = (reasonCode || '').trim().toUpperCase();

  if (KNOWN_REASONS[normalized]) {
    return KNOWN_REASONS[normalized];
  }

  // Fallbacks by prefix
  if (normalized.startsWith('PDD')) {
    return {
      code: normalized,
      category: 'defect',
      categoryLabel: 'Producto Defectuoso / Inconveniente de Calidad',
      title: `${normalized} · Falla o disconformidad con el producto`,
      description: 'El comprador reportó un problema de funcionamiento, rotura o discrepancia física con el artículo recibido.',
      recommendation: 'Contactá al comprador por chat para acordar una solución antes de que expire el SLA de Mercado Libre.',
      severity: 'high',
    };
  }

  if (normalized.startsWith('PNR')) {
    return {
      code: normalized,
      category: 'shipping_delay',
      categoryLabel: 'Inconveniente de Envío / Entrega',
      title: `${normalized} · Demora o paquete no recibido`,
      description: 'El comprador indica que no recibió el paquete o que el envío presenta demoras logísticas.',
      recommendation: 'Verificá el estado del tracking en Mercado Envíos y respondé a tiempo para evitar penalización.',
      severity: 'medium',
    };
  }

  if (normalized.startsWith('RET') || normalized.toLowerCase().includes('return')) {
    return {
      code: normalized,
      category: 'return',
      categoryLabel: 'Devolución de Producto',
      title: `${normalized} · Solicitud de retorno / cambio`,
      description: 'El comprador solicita la devolución del artículo dentro del marco de Compra Protegida.',
      recommendation: 'Aceptá la devolución para que Mercado Libre emita la etiqueta de despacho.',
      severity: 'low',
    };
  }

  return {
    code: normalized || 'DESCONOCIDO',
    category: 'other',
    categoryLabel: 'Mediación de Reclamo',
    title: `${normalized || 'Reclamo abierto'}`,
    description: 'El comprador abrió un reclamo formal en Mercado Libre que requiere la atención del vendedor.',
    recommendation: 'Revisá las acciones requeridas y respondé antes del plazo límite de SLA.',
    severity: 'medium',
  };
}
