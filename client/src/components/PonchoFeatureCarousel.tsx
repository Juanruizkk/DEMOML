import React, { useRef, useEffect, useState } from 'react'
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
    description: 'A diferencia de bots genéricos, MELI AI sincroniza tus publicaciones en tiempo real y extrae especificaciones, medidas y compatibilidades.',
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
            <span className="widget-sub-label">Sincronización API</span>
            <span className="widget-sub-value" style={{ color: '#7CFFB2' }}>Ficha + Variantes</span>
          </div>
          <div className="widget-sub-row border-top">
            <span className="widget-sub-label">Extracción RAG</span>
            <span className="widget-sub-value" style={{ color: '#7CFFB2' }}>MLA en vivo</span>
          </div>
        </div>
      </div>
    )
  },
  {
    id: 'feature-claims',
    badge: 'Post-Venta & SLA',
    tag: 'Reputación Verde',
    title: 'Blindá tu reputación MercadoLíder',
    description: 'Detecta dudas críticas post-compra antes de que se conviertan en reclamos formales que afecten tu termómetro.',
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
              <span className="widget-sub-text">Tasa de reclamos</span>
            </div>
            <span className="widget-pill-val">&lt; 0.2%</span>
          </div>
          <div className="widget-sub-row border-top highlight-sub">
            <div className="widget-dot-wrap">
              <span className="widget-tiny-dot" style={{ background: '#FFB4D0', boxShadow: '0 0 0 3px rgba(255,180,208,0.25)' }} />
              <span className="widget-sub-text" style={{ color: '#FFB4D0', fontWeight: 700 }}>Termómetro</span>
            </div>
            <span className="widget-pill-val" style={{ color: '#FFB4D0', fontWeight: 700 }}>Platinum 100%</span>
          </div>
          <div className="widget-sub-row border-top">
            <div className="widget-dot-wrap">
              <span className="widget-tiny-dot" style={{ background: 'rgba(255,255,255,0.28)' }} />
              <span className="widget-sub-text">Resolución SLA</span>
            </div>
            <span className="widget-pill-val">&lt; 8 min</span>
          </div>
        </div>
      </div>
    )
  },
  {
    id: 'feature-rules',
    badge: 'Reglas de Negocio',
    tag: 'Flex & Factura A',
    title: 'Factura A y corte Flex automáticos',
    description: 'Configura políticas fiscales con CUIT discriminado y horarios límite de despacho en el día sin intervención manual.',
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
            <span className="widget-sub-value" style={{ color: '#FDE047' }}>Automática con CUIT</span>
          </div>
          <div className="widget-sub-row border-top">
            <span className="widget-sub-label">Envíos Flex</span>
            <span className="widget-sub-value" style={{ color: '#FDE047' }}>Corte 14:00 hs</span>
          </div>
        </div>
      </div>
    )
  },
  {
    id: 'feature-notifications',
    badge: 'Alertas VIP',
    tag: 'Multicanal',
    title: 'Notificaciones instantáneas',
    description: 'Recibe alertas en Telegram y WhatsApp cuando un comprador mayorista solicite presupuesto o una consulta requiera tu aprobación.',
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
            <span>⚡ Webhooks</span>
          </div>
          <div className="channel-box">
            <span>✉️ Email</span>
          </div>
        </div>
      </div>
    )
  },
  {
    id: 'feature-speed',
    badge: 'Atención 24/7',
    tag: 'Ultra Rápido',
    title: 'Vendé mientras dormís',
    description: 'El 35% de las compras se definen fuera del horario comercial. MELI AI responde en menos de 2 segundos en madrugadas y feriados.',
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
            <span className="widget-sub-label">03:42 AM (Madrugada)</span>
            <span className="widget-sub-value" style={{ color: '#7DD3FC' }}>Respondido 1.2s</span>
          </div>
          <div className="widget-sub-row border-top">
            <span className="widget-sub-label">Domingos y Feriados</span>
            <span className="widget-sub-value" style={{ color: '#7DD3FC' }}>100% Activo</span>
          </div>
        </div>
      </div>
    )
  },
  {
    id: 'feature-antiban',
    badge: 'Seguridad',
    tag: '100% Oficial',
    title: 'Cero infracciones en Mercado Libre',
    description: 'Filtro inteligente que bloquea datos de contacto externos (teléfonos, links) cumpliendo estrictamente los términos del sitio.',
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
            <span className="widget-sub-label">Teléfonos / Emails</span>
            <span className="widget-sub-value" style={{ color: '#FDBA74' }}>Bloqueo Antiban</span>
          </div>
          <div className="widget-sub-row border-top">
            <span className="widget-sub-label">API Mercado Libre</span>
            <span className="widget-sub-value" style={{ color: '#FDBA74' }}>OAuth 2.0 Oficial</span>
          </div>
        </div>
      </div>
    )
  },
  {
    id: 'feature-analytics',
    badge: 'Métricas & ROI',
    tag: 'Dashboard',
    title: 'Medí el crecimiento de tus ventas',
    description: 'Dashboard en vivo con volumen de consultas, latencia media, tasa de conversión y retorno de inversión en tiempo real.',
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
            <span className="widget-sub-label">Aumento en ventas</span>
            <span className="widget-sub-value" style={{ color: '#F0ABFC' }}>+28% Conversión</span>
          </div>
          <div className="widget-sub-row border-top">
            <span className="widget-sub-label">Tiempo de respuesta</span>
            <span className="widget-sub-value" style={{ color: '#F0ABFC' }}>&lt; 1.4 segundos</span>
          </div>
        </div>
      </div>
    )
  }
]

