import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Bot,
  Zap,
  ShieldCheck,
  TrendingUp,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  XCircle,
  MessageSquare,
  Clock,
  Layers,
  Sliders,
  Bell,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Cpu,
  Store,
  DollarSign,
  Award,
  Lock
} from 'lucide-react'
import MeliProductSimulator from '../components/MeliProductSimulator'
import PonchoFeatureCarousel from '../components/PonchoFeatureCarousel'
import './LandingPage.css'

export default function LandingPage() {
  const navigate = useNavigate()

  // ROI Calculator State
  const [monthlyQuestions, setMonthlyQuestions] = useState<number>(1500)

  // Pricing State
  const [isAnnual, setIsAnnual] = useState<boolean>(false)

  // FAQ Accordion State
  const [openFaq, setOpenFaq] = useState<number | null>(0)

  // Lead Capture Form State
  const [leadForm, setLeadForm] = useState({
    name: '', email: '', phone: '', mlStore: '', weeklyQuestions: '' as string
  })
  const [leadSubmitting, setLeadSubmitting] = useState(false)
  const [leadResult, setLeadResult] = useState<'qualified' | 'disqualified' | null>(null)

  const handleLeadSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!leadForm.weeklyQuestions) return
    setLeadSubmitting(true)
    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(leadForm),
      })
      if (!res.ok) {
        // Server error — fail open, don't punish valid user
        setLeadResult('qualified')
        return
      }
      const data = await res.json()
      setLeadResult(data.qualified ? 'qualified' : 'disqualified')
    } catch {
      setLeadResult('qualified') // fail open — don't punish the user
    } finally {
      setLeadSubmitting(false)
    }
  }

  const toggleFaq = (idx: number) => {
    setOpenFaq(prev => (prev === idx ? null : idx))
  }

  // Calculations for ROI
  const hoursSaved = Math.round(monthlyQuestions * 0.045)
  const estimatedSalesBump = Math.round(monthlyQuestions * 0.065)
  const estimatedRevenueGain = (estimatedSalesBump * 35).toLocaleString('es-AR')

  // Pricing values
  const starterPrice = isAnnual ? 23 : 29
  const proPrice = isAnnual ? 63 : 79
  const businessPrice = isAnnual ? 159 : 199

  return (
    <div className="landing-root">
      <div className="landing-bg-grid" />

      {/* ── Navigation Header ── */}
      <header className="landing-header">
        <div className="landing-container">
          <nav className="landing-nav">
            <Link to="/" className="landing-logo">
              <div className="landing-logo-icon">
                <Bot size={18} strokeWidth={2.5} />
              </div>
              <span>MELI <strong style={{ color: 'var(--lp-accent)' }}>AI</strong></span>
            </Link>

            <ul className="landing-nav-links">
              <li><a href="#simulator">Simulador ML</a></li>
              <li><a href="#features">Superpoderes</a></li>
              <li><a href="#comparison">Comparativa</a></li>
              <li><a href="#roi">Calculadora ROI</a></li>
              <li><a href="#pricing">Planes</a></li>
              <li><a href="#faq">Preguntas</a></li>
            </ul>

            <div className="landing-nav-actions">
              <Link to="/login" className="landing-btn-login">
                Iniciar Sesión
              </Link>
              <Link to="/login?register=true" className="landing-btn-cta-nav">
                <span>Comenzar Gratis</span>
                <ArrowRight size={15} />
              </Link>
            </div>
          </nav>
        </div>
      </header>

      {/* ── Hero Section ── */}
      <section className="landing-hero">
        <div className="landing-container">
          <div className="hero-pill-badge">
            <span className="hero-pill-dot" />
            <span>Inteligencia Artificial para Sellers de Mercado Libre</span>
          </div>

          <h1 className="hero-main-title">
            <span style={{ color: 'var(--lp-accent)' }}>Multiplica tus ventas</span>{' '}
            en Mercado Libre respondiendo en segundos, 24/7.
          </h1>

          <p className="hero-subtitle">
            Atención automática de preguntas de preventa, sincronización de stock en tiempo real y prevención inteligente de reclamos post-venta con IA de última generación.
          </p>

          <div className="hero-actions-row">
            <Link to="/login?register=true" className="landing-btn-hero-primary">
              <Sparkles size={18} />
              <span>Conectar mi Tienda Gratis</span>
            </Link>
            <a href="#simulator" className="landing-btn-hero-secondary">
              <Zap size={18} />
              <span>Probar Simulador de Preguntas</span>
            </a>
          </div>

          {/* ── Mercado Libre Product & Questions Simulator ── */}
          <div id="simulator" className="hero-meli-sim-wrapper">
            <MeliProductSimulator />
          </div>
        </div>
      </section>

      {/* ── Social Proof Metrics Ticker ── */}
      <section className="landing-ticker-section">
        <div className="landing-container">
          <div className="ticker-grid">
            <div className="ticker-card">
              <h3>+150k</h3>
              <p>Preguntas respondidas con IA</p>
            </div>
            <div className="ticker-card">
              <h3>&lt; 2.1s</h3>
              <p>Tiempo de respuesta promedio</p>
            </div>
            <div className="ticker-card">
              <h3>99.4%</h3>
              <p>Precisión técnica en respuestas</p>
            </div>
            <div className="ticker-card">
              <h3>+28%</h3>
              <p>Aumento en tasa de conversión</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Problem vs Solution Section ── */}
      <section id="comparison" className="landing-section">
        <div className="landing-container">
          <div className="section-header">
            <div className="section-tag">
              <Layers size={14} />
              <span>Comparativa Directa</span>
            </div>
            <h2 className="section-title">El costo de la atención manual vs. el poder de la IA</h2>
            <p className="section-desc">
              En Mercado Libre, el 70% de las ventas de preventa se deciden en los primeros 5 minutos. Quien responde primero con precisión, se queda con la venta.
            </p>
          </div>

          <div className="comparison-grid">
            {/* Card Manual */}
            <div className="comparison-card card-manual">
              <div className="comparison-header">
                <div className="comparison-icon-wrap">
                  <XCircle size={24} />
                </div>
                <div>
                  <h4>Gestión Tradicional Manual</h4>
                  <span style={{ fontSize: '0.78rem', color: '#f87171' }}>Lenta, costosa y con ventas perdidas</span>
                </div>
              </div>
              <ul className="comparison-list">
                <li>
                  <XCircle size={16} />
                  <span><strong>Demoras de 45 a 120 minutos:</strong> El comprador pregunta en tu publicación y en 3 de la competencia simultáneamente.</span>
                </li>
                <li>
                  <XCircle size={16} />
                  <span><strong>Noches y fines de semana vacíos:</strong> Se pierde el 35% del volumen de consultas fuera del horario comercial.</span>
                </li>
                <li>
                  <XCircle size={16} />
                  <span><strong>Errores humanos en stock y facturación:</strong> Respuestas ambiguas que derivan en cancelaciones y compradores molestos.</span>
                </li>
                <li>
                  <XCircle size={16} />
                  <span><strong>Reclamos post-venta imprevistos:</strong> Mensajes de soporte desatendidos que terminan en reclamos afectando la reputación.</span>
                </li>
              </ul>
            </div>

            {/* Card AI */}
            <div className="comparison-card card-ai">
              <div className="comparison-header">
                <div className="comparison-icon-wrap">
                  <CheckCircle2 size={24} />
                </div>
                <div>
                  <h4>Con MELI AI Superpowers</h4>
                  <span style={{ fontSize: '0.78rem', color: '#34d399' }}>Instantánea, precisa y 100% automatizada</span>
                </div>
              </div>
              <ul className="comparison-list">
                <li>
                  <CheckCircle2 size={16} />
                  <span><strong>Respuestas en menos de 2 segundos:</strong> Captura al cliente en el momento exacto de mayor intención de compra.</span>
                </li>
                <li>
                  <CheckCircle2 size={16} />
                  <span><strong>Operación 24/7/365 sin interrupciones:</strong> Tu tienda sigue vendiendo activamente de madrugada y los domingos.</span>
                </li>
                <li>
                  <CheckCircle2 size={16} />
                  <span><strong>Motor RAG con Ficha Técnica:</strong> Conoce especificaciones, medidas, compatibilidades y variantes exactas del producto.</span>
                </li>
                <li>
                  <CheckCircle2 size={16} />
                  <span><strong>Filtro preventivo de reclamos:</strong> Detección temprana de incidentes post-venta con alertas a Telegram y WhatsApp.</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── 3D Scroll Perspective Feature Carousel (Poncho Capital Style) ── */}
      <PonchoFeatureCarousel />


      {/* ── Interactive ROI Calculator ── */}
      <section id="roi" className="landing-section">
        <div className="landing-container">
          <div className="section-header">
            <div className="section-tag">
              <TrendingUp size={14} />
              <span>Calculadora de Retorno</span>
            </div>
            <h2 className="section-title">Calcula el impacto en tu negocio</h2>
            <p className="section-desc">
              Descubre cuánto tiempo y cuántas ventas adicionales puedes generar al mes automatizando la atención de tu tienda.
            </p>
          </div>

          <div className="roi-calculator-box">
            <div className="roi-slider-container">
              <div className="roi-slider-header">
                <span>¿Cuántas preguntas de preventa recibes al mes?</span>
                <strong>{monthlyQuestions.toLocaleString('es-AR')} consultas/mes</strong>
              </div>
              <input
                type="range"
                min="200"
                max="10000"
                step="100"
                value={monthlyQuestions}
                onChange={e => setMonthlyQuestions(Number(e.target.value))}
                className="roi-slider"
              />
            </div>

            <div className="roi-results-grid">
              <div className="roi-result-card">
                <div className="roi-number">{hoursSaved} hs</div>
                <p>Tiempo de atención manual ahorrado al mes</p>
              </div>
              <div className="roi-result-card">
                <div className="roi-number">+{estimatedSalesBump}</div>
                <p>Ventas adicionales estimadas por respuesta instantánea</p>
              </div>
              <div className="roi-result-card">
                <div className="roi-number" style={{ color: 'var(--lp-accent)' }}>+${estimatedRevenueGain} USD</div>
                <p>Facturación extra estimada por mes</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── SaaS Pricing Plans ── */}
      <section id="pricing" className="landing-section" style={{ background: 'var(--lp-surface)' }}>
        <div className="landing-container">
          <div className="section-header">
            <div className="section-tag">
              <DollarSign size={14} />
              <span>Planes Transparentes</span>
            </div>
            <h2 className="section-title">Elige el plan ideal para el tamaño de tu tienda</h2>
            <p className="section-desc">
              Sin contratos forzosos. Cancela o cambia de plan en cualquier momento con 1 solo clic.
            </p>
          </div>

          <div className="pricing-toggle-row">
            <div className="pricing-toggle-btn">
              <button
                type="button"
                className={`pricing-toggle-option ${!isAnnual ? 'active' : ''}`}
                onClick={() => setIsAnnual(false)}
              >
                Mensual
              </button>
              <button
                type="button"
                className={`pricing-toggle-option ${isAnnual ? 'active' : ''}`}
                onClick={() => setIsAnnual(true)}
              >
                Anual
              </button>
            </div>
            {isAnnual && (
              <span className="save-badge">Ahorra 20% anual</span>
            )}
          </div>

          <div className="pricing-cards-grid">
            {/* Starter Plan */}
            <div className="pricing-card">
              <div>
                <div className="pricing-header">
                  <h4>Starter</h4>
                  <p>Para vendedores que están comenzando a profesionalizar su atención.</p>
                </div>
                <div className="pricing-price-box">
                  <span className="price-currency">$</span>
                  <span className="price-amount">{starterPrice}</span>
                  <span className="price-period">/mes {isAnnual && '(facturado anual)'}</span>
                </div>
                <div className="pricing-quota-pill">
                  <Bot size={15} />
                  <span>300 respuestas IA al mes</span>
                </div>
                <ul className="pricing-features-list">
                  <li>
                    <CheckCircle2 size={16} />
                    <span>1 Cuenta de Mercado Libre vinculada</span>
                  </li>
                  <li>
                    <CheckCircle2 size={16} />
                    <span>Sincronización básica de publicaciones</span>
                  </li>
                  <li>
                    <CheckCircle2 size={16} />
                    <span>Atención de preguntas de preventa 24/7</span>
                  </li>
                  <li>
                    <CheckCircle2 size={16} />
                    <span>Reglas de Facturación A/B estándar</span>
                  </li>
                  <li>
                    <CheckCircle2 size={16} />
                    <span>Soporte por correo electrónico</span>
                  </li>
                </ul>
              </div>
              <Link to="/login?register=true&plan=starter" className="pricing-card-btn btn-outline">
                Comenzar con Starter
              </Link>
            </div>

            {/* Pro Plan (Featured) */}
            <div className="pricing-card featured">
              <div className="featured-ribbon">Más Popular</div>
              <div>
                <div className="pricing-header">
                  <h4>Pro</h4>
                  <p>Para MercadoLíderes y tiendas en crecimiento con alto volumen de consultas.</p>
                </div>
                <div className="pricing-price-box">
                  <span className="price-currency">$</span>
                  <span className="price-amount">{proPrice}</span>
                  <span className="price-period">/mes {isAnnual && '(facturado anual)'}</span>
                </div>
                <div className="pricing-quota-pill">
                  <Zap size={15} />
                  <span>1,000 respuestas IA al mes</span>
                </div>
                <ul className="pricing-features-list">
                  <li>
                    <CheckCircle2 size={16} />
                    <span>Hasta 3 Cuentas de Mercado Libre</span>
                  </li>
                  <li>
                    <CheckCircle2 size={16} />
                    <span>Motor RAG avanzado con fichas técnicas completas</span>
                  </li>
                  <li>
                    <CheckCircle2 size={16} />
                    <span><strong>Prevención inteligente de reclamos post-venta</strong></span>
                  </li>
                  <li>
                    <CheckCircle2 size={16} />
                    <span>Reglas de negocio y excepciones ilimitadas</span>
                  </li>
                  <li>
                    <CheckCircle2 size={16} />
                    <span>Alertas instantáneas por Telegram</span>
                  </li>
                  <li>
                    <CheckCircle2 size={16} />
                    <span>Dashboard de métricas y conversión</span>
                  </li>
                </ul>
              </div>
              <Link to="/login?register=true&plan=pro" className="pricing-card-btn btn-primary-plan">
                Comenzar Prueba Pro Gratis
              </Link>
            </div>

            {/* Business Plan */}
            <div className="pricing-card">
              <div>
                <div className="pricing-header">
                  <h4>Business</h4>
                  <p>Para grandes distribuidores, marcas oficiales y agencias de e-commerce.</p>
                </div>
                <div className="pricing-price-box">
                  <span className="price-currency">$</span>
                  <span className="price-amount">{businessPrice}</span>
                  <span className="price-period">/mes {isAnnual && '(facturado anual)'}</span>
                </div>
                <div className="pricing-quota-pill">
                  <Sparkles size={15} />
                  <span>5,000 respuestas IA al mes</span>
                </div>
                <ul className="pricing-features-list">
                  <li>
                    <CheckCircle2 size={16} />
                    <span>Cuentas de Mercado Libre ilimitadas</span>
                  </li>
                  <li>
                    <CheckCircle2 size={16} />
                    <span>Integración WhatsApp + Telegram + Resend</span>
                  </li>
                  <li>
                    <CheckCircle2 size={16} />
                    <span>Fine-tuning de tono de marca personalizado</span>
                  </li>
                  <li>
                    <CheckCircle2 size={16} />
                    <span>Manejo de post-venta y reclamos prioritario</span>
                  </li>
                  <li>
                    <CheckCircle2 size={16} />
                    <span>SLA garantizado de 99.9% y Account Manager</span>
                  </li>
                </ul>
              </div>
              <Link to="/login?register=true&plan=business" className="pricing-card-btn btn-outline">
                Contactar Ventas Business
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── FAQ Accordion ── */}
      <section id="faq" className="landing-section">
        <div className="landing-container">
          <div className="section-header">
            <div className="section-tag">
              <HelpCircle size={14} />
              <span>Preguntas Frecuentes</span>
            </div>
            <h2 className="section-title">Todo lo que necesitas saber</h2>
            <p className="section-desc">
              Respuestas directas a las dudas más habituales sobre la integración y el funcionamiento.
            </p>
          </div>

          <div className="faq-container">
            <div className="faq-item">
              <button type="button" className="faq-question-btn" onClick={() => toggleFaq(0)}>
                <span>¿Cómo se conecta MELI AI con mi cuenta de Mercado Libre?</span>
                {openFaq === 0 ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
              </button>
              {openFaq === 0 && (
                <div className="faq-answer">
                  La conexión se realiza mediante la API Oficial OAuth 2.0 de Mercado Libre de forma 100% segura. Solo necesitas hacer clic en "Conectar Tienda", autorizar los permisos de lectura de publicaciones y respuesta de mensajes, y el sistema comenzará a sincronizar tus productos al instante. Nunca solicitamos tu contraseña de Mercado Libre.
                </div>
              )}
            </div>

            <div className="faq-item">
              <button type="button" className="faq-question-btn" onClick={() => toggleFaq(1)}>
                <span>¿Qué ocurre si la IA no tiene suficiente información para responder?</span>
                {openFaq === 1 ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
              </button>
              {openFaq === 1 && (
                <div className="faq-answer">
                  MELI AI cuenta con un umbral estricto de confianza. Si una consulta es ambigua, contiene datos contradictorios o requiere información confidencial que no está en la publicación, la IA no inventará datos. En su lugar, generará un borrador sugerido y te enviará una notificación a Telegram / WhatsApp para que tu equipo decida la respuesta.
                </div>
              )}
            </div>

            <div className="faq-item">
              <button type="button" className="faq-question-btn" onClick={() => toggleFaq(2)}>
                <span>¿Afecta negativamente mi reputación o termómetro en Mercado Libre?</span>
                {openFaq === 2 ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
              </button>
              {openFaq === 2 && (
                <div className="faq-answer">
                  Todo lo contrario. Al reducir drásticamente el tiempo de respuesta promedio a menos de 2.5 segundos y brindar respuestas técnicas basadas en la ficha del fabricante, tus métricas de atención mejoran de inmediato. Además, nuestro módulo de post-venta ayuda a desactivar incidentes antes de que se transformen en reclamos.
                </div>
              )}
            </div>

            <div className="faq-item">
              <button type="button" className="faq-question-btn" onClick={() => toggleFaq(3)}>
                <span>¿Puedo configurar reglas de facturación y horarios de entrega específicos?</span>
                {openFaq === 3 ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
              </button>
              {openFaq === 3 && (
                <div className="faq-answer">
                  Sí. Desde el panel de Configuración de tu Tienda puedes definir reglas como: emisión de Factura A con CUIT, horarios límite de despacho en el día (Mercado Envíos Flex), garantías oficiales y políticas de devoluciones. La IA respetará estas directivas al 100% en cada respuesta.
                </div>
              )}
            </div>

            <div className="faq-item">
              <button type="button" className="faq-question-btn" onClick={() => toggleFaq(4)}>
                <span>¿Hay límite de publicaciones sincronizadas?</span>
                {openFaq === 4 ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
              </button>
              {openFaq === 4 && (
                <div className="faq-answer">
                  No hay límite en la cantidad de publicaciones que puedes sincronizar en ninguno de nuestros planes. La cuota se calcula únicamente en base a las respuestas de IA generadas por mes.
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── Final High-Impact CTA ── */}
      <section className="landing-container">
        <div className="final-cta-card">
          <h3>Comienza a responder en segundos y supera a tu competencia hoy</h3>
          <p>
            Conecta tu tienda de Mercado Libre en menos de 2 minutos. Sin tarjeta de crédito requerida para comenzar.
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <Link to="/login?register=true" className="landing-btn-hero-primary" style={{ padding: '0.95rem 2.25rem', fontSize: '1.05rem' }}>
              <Sparkles size={20} />
              <span>Crear Cuenta Gratis</span>
            </Link>
          </div>
        </div>
      </section>

      {/* ── Lead Capture Form ── */}
      <section className="lead-form-section" id="form">
        <div className="lead-form-container">
          <div className="lead-form-badge">Contacto</div>
          <h2 className="lead-form-title">¿Querés automatizar las preguntas de tu tienda?</h2>
          <p className="lead-form-sub">Completá el formulario y te contactamos por WhatsApp en menos de 24hs.</p>

          {leadResult === 'qualified' && (
            <div className="lead-form-success">
              <span className="lead-form-success-icon">✓</span>
              <div>
                <p className="lead-form-success-title">¡Perfecto, te contactamos pronto!</p>
                <p className="lead-form-success-sub">Te escribimos por WhatsApp en menos de 24hs.</p>
              </div>
            </div>
          )}

          {leadResult === 'disqualified' && (
            <div className="lead-form-disqualified">
              <p className="lead-form-disqualified-title">Tu tienda todavía no genera el volumen mínimo para aprovechar el bot.</p>
              <p className="lead-form-disqualified-sub">
                Cuando tengas más preguntas, volvé. O{' '}
                <a href="/login?register=true" className="lead-form-disqualified-link">
                  probalo gratis ahora →
                </a>
              </p>
            </div>
          )}

          {leadResult === null && (
            <form className="lead-form" onSubmit={handleLeadSubmit}>
              <div className="lead-form-row">
                <div className="lead-form-field">
                  <label className="lead-form-label">Nombre completo</label>
                  <input
                    className="lead-form-input"
                    type="text"
                    placeholder="Juan García"
                    required
                    value={leadForm.name}
                    onChange={e => setLeadForm(f => ({ ...f, name: e.target.value }))}
                  />
                </div>
                <div className="lead-form-field">
                  <label className="lead-form-label">Email</label>
                  <input
                    className="lead-form-input"
                    type="email"
                    placeholder="juan@mitienda.com"
                    required
                    value={leadForm.email}
                    onChange={e => setLeadForm(f => ({ ...f, email: e.target.value }))}
                  />
                </div>
              </div>
              <div className="lead-form-row">
                <div className="lead-form-field">
                  <label className="lead-form-label">Teléfono / WhatsApp</label>
                  <input
                    className="lead-form-input"
                    type="tel"
                    placeholder="+54 9 11 1234-5678"
                    required
                    value={leadForm.phone}
                    onChange={e => setLeadForm(f => ({ ...f, phone: e.target.value }))}
                  />
                </div>
                <div className="lead-form-field">
                  <label className="lead-form-label">Nombre o link de tu tienda en ML</label>
                  <input
                    className="lead-form-input"
                    type="text"
                    placeholder="Mi Tienda Oficial"
                    required
                    value={leadForm.mlStore}
                    onChange={e => setLeadForm(f => ({ ...f, mlStore: e.target.value }))}
                  />
                </div>
              </div>
              <div className="lead-form-field">
                <label className="lead-form-label">¿Cuántas preguntas recibís por semana en ML?</label>
                <select
                  className="lead-form-input lead-form-select"
                  required
                  value={leadForm.weeklyQuestions}
                  onChange={e => setLeadForm(f => ({ ...f, weeklyQuestions: e.target.value }))}
                >
                  <option value="" disabled>Seleccioná una opción</option>
                  <option value="<10">Menos de 10</option>
                  <option value="10-50">Entre 10 y 50</option>
                  <option value="50-200">Entre 50 y 200</option>
                  <option value="200+">Más de 200</option>
                </select>
              </div>
              <button
                className="lead-form-submit"
                type="submit"
                disabled={leadSubmitting}
              >
                {leadSubmitting ? 'Enviando…' : 'Quiero automatizar mis preguntas →'}
              </button>
            </form>
          )}
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="landing-footer">
        <div className="landing-container">
          <div className="footer-top-row">
            <Link to="/" className="landing-logo">
              <div className="landing-logo-icon">
                <Bot size={18} strokeWidth={2.5} />
              </div>
              <span>MELI <strong style={{ color: 'var(--lp-accent)' }}>AI</strong></span>
            </Link>

            <ul className="footer-links">
              <li><a href="#features">Superpoderes</a></li>
              <li><a href="#comparison">Comparativa</a></li>
              <li><a href="#pricing">Planes</a></li>
              <li><a href="#faq">Preguntas</a></li>
              <li><Link to="/login">Acceso Clientes</Link></li>
            </ul>
          </div>

          <div className="footer-bottom-row">
            <div>
              © {new Date().getFullYear()} MELI AI SaaS. Todos los derechos reservados.
            </div>
            <div className="footer-status-pill">
              <span className="hero-pill-dot" style={{ width: 6, height: 6, background: '#10b981', boxShadow: '0 0 8px #10b981' }} />
              <span>Conexión API Mercado Libre: Operativa</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
