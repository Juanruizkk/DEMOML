import React, { useState, useTransition } from 'react'
import {
  Sparkles,
  Zap,
  CheckCircle2,
  Clock,
  Send,
  Truck,
  ShieldCheck,
  RotateCcw,
  Star,
  ChevronRight,
  HelpCircle,
  Cpu,
  RefreshCw,
  ShoppingBag,
  Award,
  CreditCard,
  MessageSquare,
  Flame,
  Check
} from 'lucide-react'
import './MeliProductSimulator.css'

interface DemoProduct {
  id: string
  mla: string
  title: string
  categoryPath: string[]
  bestSellerRank: string
  rating: number
  reviewsCount: number
  originalPrice: number
  price: number
  discountPercent: number
  installments: {
    count: number
    amount: number
    freeInterest: boolean
  }
  shippingText: string
  shippingType: 'FULL' | 'FLEX'
  stockCount: number
  colors: { name: string; hex: string; previewClass: string }[]
  sizes?: string[]
  highlights: string[]
  specs: { [key: string]: string }
  seller: {
    name: string
    isOfficial: boolean
    level: string
    salesCount: string
    reputationLevel: number // 1 to 5
  }
  defaultQuestions: {
    id: string
    question: string
    answer: string
    timeAgo: string
    latency: string
    ruleApplied: string
    isNew?: boolean
  }[]
}