export default function PonchoFeatureCarousel() {
  const containerRef = useRef<HTMLDivElement>(null)
  const stickyRef = useRef<HTMLDivElement>(null)
  const [scrollProgress, setScrollProgress] = useState<number>(0)
  const [activeIndex, setActiveIndex] = useState<number>(0)

  useEffect(() => {
    const handleScroll = () => {
      if (!containerRef.current) return

      const rect = containerRef.current.getBoundingClientRect()
      const totalScrollable = containerRef.current.scrollHeight - window.innerHeight
      const currentScroll = -rect.top

      if (totalScrollable <= 0) return

      // Progress normalized 0 to 1
      const progress = Math.min(Math.max(currentScroll / totalScrollable, 0), 1)
      setScrollProgress(progress)

      // Calculate active card index (0 to 6)
      const exactIndex = progress * (FEATURE_CARDS.length - 1)
      const roundedIndex = Math.round(exactIndex)
      setActiveIndex(roundedIndex)
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    handleScroll()

    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Calculate track translateX based on progress
  // At progress 0: first card is in focal area (shifted slightly right or center)
  // At progress 1: last card is in focal area
  const cardWidth = 330
  const cardGap = 20
  const totalTrackWidth = FEATURE_CARDS.length * (cardWidth + cardGap) - cardGap
  const windowWidth = typeof window !== 'undefined' ? window.innerWidth : 1200
  const focalOffset = Math.max((windowWidth - cardWidth) / 2, 20)
  const maxTranslate = totalTrackWidth - windowWidth + focalOffset * 2
  const currentTranslateX = focalOffset - scrollProgress * (totalTrackWidth - cardWidth)

  const scrollToCard = (index: number) => {
    if (!containerRef.current) return
    const totalScrollable = containerRef.current.scrollHeight - window.innerHeight
    const targetProgress = index / (FEATURE_CARDS.length - 1)
    const targetScrollY = containerRef.current.offsetTop + targetProgress * totalScrollable
    window.scrollTo({ top: targetScrollY, behavior: 'smooth' })
  }

  return (
    <div ref={containerRef} className="poncho-carousel-container" id="features">
      <div ref={stickyRef} className="poncho-sticky-frame">
        
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
        <div className="poncho-3d-wrapper" style={{ perspective: '1200px' }}>
          <div
            className="poncho-track flex will-change-transform"
            style={{
              transform: `translateX(${currentTranslateX}px)`,
              gap: `${cardGap}px`
            }}
          >
            {FEATURE_CARDS.map((card, idx) => {
              // Calculate distance from active focal point
              const currentExactIndex = scrollProgress * (FEATURE_CARDS.length - 1)
              const diff = idx - currentExactIndex

              // Calculate 3D transforms
              const translateY = Math.abs(diff) * 14.5
              const scale = Math.max(1 - Math.abs(diff) * 0.075, 0.82)
              const rotate = diff * 3.4
              const opacity = Math.max(1 - Math.abs(diff) * 0.22, 0.42)
              const zIndex = Math.round(40 - Math.abs(diff) * 5)

              return (
                <div
                  key={card.id}
                  id={card.id}
                  className="poncho-card-item shrink-0"
                  style={{
                    width: `${cardWidth}px`,
                    height: '380px',
                    opacity,
                    zIndex,
                    transform: `translateY(${translateY}px) scale(${scale}) rotate(${rotate}deg)`,
                    transition: 'opacity 0.1s linear, transform 0.1s linear'
                  }}
                  onClick={() => scrollToCard(idx)}
                >
                  <div
                    className="poncho-card-inner"
                    style={{
                      height: '380px',
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

                    {/* Top Row: Pill Badge + Location */}
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
              />
            ))}
          </div>

          <button
            type="button"
            className="carousel-nav-arrow"
            onClick={() => scrollToCard(Math.min(FEATURE_CARDS.length - 1, activeIndex + 1))}
            disabled={activeIndex === FEATURE_CARDS.length - 1}
            title="Siguiente"
          >
            <ChevronRight size={18} />
          </button>
        </div>

      </div>
    </div>
  )
}
