import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  Store,
  Search,
  BookOpen,
  ArrowRight,
  ShieldCheck,
  Clock,
  Tag,
  CheckCircle2,
  TrendingUp,
  FileText
} from 'lucide-react'
import { BLOG_ARTICLES, BLOG_CATEGORIES, BlogArticle } from '../data/blogArticles'
import './BlogPage.css'

export default function BlogPage() {
  const [selectedCategory, setSelectedCategory] = useState<string>('Todos')
  const [searchQuery, setSearchQuery] = useState<string>('')

  const filteredArticles = useMemo(() => {
    return BLOG_ARTICLES.filter((article: BlogArticle) => {
      const matchesCategory =
        selectedCategory === 'Todos' || article.category === selectedCategory
      const matchesSearch =
        searchQuery.trim() === '' ||
        article.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        article.subtitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
        article.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()))
      return matchesCategory && matchesSearch
    })
  }, [selectedCategory, searchQuery])

  const featuredArticle = useMemo(() => {
    return BLOG_ARTICLES.find(a => a.featured) || BLOG_ARTICLES[0]
  }, [])

  return (
    <div className="blog-root">
      <div className="landing-bg-grid" />

      {/* ── Navigation Header ── */}
      <header className="landing-header">
        <div className="landing-container">
          <nav className="landing-nav">
            <Link to="/" className="landing-logo">
              <div className="landing-logo-icon">
                <Store size={18} strokeWidth={2.5} />
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

      {/* ── Blog Hero Section ── */}
      <section className="blog-hero">
        <div className="landing-container">
          <div className="hero-pill-badge">
            <span className="hero-pill-dot" />
            <BookOpen size={14} style={{ marginRight: 6 }} />
            <span>Documentación Oficial &amp; Guías para Sellers de Mercado Libre</span>
          </div>

          <h1 className="blog-hero-title">
            Centro de Recursos <span className="blog-title-gradient">&amp; Normativa Oficial</span>
          </h1>

          <p className="blog-hero-subtitle">
            Guías paso a paso, umbrales de reputación 2026, optimización de publicaciones y reglas de catálogo basadas 100% en fuentes oficiales de Mercado Libre.
          </p>

          {/* Search & Category Filter Bar */}
          <div className="blog-search-bar-wrapper">
            <div className="blog-search-input-box">
              <Search size={18} className="search-icon" />
              <input
                type="text"
                placeholder="Buscar por tema (ej. Reputación, Ficha técnica, Devoluciones, Envíos Flex, Factura A)..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="blog-search-input"
              />
              {searchQuery && (
                <button
                  type="button"
                  className="blog-search-clear"
                  onClick={() => setSearchQuery('')}
                >
                  ✕
                </button>
              )}
            </div>

            <div className="blog-categories-pill-list">
              {BLOG_CATEGORIES.map(cat => (
                <button
                  key={cat}
                  type="button"
                  className={`blog-category-pill ${selectedCategory === cat ? 'active' : ''}`}
                  onClick={() => setSelectedCategory(cat)}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Main Content Section ── */}
      <section className="blog-content-section">
        <div className="landing-container">
          {/* Featured Article Card (only if showing all and no search query) */}
          {selectedCategory === 'Todos' && !searchQuery && (
            <div className="blog-featured-card">
              <div className="blog-featured-badge-row">
                <span className="blog-badge-featured">⭐ Artículo Destacado</span>
                <span className="blog-badge-category" style={{ background: '#ECFDF5', color: '#065F46', borderColor: '#A7F3D0' }}>
                  {featuredArticle.category}
                </span>
                <span className="blog-read-time">
                  <Clock size={13} /> {featuredArticle.readTime}
                </span>
              </div>

              <h2 className="blog-featured-title">
                <Link to={`/blog/${featuredArticle.slug}`}>
                  {featuredArticle.title}
                </Link>
              </h2>

              <p className="blog-featured-desc">
                {featuredArticle.subtitle}
              </p>

              <div className="blog-featured-meta">
                <div className="blog-author-tag">
                  <span className="blog-avatar-icon">{featuredArticle.author.avatar}</span>
                  <div>
                    <strong>{featuredArticle.author.name}</strong>
                    <span className="blog-author-role">{featuredArticle.author.role}</span>
                  </div>
                </div>

                <div className="blog-official-stamp">
                  <ShieldCheck size={16} style={{ color: '#059669' }} />
                  <span>Fuente Oficial: {featuredArticle.officialSource.name}</span>
                </div>

                <Link to={`/blog/${featuredArticle.slug}`} className="blog-featured-btn">
                  <span>Leer Guía Completa</span>
                  <ArrowRight size={15} />
                </Link>
              </div>
            </div>
          )}

          {/* Grid of Articles */}
          <div className="blog-articles-header-row">
            <h3 className="blog-section-subtitle">
              {searchQuery
                ? `Resultados para "${searchQuery}" (${filteredArticles.length})`
                : selectedCategory === 'Todos'
                ? 'Todos los Artículos y Guías Oficiales'
                : `Artículos en "${selectedCategory}" (${filteredArticles.length})`}
            </h3>
          </div>

          {filteredArticles.length === 0 ? (
            <div className="blog-empty-state">
              <Search size={40} style={{ opacity: 0.4 }} />
              <h4>No encontramos artículos que coincidan</h4>
              <p>Probá con otros términos de búsqueda o seleccioná otra categoría.</p>
              <button
                type="button"
                className="blog-empty-reset-btn"
                onClick={() => {
                  setSelectedCategory('Todos')
                  setSearchQuery('')
                }}
              >
                Restablecer filtros
              </button>
            </div>
          ) : (
            <div className="blog-grid">
              {filteredArticles.map(article => (
                <article key={article.id} className="blog-card">
                  <div className="blog-card-top">
                    <div className="blog-card-category-row">
                      <span
                        className="blog-badge-category"
                        style={{
                          backgroundColor: `${article.categoryColor}15`,
                          color: article.categoryColor === '#10b981' ? '#065F46' : article.categoryColor,
                          borderColor: `${article.categoryColor}33`
                        }}
                      >
                        {article.category}
                      </span>
                      <span className="blog-read-time">
                        <Clock size={12} />
                        {article.readTime}
                      </span>
                    </div>

                    <h4 className="blog-card-title">
                      <Link to={`/blog/${article.slug}`}>
                        {article.title}
                      </Link>
                    </h4>

                    <p className="blog-card-excerpt">
                      {article.summary}
                    </p>
                  </div>

                  <div className="blog-card-bottom">
                    <div className="blog-card-tags">
                      {article.tags.slice(0, 3).map(tag => (
                        <span key={tag} className="blog-tag-pill">
                          <Tag size={10} />
                          {tag}
                        </span>
                      ))}
                    </div>

                    <div className="blog-card-source">
                      <ShieldCheck size={13} style={{ color: '#059669' }} />
                      <span title={article.officialSource.name}>
                        {article.officialSource.name}
                      </span>
                    </div>

                    <div className="blog-card-footer">
                      <div className="blog-card-author">
                        <span className="blog-avatar-icon-small">{article.author.avatar}</span>
                        <span>{article.author.name}</span>
                      </div>
                      <Link to={`/blog/${article.slug}`} className="blog-card-link">
                        <span>Leer artículo</span>
                        <ArrowRight size={14} />
                      </Link>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── Conversion Banner CTA ── */}
      <section className="blog-cta-banner-section">
        <div className="landing-container">
          <div className="blog-cta-box">
            <div className="blog-cta-content">
              <div className="blog-cta-badge">
                <ShieldCheck size={14} style={{ color: '#10B981' }} />
                <span>Ecosistema Conectado a la API Oficial de Mercado Libre</span>
              </div>
              <h2 className="blog-cta-title">
                Aplicá estas reglas oficiales automáticamente en tu tienda
              </h2>
              <p className="blog-cta-desc">
                Conectá tu cuenta de Mercado Libre en 60 segundos. Respondé consultas de preventa con los datos de tu catálogo, previene devoluciones y cuidá tu termómetro verde 24/7.
              </p>
              <div className="blog-cta-checklist">
                <div className="blog-cta-check-item">
                  <CheckCircle2 size={16} style={{ color: '#10b981' }} />
                  <span>Sin tocar tu código</span>
                </div>
                <div className="blog-cta-check-item">
                  <CheckCircle2 size={16} style={{ color: '#10b981' }} />
                  <span>Prueba gratuita de 7 días</span>
                </div>
                <div className="blog-cta-check-item">
                  <CheckCircle2 size={16} style={{ color: '#10b981' }} />
                  <span>Cancelás cuando quieras</span>
                </div>
              </div>
            </div>

            <div className="blog-cta-actions">
              <Link to="/login?register=true" className="landing-btn-hero-primary" style={{ padding: '16px 28px' }}>
                <TrendingUp size={18} />
                <span>Conectar mi Tienda Gratis</span>
              </Link>
              <Link to="/#simulator" className="landing-btn-hero-secondary" style={{ padding: '16px 28px', background: 'rgba(255, 255, 255, 0.12)', color: '#FFFFFF' }}>
                <span>Probar Simulador</span>
                <ArrowRight size={16} />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="landing-footer">
        <div className="landing-container">
          <div className="footer-top-row">
            <Link to="/" className="landing-logo">
              <div className="landing-logo-icon">
                <Store size={18} strokeWidth={2.5} />
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