const DEMO_PRODUCTS: DemoProduct[] = [
  {
    id: 'remera-dryfit',
    mla: 'MLA-1981381738',
    title: 'Remera Deportiva Dry Fit Gimnasio Running Liviana Colores',
    categoryPath: ['Ropa y Accesorios', 'Remeras, Musculosas y Chombas', 'Remeras', 'Remera Deportiva'],
    bestSellerRank: '1° en Remeras Deportivas',
    rating: 4.8,
    reviewsCount: 1428,
    originalPrice: 22340,
    price: 18990,
    discountPercent: 15,
    installments: {
      count: 3,
      amount: 6330,
      freeInterest: true
    },
    shippingText: 'Llega gratis hoy en CABA y GBA comprando antes de las 14:00',
    shippingType: 'FLEX',
    stockCount: 86,
    colors: [
      { name: 'Negro Obsidiana', hex: '#1e293b', previewClass: 'color-black' },
      { name: 'Azul Marino', hex: '#1e3a8a', previewClass: 'color-blue' },
      { name: 'Gris Grafito', hex: '#4b5563', previewClass: 'color-gray' },
      { name: 'Blanco Puro', hex: '#f8fafc', previewClass: 'color-white' },
      { name: 'Rojo Fuego', hex: '#b91c1c', previewClass: 'color-red' }
    ],
    sizes: ['S', 'M', 'L', 'XL', 'XXL'],
    highlights: [
      'Microfibra técnica Dry Fit antitranspirante y de secado ultra rápido.',
      'Apta para lavarropas: no encoge, no destiñe ni pierde elasticidad.',
      'Costuras planas reforzadas ergonómicas que previenen roces en el entrenamiento.',
      'Calce Regular / Slim deportivo ultra liviano (130g).'
    ],
    specs: {
      'Marca': 'SportFit Tech',
      'Modelo': 'Pro Runner Dry 2026',
      'Género': 'Hombre / Unisex',
      'Material principal': '100% Poliéster Microfibra',
      'Tipo de manga': 'Corta',
      'Tipo de cuello': 'Redondo reforzado',
      'Usos recomendados': 'Gimnasio, Running, Crossfit, Pádel'
    },
    seller: {
      name: 'SportFit Oficial',
      isOfficial: true,
      level: 'MercadoLíder Platinum',
      salesCount: '+10.000',
      reputationLevel: 5
    },
    defaultQuestions: [
      {
        id: 'q-remera-1',
        question: '¿Tenés stock en talle L color negro para despachar hoy por Flex?',
        answer: '¡Hola! Sí, disponemos de stock en talle L color Negro Obsidiana. Si realizás tu compra antes de las 14:00 hs, te llega hoy mismo en el día mediante Mercado Envíos Flex. ¡Esperamos tu compra!',
        timeAgo: 'Hace 3 minutos',
        latency: '1.1s',
        ruleApplied: 'Stock Flex en Vivo + Talle L'
      },
      {
        id: 'q-remera-2',
        question: '¿Hacen Factura A con CUIT discriminado?',
        answer: '¡Hola! Sí, emitimos Factura A y B de forma 100% automática. Al realizar la compra, solo asegurate de tener cargados los datos fiscales de tu empresa (CUIT y Razón Social) en tu cuenta de Mercado Libre.',
        timeAgo: 'Hace 18 minutos',
        latency: '1.3s',
        ruleApplied: 'Regla Fiscal: Emisión Factura A/B automática'
      },
      {
        id: 'q-remera-3',
        question: '¿Qué medidas de axila a axila tiene el talle XL?',
        answer: '¡Hola! El talle XL tiene 57 cm de axila a axila (114 cm de contorno total de pecho) y 74 cm de largo total. La tela cede cómodamente al cuerpo. ¡Cualquier otra consulta avisanos!',
        timeAgo: 'Hace 45 minutos',
        latency: '1.2s',
        ruleApplied: 'Ficha Técnica & Tabla de Talles RAG'
      }
    ]
  },
  {
    id: 'cafetera-oster',
    mla: 'MLA-3964722766',
    title: 'Cafetera Espresso Oster Prima Latte Tratamiento De Leche Roja 19 Bares',
    categoryPath: ['Electrodomésticos', 'Pequeños Electrodomésticos', 'Para la Cocina', 'Cafeteras'],
    bestSellerRank: '1° en Cafeteras Espresso',
    rating: 4.9,
    reviewsCount: 2310,
    originalPrice: 389900,
    price: 349990,
    discountPercent: 10,
    installments: {
      count: 6,
      amount: 58331,
      freeInterest: true
    },
    shippingText: 'Llega gratis mañana a todo el país con Mercado Envíos FULL',
    shippingType: 'FULL',
    stockCount: 42,
    colors: [
      { name: 'Rojo Carmesí', hex: '#991b1b', previewClass: 'color-red' },
      { name: 'Acero Inoxidable', hex: '#64748b', previewClass: 'color-gray' },
      { name: 'Negro Piano', hex: '#0f172a', previewClass: 'color-black' }
    ],
    highlights: [
      'Bomba italiana de 19 bares de presión para un espresso con crema densa y aromática.',
      'Depósito de leche desmontable de 600 ml apto para conservar en la heladera.',
      'Compatible con café molido y cápsulas formato Nespresso Original.',
      'Garantía oficial Oster Argentina de 12 meses.'
    ],
    specs: {
      'Marca': 'Oster',
      'Línea': 'Prima Latte II',
      'Modelo': 'BVSTEM6603R',
      'Presión': '19 bar',
      'Capacidad de agua': '1.5 L',
      'Voltaje': '220V',
      'Potencia': '1050 W'
    },
    seller: {
      name: 'Oster Tienda Oficial',
      isOfficial: true,
      level: 'MercadoLíder Platinum',
      salesCount: '+50.000',
      reputationLevel: 5
    },
    defaultQuestions: [
      {
        id: 'q-cafe-1',
        question: '¿Sirve tanto para café molido como para cápsulas Nespresso?',
        answer: '¡Hola! Sí, es 100% compatible con café molido tradicional y además incluye el adaptador original para cápsulas tipo Nespresso. ¡Esperamos tu compra!',
        timeAgo: 'Hace 5 minutos',
        latency: '1.2s',
        ruleApplied: 'Ficha Técnica: Compatibilidad Multicápsula'
      },
      {
        id: 'q-cafe-2',
        question: '¿Viene en 220V para enchufar directo en Argentina?',
        answer: '¡Hola! Sí, es la versión oficial homologada para Argentina de 220V con ficha normalizada de 3 patas. Cuenta con 12 meses de garantía oficial Oster. ¡Hacemos Factura A y B!',
        timeAgo: 'Hace 22 minutos',
        latency: '1.4s',
        ruleApplied: 'Atributos Eléctricos & Garantía Oficial'
      }
    ]
  },
  {
    id: 'teclado-redragon',
    mla: 'MLA-2101482425',
    title: 'Teclado Mecánico Gamer Redragon Kumara K552 RGB Switch Blue Español',
    categoryPath: ['Computación', 'Periféricos de PC', 'Teclados', 'Teclados Físicos Gamer'],
    bestSellerRank: '1° en Teclados Gamer',
    rating: 4.8,
    reviewsCount: 3890,
    originalPrice: 72900,
    price: 62450,
    discountPercent: 14,
    installments: {
      count: 3,
      amount: 20816,
      freeInterest: true
    },
    shippingText: 'Llega gratis hoy comprando antes de las 14:00',
    shippingType: 'FLEX',
    stockCount: 115,
    colors: [
      { name: 'Negro RGB', hex: '#0f172a', previewClass: 'color-black' },
      { name: 'Blanco RGB', hex: '#f8fafc', previewClass: 'color-white' }
    ],
    highlights: [
      'Switches mecánicos Outemu Blue con feedback táctil y click audible.',
      'Iluminación RGB Chroma con 18 efectos y brillo configurable.',
      'Layout en Español Latinoamericano con tecla Ñ física.',
      'Construcción de aluminio ABS reforzado a prueba de salpicaduras.'
    ],
    specs: {
      'Marca': 'Redragon',
      'Modelo': 'Kumara K552 RGB',
      'Idioma': 'Español (con Ñ)',
      'Tipo de Switch': 'Outemu Blue Mecánico',
      'Conectividad': 'USB Plug & Play con cable mallado',
      'Compatibilidad': 'PC, PS5, PS4, Xbox Series X/S'
    },
    seller: {
      name: 'Gaming Store BA',
      isOfficial: true,
      level: 'MercadoLíder Platinum',
      salesCount: '+25.000',
      reputationLevel: 5
    },
    defaultQuestions: [
      {
        id: 'q-red-1',
        question: '¿Tiene la letra Ñ física y layout en español?',
        answer: '¡Hola! Sí, es la versión en Español Latinoamericano con la tecla Ñ física de fábrica e iluminación RGB. ¡Esperamos tu compra!',
        timeAgo: 'Hace 8 minutos',
        latency: '1.0s',
        ruleApplied: 'Ficha Técnica: Layout de Idioma'
      },
      {
        id: 'q-red-2',
        question: '¿Es compatible con PlayStation 5 y Windows 11?',
        answer: '¡Hola! Sí, es 100% compatible Plug & Play mediante conexión USB con PS5, PS4, PC (Windows 10/11) y Mac. No requiere instalación de drivers.',
        timeAgo: 'Hace 30 minutos',
        latency: '1.1s',
        ruleApplied: 'Ficha Técnica: Compatibilidad de Consolas'
      }
    ]
  }
]

