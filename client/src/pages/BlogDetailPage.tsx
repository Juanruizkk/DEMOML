import { useState, useMemo } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import {
  Bot,
  ArrowLeft,
  ArrowRight,
  Clock,
  Calendar,
  ShieldCheck,
  ExternalLink,
  Share2,
  Check,
  Sparkles,
  Info,
  AlertTriangle,
  Lightbulb,
  CheckCircle2,
  Tag,
  BookOpen
} from 'lucide-react'
import { BLOG_ARTICLES, BlogArticle, BlogSection } from '../data/blogArticles'
import './BlogDetailPage.css'

export default function BlogDetailPage() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const [copied, setCopied] = useState(false)

  const article = useMemo(() => {
    return BLOG_ARTICLES.find((a: BlogArticle) => a.slug === slug)
  }, [slug])

  const relatedArticles = useMemo(() => {
    if (!article) return []
    return BLOG_ARTICLES.filter(a =>
      article.relatedSlugs.includes(a.slug) || (a.category === article.category && a.id !== article.id)
    ).slice(0, 3)
  }, [article])

  const handleShare = async () => {
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    }
  }

  if (!article) {
    return (
      <div className="blog-detail-root">
        <div className="landing-bg-grid" />
        <header className="landing-header">
          <div className="landing-container">
            <nav className="landing-nav">
              <Link to="/" className="landing-logo">
                <div className="landing-logo-icon">
                  <Bot size={18} strokeWidth={2.5} />
                </div>
                <span>MELI <strong style={{ color: 'var(--lp-accent)' }}>AI</strong></span>
              </Link>
              <Link to="/blog" className="landing-btn-login">
                ← Volver al Centro de Recursos
              </Link>
            </nav>
          </div>
        </header>

        <div className="landing-container" style={{ padding: '160px 20px 80px', textAlign: 'center' }}>
          <div className="blog-not-found-card">
            <BookOpen size={48} style={{ color: 'var(--lp-accent)', margin: '0 auto 16px' }} />
            <h2>Artículo no encontrado</h2>
            <p>El artículo que estás buscando no existe o fue reubicado.</p>
            <Link to="/blog" className="landing-btn-hero-primary" style={{ display: 'inline-flex', marginTop: 20 }}>
              <span>Explorar todos los artículos</span>
              <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="blog-detail-root">
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
              <li><Link to="/">Inicio</Link></li>
              <li><Link to="/#simulator">Simulador ML</Link></li>
              <li><Link to="/#features">Superpoderes</Link></li>
              <li><Link to="/#pricing">Planes</Link></li>
              <li><Link to="/blog" className="nav-link-active">Centro de Recursos</Link></li>
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

      {/* ── Breadcrumbs & Article Header ── */}
      <article className="blog-article-container">
        <div className="landing-container">
          {/* Breadcrumbs */}
          <nav className="blog-breadcrumbs" aria-label="Breadcrumb">
            <Link to="/">Inicio</Link>
            <span>/</span>
            <Link to="/blog">Centro de Recursos</Link>
            <span>/</span>
            <span className="breadcrumb-current">{article.category}</span>
          </nav>

          {/* Article Header */}
          <header className="blog-article-header">
            <div className="blog-article-pill-row">
              <span
                className="blog-badge-category"
                style={{
                  backgroundColor: `${article.categoryColor}1f`,
                  color: article.categoryColor,
                  borderColor: `${article.categoryColor}3d`
                }}
              >
                {article.category}
              </span>
              <span className="blog-read-time">
                <Clock size={13} /> {article.readTime}
              </span>
              <span className="blog-read-time">
                <Calendar size={13} /> Actualizado: {article.updatedAt}
              </span>
            </div>

            <h1 className="blog-article-main-title">
              {article.title}
            </h1>

            <p className="blog-article-lead">
              {article.subtitle}
            </p>

            {/* Author & Share Bar */}
            <div className="blog-article-meta-bar">
              <div className="blog-author-tag">
                <span className="blog-avatar-icon">{article.author.avatar}</span>
                <div>
                  <strong>{article.author.name}</strong>
                  <span className="blog-author-role">{article.author.role}</span>
                </div>
              </div>

              <div className="blog-meta-actions">
                <button
                  type="button"
                  className="blog-share-btn"
                  onClick={handleShare}
                  title="Copiar enlace del artículo"
                >
                  {copied ? <Check size={15} style={{ color: '#10b981' }} /> : <Share2 size={15} />}
                  <span>{copied ? '¡Enlace copiado!' : 'Compartir'}</span>
                </button>
              </div>
            </div>

            {/* Official Source Verification Box */}
            <div className="blog-official-source-box">
              <div className="blog-source-header">
                <ShieldCheck size={18} style={{ color: '#10b981' }} />
                <strong>Fuente Oficial Verificada</strong>
              </div>
              <p className="blog-source-text">
                Este contenido está redactado y auditado con base en la documentación oficial publicada por Mercado Libre:
              </p>
              <a
                href={article.officialSource.url}
                target="_blank"
                rel="noopener noreferrer"
                className="blog-source-link"
              >
                <span>{article.officialSource.name}</span>
                <ExternalLink size={13} />
              </a>
              {article.officialSource.note && (
                <div className="blog-source-note">
                  ℹ️ {article.officialSource.note}
                </div>
              )}
            </div>
          </header>

          {/* ── Main Article Body ── */}
          <div className="blog-article-body">
            {article.sections.map((sec: BlogSection, idx: number) => {
              if (sec.type === 'paragraph') {
                return <p key={idx} className="article-p">{sec.text}</p>
              }

              if (sec.type === 'heading') {
                if (sec.level === 3) {
                  return <h3 key={idx} className="article-h3">{sec.text}</h3>
                }
                return <h2 key={idx} className="article-h2">{sec.text}</h2>
              }

              if (sec.type === 'callout') {
                const icon =
                  sec.calloutType === 'warning' ? <AlertTriangle size={18} /> :
                  sec.calloutType === 'tip' ? <Lightbulb size={18} /> :
                  sec.calloutType === 'success' ? <CheckCircle2 size={18} /> :
                  <Info size={18} />

                return (
                  <div key={idx} className={`article-callout callout-${sec.calloutType || 'info'}`}>
                    <div className="callout-icon">{icon}</div>
                    <div className="callout-text">{sec.text}</div>
                  </div>
                )
              }

              if (sec.type === 'list' && sec.items) {
                return (
                  <ul key={idx} className="article-ul">
                    {sec.items.map((item, iIdx) => (
                      <li key={iIdx}>{item}</li>
                    ))}
                  </ul>
                )
              }

              if (sec.type === 'table' && sec.tableHeader && sec.tableRows) {
                return (
                  <div key={idx} className="article-table-container">
                    <table className="article-table">
                      <thead>
                        <tr>
                          {sec.tableHeader.map((th, thIdx) => (
                            <th key={thIdx}>{th}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {sec.tableRows.map((row, rIdx) => (
                          <tr key={rIdx}>
                            {row.map((cell, cIdx) => (
                              <td key={cIdx}>{cell}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              }

              if (sec.type === 'stats' && sec.stats) {
                return (
                  <div key={idx} className="article-stats-grid">
                    {sec.stats.map((stat, sIdx) => (
                      <div key={sIdx} className="article-stat-card">
                        <div className="article-stat-val">{stat.value}</div>
                        <div className="article-stat-lbl">{stat.label}</div>
                        {stat.subtext && <div className="article-stat-sub">{stat.subtext}</div>}
                      </div>
                    ))}
                  </div>
                )
              }

              return null
            })}
          </div>

          {/* ── Tags & Share ── */}
          <div className="blog-article-footer-meta">
            <div className="blog-tags-list">
              <span className="blog-tags-label">Temas relacionados:</span>
              {article.tags.map(tag => (
                <span key={tag} className="blog-tag-pill">
                  <Tag size={11} />
                  {tag}
                </span>
              ))}
            </div>

            <div className="blog-back-to-all">
              <Link to="/blog" className="blog-back-link">
                <ArrowLeft size={16} />
                <span>Volver al Centro de Recursos</span>
              </Link>
            </div>
          </div>

          {/* ── In-Article CTA Card ── */}
          <div className="blog-article-promo-card">
            <div className="promo-card-icon">
              <Sparkles size={24} style={{ color: '#FFE600' }} />
            </div>
            <div className="promo-card-content">
              <h3>¿Querés automatizar tus respuestas y proteger tu reputación?</h3>
              <p>
                MELI AI integra estas reglas oficiales de Mercado Libre directamente en tu tienda. Respondé preguntas pre-venta en segundos y mantené tu termómetro verde 24/7.
              </p>
            </div>
            <div className="promo-card-action">
              <Link to="/login?register=true" className="landing-btn-hero-primary" style={{ padding: '14px 24px', whiteSpace: 'nowrap' }}>
                <Sparkles size={16} />
                <span>Conectar mi Tienda Gratis</span>
              </Link>
            </div>
          </div>

          {/* ── Related Articles ── */}
          {relatedArticles.length > 0 && (
            <div className="blog-related-section">
              <h3 className="blog-related-title">Artículos recomendados</h3>
              <div className="blog-related-grid">
                {relatedArticles.map(rel => (
                  <Link key={rel.id} to={`/blog/${rel.slug}`} className="blog-related-card">
                    <span
                      className="blog-badge-category"
                      style={{
                        backgroundColor: `${rel.categoryColor}1f`,
                        color: rel.categoryColor,
                        marginBottom: 10
                      }}
                    >
                      {rel.category}
                    </span>
                    <h4>{rel.title}</h4>
                    <span className="blog-related-read-time">
                      <Clock size={12} /> {rel.readTime}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </article>

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
              <li><Link to="/">Inicio</Link></li>
              <li><Link to="/#simulator">Simulador</Link></li>
              <li><Link to="/#features">Superpoderes</Link></li>
              <li><Link to="/#pricing">Planes</Link></li>
              <li><Link to="/blog">Centro de Recursos</Link></li>
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
