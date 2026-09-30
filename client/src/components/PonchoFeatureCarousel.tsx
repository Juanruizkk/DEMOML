import React, { useRef, useEffect, useState, useCallback } from 'react'
import {
  Zap,
  ShieldCheck,
  Sliders,
  Bell,
  Clock,
  Lock,
  TrendingUp,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  CheckCircle2,
  Cpu
} from 'lucide-react'
import './PonchoFeatureCarousel.css'

interface FeatureCardData {
  id: string
  badge: string
  tag: string
  title: string
  description: string
  accentColor: string
  badgeBg: string
  gradient: string
  borderColor: string
  actionText: string
  actionLink: string
  renderWidget: () => React.ReactNode
}

const FEATURE_CARDS: FeatureCardData[] = [
  {
    id: 'feature-rag',
    badge: 'Motor RAG',
    tag: 'Sincronización en vivo',
    title: 'Fichas técnicas y stock al milímetro',
    description:
      'A diferencia de bots genéricos, MELI AI sincroniza tus publicaciones en tiempo real y extrae especificaciones, medidas y compatibilidades directamente de la API oficial.',
    accentColor: '#7CFFB2',
    badgeBg: 'rgba(255, 255, 255, 0.12)',
    gradient: 'linear-gradient(160deg, rgb(15, 61, 46) 0%, rgb(26, 107, 74) 55%, rgb(11, 46, 34) 100%)',
    borderColor: 'rgba(255, 255, 255, 0.14)',
    actionText: 'Probar Motor RAG',
    actionLink: '#simulator',
    renderWidget: () => (
      <div className="card-custom-widget">
        <div className="widget-row-bordered">
          <div className="widget-sub-row">
            <span className="widget-sub-label">Datos sincronizados</span>
            <span className="widget-sub-value" style={{ color: '#7CFFB2' }}>
              Ficha + Variantes
            </span>
          </div>
          <div className="widget-sub-row border-top">
            <span className="widget-sub-label">Fuente de datos</span>
            <span className="widget-sub-value" style={{ color: '#7CFFB2' }}>
              API Oficial ML
            </span>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: 'feature-claims',
    badge: 'Post-Venta & Reputación',
    tag: 'Reputación Verde',
    title: 'Mantenete por debajo del 1,5% de reclamos',
    description:
      'ML requiere responder mensajes post-venta en menos de 8 horas hábiles. Superar el 1,5% de reclamos o no responder a tiempo baja tu termómetro y tu visibilidad.',
    accentColor: '#FFB4D0',
    badgeBg: 'rgba(255, 255, 255, 0.14)',
    gradient: 'linear-gradient(160deg, rgb(80, 11, 40) 0%, rgb(192, 24, 90) 50%, rgb(131, 11, 52) 100%)',
    borderColor: 'rgba(255, 255, 255, 0.16)',
    actionText: 'Ver Módulo Post-Venta',
    actionLink: '/login?register=true',
    renderWidget: () => (
      <div className="card-custom-widget">
        <div className="widget-row-bordered">
          <div className="widget-sub-row">
            <div className="widget-dot-wrap">
              <span className="widget-tiny-dot" style={{ background: 'rgba(255,255,255,0.28)' }} />
              <span className="widget-sub-text">Umbral reclamos (ML oficial)</span>
            </div>
            <span className="widget-pill-val">&lt; 1,5%</span>
          </div>
          <div className="widget-sub-row border-top highlight-sub">
            <div className="widget-dot-wrap">
              <span
                className="widget-tiny-dot"
                style={{ background: '#FFB4D0', boxShadow: '0 0 0 3px rgba(255,180,208,0.25)' }}
              />
              <span className="widget-sub-text" style={{ color: '#FFB4D0', fontWeight: 700 }}>
                Respuesta post-venta
              </span>
            </div>
            <span className="widget-pill-val" style={{ color: '#FFB4D0', fontWeight: 700 }}>
              &lt; 8 hs hábiles
            </span>
          </div>
          <div className="widget-sub-row border-top">
            <div className="widget-dot-wrap">
              <span className="widget-tiny-dot" style={{ background: 'rgba(255,255,255,0.28)' }} />
              <span className="widget-sub-text">Ventana de medición</span>
            </div>
            <span className="widget-pill-val">60 días</span>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: 'feature-rules',
    badge: 'Reglas de Negocio',
    tag: 'Flex & Factura A',
    title: 'Factura A y corte Flex automáticos',
    description:
      'Configura políticas fiscales con CUIT discriminado y horarios límite de despacho en el día. El bot las aplica en cada respuesta sin intervención manual.',
    accentColor: '#FDE047',
    badgeBg: 'rgba(255, 255, 255, 0.12)',
    gradient: 'linear-gradient(160deg, rgb(55, 30, 8) 0%, rgb(133, 77, 14) 55%, rgb(45, 22, 5) 100%)',
    borderColor: 'rgba(255, 255, 255, 0.14)',
    actionText: 'Configurar Reglas',
    actionLink: '/login?register=true',
    renderWidget: () => (
      <div className="card-custom-widget">
        <div className="widget-row-bordered">
          <div className="widget-sub-row">
            <span className="widget-sub-label">Facturación A/B</span>
            <span className="widget-sub-value" style={{ color: '#FDE047' }}>
              Automática con CUIT
            </span>
          </div>
          <div className="widget-sub-row border-top">
            <span className="widget-sub-label">Envíos Flex</span>
            <span className="widget-sub-value" style={{ color: '#FDE047' }}>
              Corte 14:00 hs
            </span>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: 'feature-notifications',
    badge: 'Alertas VIP',
    tag: 'Multicanal',
    title: 'Vos decidís qué te llega y cuándo',
    description:
      'Recibí alertas en Telegram o WhatsApp cuando una consulta necesite tu aprobación, llegue un pedido mayorista o una métrica de reputación entre en zona de riesgo.',
    accentColor: '#C7D2FE',
    badgeBg: 'rgba(255, 255, 255, 0.1)',
    gradient: 'linear-gradient(160deg, rgb(26, 26, 56) 0%, rgb(49, 46, 129) 55%, rgb(20, 18, 48) 100%)',
    borderColor: 'rgba(255, 255, 255, 0.12)',
    actionText: 'Ver Integraciones',
    actionLink: '/login?register=true',
    renderWidget: () => (
      <div className="card-custom-widget">
        <div className="channels-pill-grid">
          <div className="channel-box">
            <span>💬 Telegram</span>
          </div>
          <div className="channel-box">
            <span>📱 WhatsApp</span>
          </div>
          <div className="channel-box">
            <span>✉️ Email</span>
          </div>
          <div className="channel-box">
            <span>⚡ Webhooks</span>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: 'feature-speed',
    badge: 'Atención 24/7',
    tag: 'Respondé antes que nadie',
    title: 'ML mide tu tiempo de respuesta a toda hora',
    description:
      'Una pregunta sin responder a las 2am cuenta como horas de demora al día siguiente. ML recomienda responder en menos de 10 minutos para no perder posición.',
    accentColor: '#7DD3FC',
    badgeBg: 'rgba(255, 255, 255, 0.12)',
    gradient: 'linear-gradient(160deg, rgb(12, 74, 110) 0%, rgb(3, 105, 161) 55%, rgb(7, 89, 133) 100%)',
    borderColor: 'rgba(255, 255, 255, 0.14)',
    actionText: 'Activar 24/7',
    actionLink: '/login?register=true',
    renderWidget: () => (
      <div className="card-custom-widget">
        <div className="widget-row-bordered">
          <div className="widget-sub-row">
            <span className="widget-sub-label">Ideal según ML oficial</span>
            <span className="widget-sub-value" style={{ color: '#7DD3FC' }}>
              &lt; 10 minutos
            </span>
          </div>
          <div className="widget-sub-row border-top">
            <span className="widget-sub-label">Domingos y feriados</span>
            <span className="widget-sub-value" style={{ color: '#7DD3FC' }}>
              100% activo
            </span>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: 'feature-antiban',
    badge: 'Seguridad',
    tag: '100% Oficial',
    title: 'Cero infracciones en Mercado Libre',
    description:
      'Filtro inteligente que bloquea datos de contacto externos (teléfonos, links) en cada respuesta, cumpliendo estrictamente los términos del sitio. Conexión vía OAuth 2.0 oficial.',
    accentColor: '#FDBA74',
    badgeBg: 'rgba(255, 255, 255, 0.1)',
    gradient: 'linear-gradient(160deg, rgb(28, 25, 23) 0%, rgb(68, 64, 60) 50%, rgb(41, 37, 36) 100%)',
    borderColor: 'rgba(255, 255, 255, 0.12)',
    actionText: 'Seguridad y Políticas',
    actionLink: '/login?register=true',
    renderWidget: () => (
      <div className="card-custom-widget">
        <div className="widget-row-bordered">
          <div className="widget-sub-row">
            <span className="widget-sub-label">Teléfonos / Links externos</span>
            <span className="widget-sub-value" style={{ color: '#FDBA74' }}>
              Bloqueo automático
            </span>
          </div>
          <div className="widget-sub-row border-top">
            <span className="widget-sub-label">Autenticación</span>
            <span className="widget-sub-value" style={{ color: '#FDBA74' }}>
              OAuth 2.0 Oficial
            </span>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: 'feature-analytics',
    badge: 'Métricas & ROI',
    tag: 'Dashboard en vivo',
    title: '1 de cada 5 preguntas respondida rápido termina en venta',
    description:
      'Según Real Trends, responder en menos de 30 minutos multiplica la probabilidad de cierre. Medí cuántas consultas convierte tu bot y optimizá en tiempo real.',
    accentColor: '#F0ABFC',
    badgeBg: 'rgba(255, 255, 255, 0.14)',
    gradient: 'linear-gradient(160deg, rgb(74, 4, 78) 0%, rgb(162, 28, 175) 45%, rgb(112, 26, 117) 100%)',
    borderColor: 'rgba(255, 255, 255, 0.16)',
    actionText: 'Explorar Dashboard',
    actionLink: '/login?register=true',
    renderWidget: () => (
      <div className="card-custom-widget">
        <div className="widget-row-bordered">
          <div className="widget-sub-row">
            <span className="widget-sub-label">Incremento conversión (Real Trends)</span>
            <span className="widget-sub-value" style={{ color: '#F0ABFC' }}>
              +10% a +25%
            </span>
          </div>
          <div className="widget-sub-row border-top">
            <span className="widget-sub-label">Espera de 6 horas</span>
            <span className="widget-sub-value" style={{ color: '#F0ABFC' }}>
              −30% probabilidad
            </span>
          </div>
        </div>
      </div>
    ),
  },
]

export default function PonchoFeatureCarousel() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [scrollProgress, setScrollProgress] = useState<number>(0)
  const [activeIndex, setActiveIndex] = useState<number>(0)
  const [windowWidth, setWindowWidth] = useState<number>(typeof window !== 'undefined' ? window.innerWidth : 1200)

  // Touch swipe support on mobile
  const touchStartXRef = useRef<number | null>(null)
  const touchDeltaXRef = useRef<number>(0)

  // Track window resize
  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Handle scroll calculation
  useEffect(() => {
    let ticking = false

    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          if (containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect()
            const totalScrollable = containerRef.current.offsetHeight - window.innerHeight
            const currentScroll = -rect.top

            if (totalScrollable > 0) {
              const rawProgress = currentScroll / totalScrollable
              const progress = Math.min(Math.max(rawProgress, 0), 1)
              setScrollProgress(progress)

              const exactIndex = progress * (FEATURE_CARDS.length - 1)
              setActiveIndex(Math.round(exactIndex))
            }
          }
          ticking = false
        })
        ticking = true
      }
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    handleScroll()

    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Responsive Card Geometry: on screens < 360px, shrink card width to fit comfortably
  const cardWidth = Math.min(320, windowWidth - 44)
  const cardGap = windowWidth < 640 ? 14 : 20
  
  // Mathematical Centering:
  // Active fractional index is centered at windowWidth / 2
  const currentExactIndex = scrollProgress * (FEATURE_CARDS.length - 1)
  const currentTranslateX = (windowWidth / 2) - (currentExactIndex * (cardWidth + cardGap) + cardWidth / 2)

  const scrollToCard = (index: number) => {
    if (!containerRef.current) return
    const totalScrollable = containerRef.current.offsetHeight - window.innerHeight
    const targetProgress = index / (FEATURE_CARDS.length - 1)
    const targetScrollY = containerRef.current.offsetTop + targetProgress * totalScrollable
    window.scrollTo({ top: targetScrollY, behavior: 'smooth' })
  }

  // Touch swipe handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0].clientX
    touchDeltaXRef.current = 0
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartXRef.current !== null) {
      touchDeltaXRef.current = e.touches[0].clientX - touchStartXRef.current
    }
  }

  const handleTouchEnd = () => {
    if (touchStartXRef.current !== null) {
      const delta = touchDeltaXRef.current
      if (delta < -45 && activeIndex < FEATURE_CARDS.length - 1) {
        scrollToCard(activeIndex + 1)
      } else if (delta > 45 && activeIndex > 0) {
        scrollToCard(activeIndex - 1)
      }
      touchStartXRef.current = null
      touchDeltaXRef.current = 0
    }
  }

  return (
    <div ref={containerRef} className="poncho-carousel-container" id="features">
      <div className="poncho-sticky-frame">
        
        {/* Section Header */}
        <div className="landing-container poncho-header-container">
          <div className="section-header poncho-section-header">
            <div className="section-tag">
              <Sparkles size={14} />
              <span>Superpoderes de MELI AI</span>
            </div>
            <h2 className="section-title">
              Tecnología diseñada para escalar tus ventas
            </h2>
            <p className="section-desc">
              Todo lo que necesitas para automatizar tu tienda en Mercado Libre, con la máxima precisión y seguridad.
            </p>
          </div>
        </div>

        {/* ── 3D Perspective Carousel Track ── */}
        <div
          className="poncho-3d-wrapper"
          style={{ perspective: windowWidth < 640 ? '900px' : '1200px' }}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div
            className="poncho-track flex will-change-transform"
            style={{
              transform: `translateX(${currentTranslateX}px)`,
              gap: `${cardGap}px`
            }}
          >
            {FEATURE_CARDS.map((card, idx) => {
              // Distance from focal point (-6 to +6)
              const diff = idx - currentExactIndex
              const absDiff = Math.abs(diff)

              // 3D parameters matching Poncho Capital exact attributes
              const translateY = Math.min(absDiff * (windowWidth < 640 ? 10 : 14.5), 36)
              const scale = Math.max(1 - absDiff * (windowWidth < 640 ? 0.06 : 0.075), 0.82)
              const rotate = Math.max(Math.min(diff * (windowWidth < 640 ? 2.5 : 3.3), 8), -8)
              const opacity = Math.max(1 - absDiff * 0.22, 0.45)
              const zIndex = Math.max(Math.round(35 - absDiff * 5), 1)

              return (
                <div
                  key={card.id}
                  id={card.id}
                  className="poncho-card-item shrink-0"
                  style={{
                    width: `${cardWidth}px`,
                    opacity,
                    zIndex,
                    transform: `translateY(${translateY}px) scale(${scale}) rotate(${rotate}deg)`,
                    transition: 'transform 0.05s ease-out, opacity 0.05s ease-out'
                  }}
                  onClick={() => scrollToCard(idx)}
                >
                  <div
                    className="poncho-card-inner"
                    style={{
                      background: card.gradient,
                      color: '#ffffff',
                      borderColor: card.borderColor
                    }}
                  >
                    {/* Inner light reflection glow */}
                    <div
                      className="card-glass-glow"
                      aria-hidden="true"
                    />

                    {/* Top Row: Pill Badge + Tag */}
                    <div className="card-top-row">
                      <span
                        className="card-badge-pill"
                        style={{
                          background: card.badgeBg,
                          color: card.accentColor
                        }}
                      >
                        {card.badge}
                      </span>
                      <span className="card-tag-sub">
                        {card.tag}
                      </span>
                    </div>

                    {/* Title & Description */}
                    <h3 className="card-main-title">
                      {card.title}
                    </h3>
                    <p className="card-desc">
                      {card.description}
                    </p>

                    {/* Custom Widget */}
                    <div className="card-widget-slot">
                      {card.renderWidget()}
                    </div>

                    {/* Action Link with Arrow */}
                    <a
                      href={card.actionLink}
                      className="card-action-link"
                      style={{ color: card.accentColor }}
                      onClick={(e) => {
                        if (card.actionLink.startsWith('#')) {
                          e.preventDefault()
                          const el = document.querySelector(card.actionLink)
                          if (el) el.scrollIntoView({ behavior: 'smooth' })
                        }
                      }}
                    >
                      <span>{card.actionText}</span>
                      <ArrowRight size={16} />
                    </a>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Left / Right Fade Gradients */}
          <div className="carousel-edge-fade-left" aria-hidden="true" />
          <div className="carousel-edge-fade-right" aria-hidden="true" />
        </div>

        {/* ── Carousel Bottom Navigation Dots & Indicators ── */}
        <div className="poncho-controls-bar">
          <button
            type="button"
            className="carousel-nav-arrow"
            onClick={() => scrollToCard(Math.max(0, activeIndex - 1))}
            disabled={activeIndex === 0}
            title="Anterior"
            aria-label="Card anterior"
          >
            <ChevronLeft size={18} />
          </button>

          <div className="carousel-dots-row">
            {FEATURE_CARDS.map((card, idx) => (
              <button
                key={idx}
                type="button"
                className={`carousel-dot-pill ${activeIndex === idx ? 'active' : ''}`}
                style={{
                  backgroundColor: activeIndex === idx ? card.accentColor : undefined,
                  boxShadow: activeIndex === idx ? `0 0 10px ${card.accentColor}` : undefined
                }}
                onClick={() => scrollToCard(idx)}
                title={card.title}
                aria-label={card.title}
              />
            ))}
          </div>

          <button
            type="button"
            className="carousel-nav-arrow"
            onClick={() => scrollToCard(Math.min(FEATURE_CARDS.length - 1, activeIndex + 1))}
            disabled={activeIndex === FEATURE_CARDS.length - 1}
            title="Siguiente"
            aria-label="Siguiente card"
          >
            <ChevronRight size={18} />
          </button>
        </div>

      </div>
    </div>
  )
}