export default function MeliProductSimulator() {
  const [activeProductId, setActiveProductId] = useState<string>('remera-dryfit')
  const activeProduct = DEMO_PRODUCTS.find(p => p.id === activeProductId) || DEMO_PRODUCTS[0]

  // Product Selection States
  const [selectedColor, setSelectedColor] = useState<string>(activeProduct.colors[0]?.name || '')
  const [selectedSize, setSelectedSize] = useState<string>(activeProduct.sizes ? activeProduct.sizes[2] : '')
  const [activeThumb, setActiveThumb] = useState<number>(0)

  // Questions and Simulation States
  const [questionsList, setQuestionsList] = useState(activeProduct.defaultQuestions)
  const [inputQuestion, setInputQuestion] = useState<string>('')
  const [isSimulating, setIsSimulating] = useState<boolean>(false)
  const [simulatedMetric, setSimulatedMetric] = useState<{ latency: string; rule: string } | null>(null)

  // Reset when product changes
  const handleSelectProduct = (product: DemoProduct) => {
    setActiveProductId(product.id)
    setSelectedColor(product.colors[0]?.name || '')
    setSelectedSize(product.sizes ? product.sizes[2] : '')
    setActiveThumb(0)
    setQuestionsList(product.defaultQuestions)
    setInputQuestion('')
    setSimulatedMetric(null)
  }

  // Smart Contextual Answer Generator
  const generateSmartAnswer = (questionText: string, product: DemoProduct): { answer: string; rule: string; latency: string } => {
    const q = questionText.toLowerCase().trim()
    const latency = (0.9 + Math.random() * 0.5).toFixed(1) + 's'

    // 1. Facturación
    if (q.includes('factura') || q.includes('cuit') || q.includes('iva') || q.includes('fiscal') || q.includes('responsable inscripto')) {
      return {
        answer: `¡Hola! Sí, emitimos Factura A y B de forma 100% automática. Al realizar tu compra, solo asegúrate de tener cargados los datos fiscales de tu empresa (CUIT y Razón Social) en tu cuenta de Mercado Libre.`,
        rule: 'Regla Fiscal: Emisión Factura A/B automática',
        latency
      }
    }

    // 2. Envío Flex / Hoy / Despacho
    if (q.includes('flex') || q.includes('hoy') || q.includes('envio') || q.includes('envío') || q.includes('llega') || q.includes('demora') || q.includes('despacho')) {
      if (product.shippingType === 'FLEX') {
        return {
          answer: `¡Hola! Sí, si compras antes de las 14:00 hs te lo despachamos hoy mismo mediante Mercado Envíos Flex para que lo recibas en el día en CABA y GBA. Para el resto del país se despacha hoy por Mercado Envíos. ¡Esperamos tu compra!`,
          rule: 'Inventario en vivo + Despacho Flex Activo',
          latency
        }
      } else {
        return {
          answer: `¡Hola! Sí, el producto se encuentra en el centro de distribución de Mercado Libre (Envío FULL). Despachan las 24 horas y suele llegar entre 24 y 48 hs hábiles a tu domicilio. ¡Esperamos tu compra!`,
          rule: 'Logística Mercado Envíos FULL',
          latency
        }
      }
    }

    // 3. Stock / Talles / Colores
    if (q.includes('stock') || q.includes('talle') || q.includes('color') || q.includes('disponible') || q.includes('medida') || q.includes('medidas') || q.includes('cm')) {
      if (product.id === 'remera-dryfit') {
        return {
          answer: `¡Hola! Sí, disponemos de stock en ${selectedColor || 'todos los colores'} y talles del S al XXL. La tabla de medidas es: S (50cm pecho / 68cm largo), M (53cm / 70cm), L (55cm / 72cm), XL (57cm / 74cm), XXL (60cm / 76cm). Podés seleccionar tu variante arriba y comprar con tranquilidad.`,
          rule: 'RAG Ficha Técnica & Stock de Variantes',
          latency
        }
      } else {
        return {
          answer: `¡Hola! Sí, contamos con ${product.stockCount} unidades disponibles en stock para despacho inmediato en color ${selectedColor}. Podés ofertar sin problemas. ¡Esperamos tu compra!`,
          rule: 'Inventario Sincronizado en Tiempo Real',
          latency
        }
      }
    }

    // 4. Material / Calidad / Lavado / Garantía
    if (q.includes('lavar') || q.includes('tela') || q.includes('material') || q.includes('poliester') || q.includes('garantia') || q.includes('garantía') || q.includes('original')) {
      if (product.id === 'remera-dryfit') {
        return {
          answer: `¡Hola! Es 100% microfibra de poliéster técnico Dry-Fit de primera calidad. No destiñe ni encoge con los lavados en lavarropas. Además, contás con 30 días de devolución gratis y garantía directa de fábrica.`,
          rule: 'RAG Atributos de Producto & Políticas',
          latency
        }
      } else if (product.id === 'cafetera-oster') {
        return {
          answer: `¡Hola! Es 100% original con 12 meses de Garantía Oficial Oster en todo el país. Cuenta con bomba italiana de 19 bares y todos sus accesorios en caja sellada de fábrica. ¡Emitimos Factura A y B!`,
          rule: 'Garantía Oficial Fabricante Oster',
          latency
        }
      } else {
        return {
          answer: `¡Hola! Es 100% original en caja sellada con garantía de 12 meses. Fabricado con materiales de alta durabilidad y switches de 50 millones de pulsaciones. ¡Esperamos tu compra!`,
          rule: 'Garantía Oficial & Ficha Técnica',
          latency
        }
      }
    }

    // 5. Mayorista / Cantidad
    if (q.includes('mayor') || q.includes('cantidad') || q.includes('10') || q.includes('descuento') || q.includes('presupuesto')) {
      return {
        answer: `¡Hola! Sí, podemos armarte una publicación especial o podés agregar la cantidad deseada al carrito para aprovechar el envío gratis unificado. Si precisás Factura A con CUIT, la emitimos automáticamente. ¡Esperamos tu compra!`,
        rule: 'Regla Comercial: Ventas por Volumen',
        latency
      }
    }

    // 6. Default Smart ML Seller Answer
    return {
      answer: `¡Hola! Gracias por consultar. Verificamos la ficha técnica de la publicación: el producto está disponible con despacho inmediato, garantía oficial y todos los medios de pago con Mercado Pago. ¿Te gustaría que te reservemos una unidad?`,
      rule: 'Inferencia RAG Multi-Atributo MELI AI',
      latency
    }
  }

  const handleAskQuestion = (questionToAsk?: string) => {
    const text = (questionToAsk || inputQuestion).trim()
    if (!text || isSimulating) return

    setIsSimulating(true)
    setInputQuestion('')

    setTimeout(() => {
      const { answer, rule, latency } = generateSmartAnswer(text, activeProduct)
      const newQuestion = {
        id: `q-live-${Date.now()}`,
        question: text,
        answer,
        timeAgo: 'Hace un momento',
        latency,
        ruleApplied: rule,
        isNew: true
      }

      setQuestionsList(prev => [newQuestion, ...prev])
      setSimulatedMetric({ latency, rule })
      setIsSimulating(false)
    }, 950)
  }

  // Quick Preset Questions for testing
  const presetChips = activeProduct.id === 'remera-dryfit' ? [
    '¿Tenés stock en talle L negro para despachar hoy por Flex?',
    '¿Hacen Factura A con CUIT discriminado?',
    '¿Qué medidas de axila a axila tiene el talle XL?',
    '¿Es 100% poliéster dry fit? ¿Encoge con los lavados?',
    '¿Hacen precio especial por 10 remeras surtidas?'
  ] : activeProduct.id === 'cafetera-oster' ? [
    '¿Sirve tanto para café molido como para cápsulas Nespresso?',
    '¿Viene en 220V para enchufar directo en Argentina?',
    '¿Hacen Factura A para empresa?',
    '¿Cuánto tarda en calentar y preparar un capuchino?'
  ] : [
    '¿Tiene la letra Ñ física y layout en español latino?',
    '¿Es compatible con PlayStation 5 y Windows 11?',
    '¿Hacen Factura A?',
    '¿Cuánto demora el envío a Córdoba o Rosario?'
  ]

  // Suggested Topics (¿Qué querés saber?)
  const topicPills = [
    { label: 'Costo y tiempo de envío', query: '¿Cuánto demora el envío a mi localidad y cuánto cuesta?' },
    { label: 'Facturación A y B', query: '¿Emiten Factura A con CUIT discriminado?' },
    { label: 'Guía de talles y medidas', query: '¿Me pasás las medidas y dimensiones exactas de la ficha?' },
    { label: 'Garantía y devoluciones', query: '¿Qué garantía oficial tiene y cómo funciona la devolución?' }
  ]

  return (
    <div className="meli-sim-wrapper">
      {/* ── Top Simulator Switcher Bar ── */}
      <div className="meli-sim-header-bar">
        <div className="meli-sim-badge">
          <Cpu size={15} />
          <span>Experiencia Real de Compra en Mercado Libre + MELI AI</span>
        </div>
        <div className="meli-product-tabs">
          <span className="meli-tabs-label">Probar en publicación:</span>
          {DEMO_PRODUCTS.map(p => (
            <button
              key={p.id}
              type="button"
              className={`meli-product-tab-btn ${p.id === activeProduct.id ? 'active' : ''}`}
              onClick={() => handleSelectProduct(p)}
            >
              <span>{p.id === 'remera-dryfit' ? '👕 Remera Dry Fit' : p.id === 'cafetera-oster' ? '☕ Cafetera Oster' : '⌨️ Teclado Gamer'}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Main Mercado Libre Product Card Box ── */}
      <div className="meli-post-container">
        
        {/* ML Breadcrumbs & Navigation */}
        <div className="meli-breadcrumbs">
          <span className="meli-back-link">Volver al listado</span>
          <span className="meli-sep">|</span>
          {activeProduct.categoryPath.map((cat, idx) => (
            <React.Fragment key={idx}>
              <span className="meli-crumb">{cat}</span>
              {idx < activeProduct.categoryPath.length - 1 && <span className="meli-sep">&gt;</span>}
            </React.Fragment>
          ))}
        </div>

        {/* ── 2-Column Product Detail Layout ── */}
        <div className="meli-product-grid">

          {/* ── LEFT COLUMN: Gallery + Highlights + Specs ── */}
          <div className="meli-col-gallery">
            <div className="meli-gallery-wrap">
              {/* Thumbnails list */}
              <div className="meli-thumbs-list">
                {[0, 1, 2, 3].map(thumbIdx => (
                  <button
                    key={thumbIdx}
                    type="button"
                    className={`meli-thumb-item ${activeThumb === thumbIdx ? 'active' : ''}`}
                    onClick={() => setActiveThumb(thumbIdx)}
                  >
                    <div className={`thumb-preview-box ${activeProduct.id} thumb-${thumbIdx}`}>
                      {activeProduct.id === 'remera-dryfit' ? (
                        <div className="mock-shirt-thumb" style={{ backgroundColor: activeProduct.colors[thumbIdx % activeProduct.colors.length].hex }} />
                      ) : activeProduct.id === 'cafetera-oster' ? (
                        <span style={{ fontSize: '1.2rem' }}>☕</span>
                      ) : (
                        <span style={{ fontSize: '1.2rem' }}>⌨️</span>
                      )}
                    </div>
                  </button>
                ))}
              </div>

              {/* Main Image Display Frame */}
              <div className="meli-main-image-frame">
                <div className="meli-zoom-hint">
                  <Sparkles size={13} />
                  <span>Publicación en vivo</span>
                </div>

                {/* Simulated Visual Presentation */}
                {activeProduct.id === 'remera-dryfit' ? (
                  <div className="product-visual-shirt">
                    <div className="shirt-illustration" style={{ '--shirt-color': activeProduct.colors.find(c => c.name === selectedColor)?.hex || '#1e293b' } as React.CSSProperties}>
                      <div className="shirt-body">
                        <div className="shirt-collar" />
                        <div className="shirt-sleeves" />
                        <div className="shirt-brand-logo">SPORTFIT</div>
                        <div className="shirt-dryfit-tag">DRY-FIT PRO</div>
                      </div>
                    </div>
                    <div className="shirt-variant-badge">
                      Variante seleccionada: <strong>{selectedColor}</strong> {selectedSize && `• Talle ${selectedSize}`}
                    </div>
                  </div>
                ) : activeProduct.id === 'cafetera-oster' ? (
                  <div className="product-visual-appliance">
                    <div className="appliance-icon-big">☕</div>
                    <div className="appliance-model-title">Oster Prima Latte 19 Bar</div>
                    <div className="appliance-badge">100% Acero & Depósito de Leche 600ml</div>
                  </div>
                ) : (
                  <div className="product-visual-tech">
                    <div className="tech-icon-big">⌨️</div>
                    <div className="tech-model-title">Redragon Kumara K552 RGB</div>
                    <div className="tech-badge">Switch Blue Español con tecla Ñ</div>
                  </div>
                )}
              </div>
            </div>

            {/* "Lo que tenés que saber de este producto" */}
            <div className="meli-product-highlights">
              <h4 className="meli-highlights-title">Lo que tenés que saber de este producto</h4>
              <ul className="meli-highlights-list">
                {activeProduct.highlights.map((item, idx) => (
                  <li key={idx}>
                    <Check size={14} className="meli-check-icon" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Ficha Técnica / Características Principales */}
            <div className="meli-specs-box">
              <h4 className="meli-specs-title">Características principales</h4>
              <table className="meli-specs-table">
                <tbody>
                  {Object.entries(activeProduct.specs).map(([key, val], idx) => (
                    <tr key={idx} className={idx % 2 === 0 ? 'even' : 'odd'}>
                      <td className="spec-label">{key}</td>
                      <td className="spec-value">{val}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── RIGHT COLUMN: Buy Box & Seller ── */}
          <div className="meli-col-buybox">
            
            {/* Condition & Best Seller Ribbon */}
            <div className="meli-top-meta">
              <span className="meli-condition">Nuevo | +5.000 vendidos</span>
              <div className="meli-rating-row">
                <span className="meli-rating-num">{activeProduct.rating}</span>
                <div className="meli-stars">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} size={13} fill="#3483fa" color="#3483fa" />
                  ))}
                </div>
                <span className="meli-reviews-count">({activeProduct.reviewsCount})</span>
              </div>
            </div>

            <div className="meli-bestseller-badge">
              <Flame size={13} />
              <span>MÁS VENDIDO {activeProduct.bestSellerRank}</span>
            </div>

            {/* Product Title */}
            <h1 className="meli-title">{activeProduct.title}</h1>

            {/* Price section */}
            <div className="meli-price-wrap">
              {activeProduct.originalPrice > activeProduct.price && (
                <div className="meli-original-price">
                  <span>$ {activeProduct.originalPrice.toLocaleString('es-AR')}</span>
                </div>
              )}
              <div className="meli-current-price-row">
                <span className="meli-currency">$</span>
                <span className="meli-price-amount">{activeProduct.price.toLocaleString('es-AR')}</span>
                {activeProduct.discountPercent > 0 && (
                  <span className="meli-discount-badge">{activeProduct.discountPercent}% OFF</span>
                )}
              </div>
              <div className="meli-installments-row">
                <span>en <strong>{activeProduct.installments.count}x $ {activeProduct.installments.amount.toLocaleString('es-AR')}</strong> {activeProduct.installments.freeInterest ? 'sin interés' : ''}</span>
              </div>
              <a href="#payment-methods" className="meli-payment-link" onClick={e => e.preventDefault()}>
                Ver los medios de pago
              </a>
            </div>

            {/* Shipping Info Card */}
            <div className="meli-shipping-card">
              <div className="meli-shipping-icon">
                <Truck size={18} color="#00a650" />
              </div>
              <div>
                <div className="meli-shipping-primary">
                  <span style={{ color: '#00a650', fontWeight: 700 }}>
                    {activeProduct.shippingType === 'FLEX' ? '⚡ Llega gratis hoy' : '⚡ Llega gratis mañana'}
                  </span>
                  <span className="meli-full-tag">{activeProduct.shippingType}</span>
                </div>
                <p className="meli-shipping-sub">
                  {activeProduct.shippingText}
                </p>
                <span className="meli-shipping-link">Más formas de entrega</span>
              </div>
            </div>

            {/* Free Returns */}
            <div className="meli-return-card">
              <RotateCcw size={16} color="#00a650" />
              <div>
                <span className="meli-return-title">Devolución gratis</span>
                <p className="meli-return-sub">Tenés 30 días desde que lo recibís.</p>
              </div>
            </div>

            {/* Color Selector */}
            <div className="meli-variation-block">
              <div className="meli-variation-header">
                <span>Color: <strong>{selectedColor}</strong></span>
              </div>
              <div className="meli-color-swatches">
                {activeProduct.colors.map(col => (
                  <button
                    key={col.name}
                    type="button"
                    title={col.name}
                    className={`meli-swatch-btn ${selectedColor === col.name ? 'active' : ''}`}
                    onClick={() => setSelectedColor(col.name)}
                  >
                    <span className="swatch-circle" style={{ backgroundColor: col.hex }} />
                    <span className="swatch-name">{col.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Size Selector (If applicable) */}
            {activeProduct.sizes && (
              <div className="meli-variation-block">
                <div className="meli-variation-header">
                  <span>Talle: <strong>{selectedSize}</strong></span>
                  <span className="meli-size-guide-link">Guía de talles</span>
                </div>
                <div className="meli-sizes-row">
                  {activeProduct.sizes.map(size => (
                    <button
                      key={size}
                      type="button"
                      className={`meli-size-btn ${selectedSize === size ? 'active' : ''}`}
                      onClick={() => setSelectedSize(size)}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Stock status */}
            <div className="meli-stock-row">
              <strong>Stock disponible</strong>
              <span>(Cantidad: 1 unidad, +{activeProduct.stockCount} disponibles)</span>
            </div>

            {/* Action Buttons */}
            <div className="meli-actions-column">
              <button type="button" className="meli-btn-buy-now">
                Comprar ahora
              </button>
              <button type="button" className="meli-btn-add-cart">
                Agregar al carrito
              </button>
            </div>

            {/* Seller Reputation Box */}
            <div className="meli-seller-card">
              <div className="meli-seller-header">
                <span className="meli-seller-title">Información sobre el vendedor</span>
                <div className="meli-seller-badge-row">
                  <Award size={15} color="#3483fa" />
                  <strong>{activeProduct.seller.name}</strong>
                  {activeProduct.seller.isOfficial && <span className="seller-official-pill">Oficial</span>}
                </div>
                <span className="meli-seller-level">{activeProduct.seller.level}</span>
              </div>

              {/* 5-Step Green Thermometer Bar */}
              <div className="meli-thermometer-bar">
                <span className="thermo-step" />
                <span className="thermo-step" />
                <span className="thermo-step" />
                <span className="thermo-step" />
                <span className="thermo-step active-platinum" />
              </div>

              {/* Seller Sub-metrics */}
              <div className="meli-seller-metrics">
                <div className="seller-metric-col">
                  <strong>{activeProduct.seller.salesCount}</strong>
                  <span>Ventas concretadas</span>
                </div>
                <div className="seller-metric-col">
                  <strong>⭐ 4.9</strong>
                  <span>Brinda buena atención</span>
                </div>
                <div className="seller-metric-col">
                  <strong>⚡ 100%</strong>
                  <span>Despacha a tiempo</span>
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* ───────────────────────────────────────────────────────────── */}
        {/* ── PREGUNTAS Y RESPUESTAS SIMULATOR SECTION (MERCADO LIBRE) ── */}
        {/* ───────────────────────────────────────────────────────────── */}
        <div id="preguntas-section" className="meli-questions-section">
          
          {/* Section Header with live AI Banner */}
          <div className="meli-questions-header">
            <div>
              <h2 className="meli-questions-title">Preguntas y respuestas</h2>
              <p className="meli-questions-subtitle">
                Interactuá directamente con la publicación. Consultá cualquier duda y mirá cómo responde MELI AI con precisión humana en milisegundos.
              </p>
            </div>
            <div className="meli-ai-live-indicator">
              <div className="live-pulse-dot" />
              <div>
                <strong>MELI AI Motor RAG Conectado</strong>
                <span>Ficha técnica + Stock Flex + Factura A sincronizados</span>
              </div>
            </div>
          </div>

          {/* "¿Qué querés saber?" Quick Topic Chips */}
          <div className="meli-topic-pills-box">
            <span className="topic-pills-title">¿Qué querés saber?</span>
            <div className="topic-pills-row">
              {topicPills.map((pill, idx) => (
                <button
                  key={idx}
                  type="button"
                  className="meli-topic-pill"
                  onClick={() => {
                    setInputQuestion(pill.query)
                    handleAskQuestion(pill.query)
                  }}
                >
                  {pill.label}
                </button>
              ))}
            </div>
          </div>

          {/* "Preguntale al vendedor" Form */}
          <div className="meli-ask-box">
            <h3 className="meli-ask-title">Preguntale al vendedor</h3>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                handleAskQuestion()
              }}
              className="meli-ask-form"
            >
              <div className="meli-input-wrap">
                <input
                  type="text"
                  className="meli-ask-input"
                  placeholder="Escribí tu pregunta sobre stock, talles, factura A, envíos Flex..."
                  value={inputQuestion}
                  onChange={(e) => setInputQuestion(e.target.value)}
                  disabled={isSimulating}
                />
                <button
                  type="submit"
                  className="meli-ask-submit-btn"
                  disabled={!inputQuestion.trim() || isSimulating}
                >
                  {isSimulating ? (
                    <RefreshCw size={16} className="spin-icon" />
                  ) : (
                    <span>Preguntar</span>
                  )}
                </button>
              </div>
            </form>

            {/* Fast 1-Click Suggestion Chips */}
            <div className="meli-preset-chips-row">
              <span className="preset-label">O probá con estas consultas frecuentes:</span>
              <div className="preset-buttons-wrap">
                {presetChips.map((chip, idx) => (
                  <button
                    key={idx}
                    type="button"
                    className="meli-preset-chip"
                    onClick={() => {
                      setInputQuestion(chip)
                      handleAskQuestion(chip)
                    }}
                    disabled={isSimulating}
                  >
                    "{chip}"
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* AI Simulation in Progress Indicator */}
          {isSimulating && (
            <div className="meli-simulating-card">
              <div className="sim-spinner-wrap">
                <Sparkles size={18} className="sim-sparkle-pulse" />
              </div>
              <div className="sim-text-wrap">
                <strong>MELI AI analizando publicación {activeProduct.mla}...</strong>
                <span>Consultando atributos técnicos, reglas de Factura A, disponibilidad de talle y corte de horario Flex.</span>
              </div>
              <div className="sim-badge-time">
                <Clock size={13} />
                <span>&lt; 1.2s</span>
              </div>
            </div>
          )}

          {/* Últimas preguntas realizadas (Feed) */}
          <div className="meli-qa-history-box">
            <div className="qa-history-header">
              <h3 className="qa-history-title">Últimas preguntas realizadas</h3>
              <span className="qa-history-count">{questionsList.length} consultas</span>
            </div>

            <div className="qa-history-list">
              {questionsList.map((item) => (
                <div key={item.id} className={`qa-item-card ${item.isNew ? 'new-qa-highlight' : ''}`}>
                  {/* Buyer Question */}
                  <div className="qa-question-row">
                    <div className="qa-buyer-text">
                      <span className="qa-q-text">{item.question}</span>
                      <span className="qa-time-ago">{item.timeAgo}</span>
                    </div>
                  </div>

                  {/* Seller Answer */}
                  <div className="qa-answer-row">
                    <div className="qa-reply-curve">↳</div>
                    <div className="qa-reply-content">
                      <p className="qa-reply-text">{item.answer}</p>
                      <div className="qa-ai-meta-tag">
                        <div className="meta-speed-tag">
                          <Zap size={12} />
                          <span>Respondido en {item.latency} por <strong>MELI AI</strong></span>
                        </div>
                        <span className="meta-rule-tag">Regla: {item.ruleApplied}</span>
                        <span className="meta-auto-tag">✓ 100% Automático</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

      </div>
    </div>
  )
}
