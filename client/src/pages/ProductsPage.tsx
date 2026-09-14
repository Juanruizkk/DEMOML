import { useState, useEffect } from 'react'
import { api } from '../api/client'
import PageHeader from '../components/PageHeader'
import {
  Package,
  Sparkles,
  ExternalLink,
  Plus,
  Trash2,
  Save,
  Play,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Search,
  BookOpen
} from 'lucide-react'
import PaginationControls from '../components/PaginationControls'
import './ProductsPage.css'

interface ProductKnowledge {
  customInstructions: string
  faqsCount: number
  isActive: boolean
  updatedAt: string
}

interface Product {
  id: string
  title: string
  price: number
  currencyId: string
  availableQuantity: number
  condition: string
  permalink?: string
  hasCustomKnowledge: boolean
  knowledge?: ProductKnowledge
}

interface FaqItem {
  question: string
  answer: string
}

interface KnowledgeDetail {
  customInstructions: string
  faqs: FaqItem[]
  isActive: boolean
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(6)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)

  // Drawer / Modal state
  const [knowledge, setKnowledge] = useState<KnowledgeDetail>({
    customInstructions: '',
    faqs: [],
    isActive: true,
  })
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)

  // Simulation state
  const [simQuestion, setSimQuestion] = useState('')
  const [simulating, setSimulating] = useState(false)
  const [simResult, setSimResult] = useState<any>(null)

  useEffect(() => {
    loadProducts()
  }, [])

  const loadProducts = async () => {
    setLoading(true)
    setError('')
    try {
      const data = await api.get<{ ok: boolean; count: number; products: Product[] }>('/tenant/products')
      setProducts(data.products || [])
    } catch (err: any) {
      setError(err.message || 'Error al cargar productos')
    } finally {
      setLoading(false)
    }
  }

  const openKnowledgeEditor = async (product: Product) => {
    setSelectedProduct(product)
    setSaveSuccess(false)
    setSimResult(null)
    setSimQuestion('')

    try {
      const res = await api.get<{ ok: boolean; knowledge: KnowledgeDetail }>(
        `/tenant/products/${product.id}/knowledge`
      )
      setKnowledge({
        customInstructions: res.knowledge?.customInstructions || '',
        faqs: res.knowledge?.faqs || [],
        isActive: res.knowledge?.isActive !== undefined ? res.knowledge.isActive : true,
      })
    } catch {
      setKnowledge({
        customInstructions: '',
        faqs: [],
        isActive: true,
      })
    }
  }

  const handleAddFaq = () => {
    setKnowledge((prev) => ({
      ...prev,
      faqs: [...prev.faqs, { question: '', answer: '' }],
    }))
  }

  const handleUpdateFaq = (index: number, field: 'question' | 'answer', value: string) => {
    setKnowledge((prev) => {
      const updated = [...prev.faqs]
      updated[index][field] = value
      return { ...prev, faqs: updated }
    })
  }

  const handleRemoveFaq = (index: number) => {
    setKnowledge((prev) => ({
      ...prev,
      faqs: prev.faqs.filter((_, i) => i !== index),
    }))
  }

  const handleSaveKnowledge = async () => {
    if (!selectedProduct) return
    setSaving(true)
    setSaveSuccess(false)
    try {
      await api.put(`/tenant/products/${selectedProduct.id}/knowledge`, knowledge)
      setSaveSuccess(true)
      // Refresh products list
      loadProducts()
      setTimeout(() => setSaveSuccess(false), 3000)
    } catch (err: any) {
      alert(`Error al guardar: ${err.message}`)
    } finally {
      setSaving(false)
    }
  }

  const handleSimulate = async () => {
    if (!selectedProduct || !simQuestion.trim()) return
    setSimulating(true)
    setSimResult(null)
    try {
      const res = await api.post<{ ok: boolean; simulation: any }>(
        `/tenant/products/${selectedProduct.id}/simulate`,
        {
          questionText: simQuestion,
          customInstructions: knowledge.customInstructions,
          faqs: knowledge.faqs,
        }
      )
      setSimResult(res.simulation)
    } catch (err: any) {
      alert(`Error en la simulación: ${err.message}`)
    } finally {
      setSimulating(false)
    }
  }

  const filtered = products.filter((p) =>
    p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.id.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const withKnowledgeCount = products.filter((p) => p.hasCustomKnowledge).length

  return (
    <div className="page-container">
      <PageHeader
        title="Catálogo & Reglas de Conocimiento"
        subtitle="Configurá instrucciones prioritarias y FAQs personalizadas por producto para el bot de IA"
        stats={[
          { label: 'Publicaciones Activas', value: products.length, color: 'blue' },
          { label: 'Con Reglas de IA', value: withKnowledgeCount, color: 'emerald' },
        ]}
      />

      <div className="products-content">
        {/* Search and Filters Bar */}
        <div className="products-toolbar">
          <div className="search-box">
            <Search size={18} className="search-icon" />
            <input
              type="text"
              placeholder="Buscar por título o código MLA..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                setPage(1)
              }}
            />
          </div>
        </div>

        {/* Loading / Error / Empty States */}
        {loading && (
          <div className="state-box">
            <span className="pulse-dot" /> Cargando catálogo de Mercado Libre...
          </div>
        )}

        {error && <div className="state-box error">{error}</div>}

        {!loading && !error && filtered.length === 0 && (
          <div className="state-box">
            <Package size={36} className="text-muted" />
            <p>No se encontraron productos.</p>
          </div>
        )}

        {/* Product Cards Grid */}
        <div className="products-grid">
          {filtered
            .slice((page - 1) * limit, page * limit)
            .map((prod) => (
              <div key={prod.id} className="product-card glass-card">
                <div className="product-card-top">
                  <div className="product-id-badge">{prod.id}</div>
                  {prod.hasCustomKnowledge ? (
                    <span className="badge badge-emerald">
                      <Sparkles size={12} /> Con Reglas IA
                    </span>
                  ) : (
                    <span className="badge badge-blue">Estándar</span>
                  )}
                </div>

                <h3 className="product-title" title={prod.title}>
                  {prod.title}
                </h3>

                <div className="product-meta-row">
                  <span className="product-price">
                    ${prod.price.toLocaleString('es-AR')} {prod.currencyId}
                  </span>
                  <span className="product-stock">Stock: {prod.availableQuantity} u.</span>
                </div>

                {prod.knowledge && (
                  <div className="product-knowledge-preview">
                    <p className="knowledge-text">
                      "{prod.knowledge.customInstructions.slice(0, 70)}
                      {prod.knowledge.customInstructions.length > 70 ? '...' : ''}"
                    </p>
                    {prod.knowledge.faqsCount > 0 && (
                      <span className="faq-count-chip">
                        <BookOpen size={12} /> {prod.knowledge.faqsCount} FAQs
                      </span>
                    )}
                  </div>
                )}

                <div className="product-card-actions">
                  <button
                    className="btn-primary"
                    onClick={() => openKnowledgeEditor(prod)}
                  >
                    <Sparkles size={15} /> Configurar IA
                  </button>
                  {prod.permalink && (
                    <a
                      href={prod.permalink}
                      target="_blank"
                      rel="noreferrer"
                      className="btn-icon-link"
                      title="Ver en Mercado Libre"
                    >
                      <ExternalLink size={16} />
                    </a>
                  )}
                </div>
              </div>
            ))}
        </div>

        {/* Pagination Controls */}
        {!loading && filtered.length > 0 && (
          <PaginationControls
            pagination={{
              page,
              limit,
              total: filtered.length,
              totalPages: Math.ceil(filtered.length / limit) || 1,
              hasNext: page < (Math.ceil(filtered.length / limit) || 1),
              hasPrev: page > 1,
            }}
            onPageChange={(p) => setPage(p)}
            onLimitChange={(l) => {
              setLimit(l)
              setPage(1)
            }}
            itemName="productos"
            pageSizeOptions={[6, 12, 24]}
          />
        )}
      </div>

      {/* Modal / Drawer de Configuración de Conocimiento */}
      {selectedProduct && (
        <div className="modal-overlay" onClick={() => setSelectedProduct(null)}>
          <div className="modal-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <span className="modal-pretitle">KNOWLEDGE BASE POR ÍTEM</span>
                <h2 className="modal-title">{selectedProduct.title}</h2>
                <p className="modal-subtitle">ID: {selectedProduct.id} · Stock: {selectedProduct.availableQuantity} u.</p>
              </div>
              <button
                className="btn-close"
                onClick={() => setSelectedProduct(null)}
              >
                ✕
              </button>
            </div>

            <div className="modal-body">
              {/* Sección 1: Reglas e Instrucciones Prioritarias */}
              <div className="modal-section">
                <label className="section-label">
                  <Sparkles size={16} className="text-blue" /> Instrucciones Especiales para la IA
                </label>
                <p className="section-hint">
                  Reglas prioritarias que el bot respetará ante cualquier pregunta sobre este producto (ej. advertencias de talle, stock de accesorios, compatibilidades).
                </p>
                <textarea
                  className="knowledge-textarea"
                  rows={3}
                  placeholder="Ej: Aclarar que incluye 4 switches de repuesto y extractor. Si preguntan por color blanco, decir que entra en 15 días."
                  value={knowledge.customInstructions}
                  onChange={(e) =>
                    setKnowledge({ ...knowledge, customInstructions: e.target.value })
                  }
                />
              </div>

              {/* Sección 2: FAQs Específicas */}
              <div className="modal-section">
                <div className="section-title-row">
                  <div>
                    <label className="section-label">
                      <HelpCircle size={16} className="text-emerald" /> Preguntas y Respuestas Frecuentes (FAQs)
                    </label>
                    <p className="section-hint">
                      Definí preguntas habituales y la respuesta exacta que debe proporcionar el bot.
                    </p>
                  </div>
                  <button className="btn-secondary btn-sm" onClick={handleAddFaq}>
                    <Plus size={14} /> Agregar FAQ
                  </button>
                </div>

                {knowledge.faqs.length === 0 && (
                  <p className="empty-faq-text">
                    No hay FAQs añadidas para este producto. Hacé clic en "+ Agregar FAQ" para cargar una.
                  </p>
                )}

                <div className="faqs-list">
                  {knowledge.faqs.map((faq, idx) => (
                    <div key={idx} className="faq-row-card">
                      <div className="faq-inputs">
                        <input
                          type="text"
                          placeholder="Pregunta frecuente (ej. ¿Es compatible con PS5?)"
                          value={faq.question}
                          onChange={(e) => handleUpdateFaq(idx, 'question', e.target.value)}
                        />
                        <input
                          type="text"
                          placeholder="Respuesta oficial (ej. Sí, funciona conectándolo por USB directamente)"
                          value={faq.answer}
                          onChange={(e) => handleUpdateFaq(idx, 'answer', e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && (faq.question.trim() || faq.answer.trim())) {
                              handleAddFaq()
                            }
                          }}
                        />
                      </div>
                      <button
                        className="btn-delete-faq"
                        onClick={() => handleRemoveFaq(idx)}
                        title="Eliminar FAQ"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}

                  {knowledge.faqs.length > 0 && (
                    <button
                      type="button"
                      className="btn-add-another-faq"
                      onClick={handleAddFaq}
                    >
                      <Plus size={15} /> + Agregar otra FAQ
                    </button>
                  )}
                </div>
              </div>

              {/* Sección 3: Mini-Simulador de IA */}
              <div className="modal-section simulator-box">
                <label className="section-label">
                  <Play size={16} className="text-amber" /> Probar cómo responde el Bot
                </label>
                <div className="sim-input-row">
                  <input
                    type="text"
                    placeholder="Escribí una pregunta de prueba para este producto..."
                    value={simQuestion}
                    onChange={(e) => setSimQuestion(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSimulate()}
                  />
                  <button
                    className="btn-primary"
                    onClick={handleSimulate}
                    disabled={simulating || !simQuestion.trim()}
                  >
                    {simulating ? <span className="pulse-dot" /> : <Play size={15} />}
                    {simulating ? 'Simulando...' : 'Probar'}
                  </button>
                </div>

                {simResult && (
                  <div className="sim-result-card">
                    <div className="sim-result-meta">
                      <span className="badge badge-emerald">Intención: {simResult.intent}</span>
                      <span className="badge badge-blue">
                        Confianza: {(simResult.confidence * 100).toFixed(0)}%
                      </span>
                    </div>
                    <p className="sim-answer-text">"{simResult.answer}"</p>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="modal-footer">
              {saveSuccess && (
                <span className="save-success-pill">
                  <CheckCircle2 size={16} /> ¡Reglas guardadas con éxito!
                </span>
              )}
              <button
                className="btn-secondary"
                onClick={() => setSelectedProduct(null)}
              >
                Cerrar
              </button>
              <button
                className="btn-primary"
                onClick={handleSaveKnowledge}
                disabled={saving}
              >
                <Save size={16} /> {saving ? 'Guardando...' : 'Guardar Reglas'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
