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
  HelpCircle,
  Search,
  BookOpen,
  ListChecks,
  FileText,
  Copy,
  Check,
  Info,
  Layers,
  ChevronDown,
  ChevronUp
} from 'lucide-react'
import PaginationControls from '../components/PaginationControls'
import './ProductsPage.css'

interface ProductKnowledge {
  customInstructions: string
  faqsCount: number
  isActive: boolean
  updatedAt: string
}

interface ProductAttribute {
  id?: string
  name: string
  value_name: string | null
}

interface ItemDetails {
  id: string
  title: string
  price: number
  currencyId: string
  availableQuantity: number
  condition: string
  permalink?: string
  attributes: ProductAttribute[]
  descriptionText: string
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

interface QualityCheck {
  key: string
  label: string
  status: 'ok' | 'warning' | 'error'
  detail: string
  suggestion?: string
}

// Natural Spanish question generator from an attribute
function formatAttributeQuestionAndAnswer(name: string, value: string): { q: string; a: string } {
  const rawName = name.trim()
  const val = value.trim()
  const n = rawName.toLowerCase()

  // 1. Warranty
  if (n.includes('garantía') || n.includes('garantia')) {
    return {
      q: '¿Tiene garantía oficial este producto?',
      a: `Sí, cuenta con ${val} de garantía oficial.`
    }
  }

  // 2. Brand / Model / Line
  if (n === 'marca' || n === 'marca del producto') {
    return {
      q: '¿De qué marca es?',
      a: `El producto es de marca original ${val}.`
    }
  }
  if (n === 'modelo') {
    return {
      q: '¿Qué modelo específico es?',
      a: `Es el modelo ${val}.`
    }
  }
  if (n === 'línea' || n === 'linea') {
    return {
      q: '¿A qué línea o serie pertenece?',
      a: `Pertenece a la línea ${val}.`
    }
  }

  // 3. Condition
  if (n.includes('condición') || n.includes('condicion')) {
    const isNew = val.toLowerCase().includes('nuevo') || val.toLowerCase() === 'new'
    return {
      q: '¿El producto es nuevo o sellado?',
      a: isNew ? 'Sí, el producto es nuevo y sellado de fábrica.' : `Condición: ${val}.`
    }
  }

  // 4. Color
  if (n.includes('color')) {
    return {
      q: '¿De qué color viene?',
      a: `El color de esta publicación es ${val}.`
    }
  }

  // 5. Voltage / Power
  if (n.includes('voltaje') || n.includes('tensión') || n.includes('alimentación') || n.includes('alimentacion')) {
    return {
      q: '¿Qué voltaje o alimentación requiere?',
      a: `Funciona con ${val}.`
    }
  }
  if (n.includes('potencia')) {
    return {
      q: '¿Qué potencia tiene?',
      a: `Tiene una potencia de ${val}.`
    }
  }

  // 6. Connectivity / Wireless / Bluetooth
  if (n.includes('inalámbrico') || n.includes('inalambrico')) {
    const isYes = val.toLowerCase().includes('sí') || val.toLowerCase().includes('si') || val.toLowerCase() === 'true'
    return {
      q: '¿Es inalámbrico?',
      a: isYes ? 'Sí, es 100% inalámbrico.' : 'No, funciona conectado por cable.'
    }
  }
  if (n.includes('bluetooth')) {
    const isYes = val.toLowerCase().includes('sí') || val.toLowerCase().includes('si') || val.toLowerCase() === 'true'
    return {
      q: '¿Tiene conectividad Bluetooth?',
      a: isYes ? 'Sí, cuenta con conectividad Bluetooth.' : `Bluetooth: ${val}.`
    }
  }
  if (n.includes('conectividad') || n.includes('conexión') || n.includes('conexion') || n.includes('interfaz')) {
    return {
      q: '¿Qué tipo de conectividad tiene?',
      a: `Cuenta con conectividad ${val}.`
    }
  }

  // 7. Battery / Autonomy
  if (n.includes('batería') || n.includes('bateria') || n.includes('autonomía') || n.includes('autonomia')) {
    return {
      q: '¿Qué autonomía o duración de batería tiene?',
      a: `Tiene una autonomía de ${val}.`
    }
  }

  // 8. BPA / Dishwasher / Food safe / Aptitude
  if (n.includes('bpa') || n.includes('libre de bpa')) {
    const isYes = val.toLowerCase().includes('sí') || val.toLowerCase().includes('si') || val.toLowerCase() === 'true'
    return {
      q: '¿Es libre de BPA?',
      a: isYes ? 'Sí, es 100% libre de BPA.' : `Libre de BPA: ${val}.`
    }
  }
  if (n.includes('apto') || n.includes('lavavajillas') || n.includes('microondas')) {
    return {
      q: `¿Es ${rawName.toLowerCase()}?`,
      a: `${rawName}: ${val}.`
    }
  }
  if (n.includes('tapa') || n.includes('apertura')) {
    return {
      q: '¿Cómo es el sistema de apertura de la tapa?',
      a: `Cuenta con sistema de tapa ${val.toLowerCase()}.`
    }
  }

  // 9. Material / Dimensions / Weight / Capacity
  if (n.includes('material')) {
    return {
      q: '¿De qué material está fabricado?',
      a: `Está fabricado en ${val.toLowerCase()}.`
    }
  }
  if (n.includes('capacidad') || n.includes('volumen')) {
    return {
      q: '¿Qué capacidad tiene?',
      a: `Tiene una capacidad de ${val}.`
    }
  }
  if (n.includes('peso')) {
    return {
      q: '¿Cuánto pesa?',
      a: `El peso es de ${val}.`
    }
  }
  if (n.includes('dimension') || n.includes('medida') || n.includes('alto') || n.includes('ancho') || n.includes('largo')) {
    return {
      q: `¿Cuáles son las medidas (${rawName})?`,
      a: `${rawName}: ${val}.`
    }
  }

  // 10. Compatibility / Includes
  if (n.includes('compatib')) {
    return {
      q: '¿Con qué dispositivos es compatible?',
      a: `Es compatible con ${val}.`
    }
  }
  if (n.includes('incluye') || n.includes('contenido') || n.includes('accesorios')) {
    return {
      q: '¿Qué accesorios incluye la caja?',
      a: `Incluye ${val}.`
    }
  }

  // Default fallback
  const cleanName = rawName
  if (cleanName.toLowerCase().startsWith('es ')) {
    return {
      q: `¿${cleanName.charAt(0).toUpperCase() + cleanName.slice(1)}?`,
      a: `${val}.`
    }
  }

  return {
    q: `¿Qué características tiene de "${cleanName}"?`,
    a: `${cleanName}: ${val}.`
  }
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
  const [itemDetails, setItemDetails] = useState<ItemDetails | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)

  // Attribute search & toast
  const [attrSearch, setAttrSearch] = useState('')
  const [showDescription, setShowDescription] = useState(false)
  const [copiedDesc, setCopiedDesc] = useState(false)
  const [justAddedAttr, setJustAddedAttr] = useState<string | null>(null)

  // Simulation state
  const [simQuestion, setSimQuestion] = useState('')
  const [simulating, setSimulating] = useState(false)
  const [simResult, setSimResult] = useState<any>(null)

  // Tab & quality state
  const [activeTab, setActiveTab] = useState<'knowledge' | 'quality'>('knowledge')
  const [qualityChecks, setQualityChecks] = useState<QualityCheck[]>([])
  const [qualityLoading, setQualityLoading] = useState(false)
  const [qualityError, setQualityError] = useState('')

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
    setAttrSearch('')
    setShowDescription(false)
    setActiveTab('knowledge')
    setQualityChecks([])
    setQualityError('')
    setQualityLoading(true)

    try {
      const res = await api.get<{ ok: boolean; knowledge: KnowledgeDetail; item?: ItemDetails }>(
        `/tenant/products/${product.id}/knowledge`
      )
      setKnowledge({
        customInstructions: res.knowledge?.customInstructions || '',
        faqs: res.knowledge?.faqs || [],
        isActive: res.knowledge?.isActive !== undefined ? res.knowledge.isActive : true,
      })
      if (res.item) {
        setItemDetails(res.item)
      } else {
        setItemDetails({
          id: product.id,
          title: product.title,
          price: product.price,
          currencyId: product.currencyId,
          availableQuantity: product.availableQuantity,
          condition: product.condition,
          permalink: product.permalink,
          attributes: [],
          descriptionText: '',
        })
      }
    } catch {
      setKnowledge({ customInstructions: '', faqs: [], isActive: true })
      setItemDetails(null)
    }

    try {
      const qRes = await api.get<{ ok: boolean; checks: QualityCheck[] }>(
        `/tenant/products/${product.id}/quality`
      )
      setQualityChecks(qRes.checks || [])
    } catch {
      setQualityError('No se pudo analizar la calidad de esta publicación.')
    } finally {
      setQualityLoading(false)
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

  // Quick FAQ generation from an attribute
  const handleAddFaqFromAttribute = (attr: ProductAttribute) => {
    const val = (attr.value_name || '').trim()
    if (!val) return

    const { q, a } = formatAttributeQuestionAndAnswer(attr.name, val)

    setKnowledge((prev) => ({
      ...prev,
      faqs: [...prev.faqs, { question: q, answer: a }],
    }))

    setJustAddedAttr(attr.name)
    setTimeout(() => setJustAddedAttr(null), 2500)
  }

  const handleCopyDescription = () => {
    if (!itemDetails?.descriptionText) return
    navigator.clipboard.writeText(itemDetails.descriptionText)
    setCopiedDesc(true)
    setTimeout(() => setCopiedDesc(false), 2000)
  }

  const handleSaveKnowledge = async () => {
    if (!selectedProduct) return
    setSaving(true)
    setSaveSuccess(false)
    try {
      await api.put(`/tenant/products/${selectedProduct.id}/knowledge`, knowledge)
      setSaveSuccess(true)
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

  // Filtered attributes in modal
  const filteredAttributes = (itemDetails?.attributes || []).filter((attr) => {
    if (!attrSearch.trim()) return true
    const q = attrSearch.toLowerCase()
    return (
      attr.name.toLowerCase().includes(q) ||
      (attr.value_name && attr.value_name.toLowerCase().includes(q))
    )
  })

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
                    {prod.knowledge.customInstructions && (
                      <p className="knowledge-text">
                        "{prod.knowledge.customInstructions.slice(0, 70)}
                        {prod.knowledge.customInstructions.length > 70 ? '...' : ''}"
                      </p>
                    )}
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
                    <Sparkles size={15} /> Configurar IA & Ficha
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

      {/* Modal / Drawer de Configuración de Conocimiento Expandido */}
      {selectedProduct && (
        <div className="modal-overlay" onClick={() => setSelectedProduct(null)}>
          <div className="modal-drawer modal-drawer--wide" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="modal-header">
              <div className="modal-header-info">
                <span className="modal-pretitle">BASE DE CONOCIMIENTO & FICHA TÉCNICA</span>
                <h2 className="modal-title">{selectedProduct.title}</h2>
                <div className="modal-meta-chips">
                  <span className="meta-chip">ID: <strong className="meta-chip-val">{selectedProduct.id}</strong></span>
                  <span className="meta-chip">Stock: <strong className="meta-chip-val">{selectedProduct.availableQuantity} u.</strong></span>
                  <span className="meta-chip">Precio: <strong className="meta-chip-val">${selectedProduct.price.toLocaleString('es-AR')} {selectedProduct.currencyId}</strong></span>
                  {selectedProduct.permalink && (
                    <a
                      href={selectedProduct.permalink}
                      target="_blank"
                      rel="noreferrer"
                      className="meta-chip meta-chip--link"
                    >
                      Ver en ML <ExternalLink size={12} />
                    </a>
                  )}
                </div>
              </div>
              <button
                className="btn-close"
                onClick={() => setSelectedProduct(null)}
                title="Cerrar ventana"
              >
                ✕
              </button>
            </div>

            {/* Tab Navigation */}
            <div className="modal-tabs">
              <button
                className={`modal-tab${activeTab === 'knowledge' ? ' modal-tab--active' : ''}`}
                onClick={() => setActiveTab('knowledge')}
              >
                <Sparkles size={15} /> Conocimiento IA
              </button>
              <button
                className={`modal-tab${activeTab === 'quality' ? ' modal-tab--active' : ''}`}
                onClick={() => setActiveTab('quality')}
              >
                <ListChecks size={15} /> Calidad de Publicación
              </button>
            </div>

            {activeTab === 'knowledge' && (
            <div className="modal-body-split">
              {/* Left Column: Knowledge Rules & FAQs */}
              <div className="modal-column modal-column--rules">
                {/* Section 1: Special Instructions */}
                <div className="modal-section">
                  <label className="section-label">
                    <Sparkles size={16} className="text-blue" /> Instrucciones Prioritarias para la IA
                  </label>
                  <p className="section-hint">
                    Reglas estrictas que el bot respetará ante cualquier pregunta sobre este ítem (ej. stock de accesorios, compatibilidades, advertencias de uso).
                  </p>
                  <textarea
                    className="knowledge-textarea"
                    rows={3}
                    placeholder="Ej: Aclarar que incluye switches de repuesto y extractor. Si preguntan por color blanco, decir que entra en 15 días."
                    value={knowledge.customInstructions}
                    onChange={(e) =>
                      setKnowledge({ ...knowledge, customInstructions: e.target.value })
                    }
                  />
                </div>

                {/* Section 2: Specific FAQs */}
                <div className="modal-section">
                  <div className="section-title-row">
                    <div className="section-title-left">
                      <HelpCircle size={16} className="text-emerald" />
                      <span className="section-title-text">Preguntas y Respuestas Frecuentes (FAQs)</span>
                      <span className="count-pill">{knowledge.faqs.length}</span>
                    </div>
                    <button className="btn-secondary btn-sm" onClick={handleAddFaq}>
                      <Plus size={13} />
                      <span>Agregar FAQ</span>
                    </button>
                  </div>
                  <p className="section-hint">
                    Definí preguntas habituales y la respuesta exacta que debe proporcionar el bot.
                  </p>

                  {knowledge.faqs.length === 0 && (
                    <div className="empty-faq-box">
                      <BookOpen size={22} className="text-muted" />
                      <p className="empty-faq-text">
                        No hay FAQs personalizadas aún. Podés crearlas manualmente con <strong>"Agregar FAQ"</strong> o usar el botón <strong>"+ FAQ"</strong> desde la ficha técnica de la derecha.
                      </p>
                    </div>
                  )}

                  <div className="faqs-list">
                    {knowledge.faqs.map((faq, idx) => (
                      <div key={idx} className="faq-row-card">
                        <div className="faq-index-number">#{idx + 1}</div>
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
                        <Plus size={14} /> + Agregar otra FAQ
                      </button>
                    )}
                  </div>
                </div>

                {/* Section 3: Live IA Simulator */}
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
                        {simResult.requiresHuman && (
                          <span className="badge badge-amber">Requiere Humano</span>
                        )}
                      </div>
                      <p className="sim-answer-text">"{simResult.answer}"</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column: Mercado Libre Technical Specs & Attributes */}
              <div className="modal-column modal-column--specs">
                <div className="specs-header-box">
                  <div className="specs-title-row">
                    <div className="specs-title-group">
                      <ListChecks size={18} className="text-blue" />
                      <span className="specs-title">Ficha Técnica (Mercado Libre)</span>
                    </div>
                    <span className="specs-count-pill">
                      {itemDetails?.attributes?.length || 0} especificaciones
                    </span>
                  </div>
                  <div className="specs-explanation-card">
                    <Info size={14} className="info-icon" />
                    <span className="specs-explanation-text">
                      La IA consulta automáticamente todos estos datos al responder. Hacé clic en <strong>+ FAQ</strong> en cualquier dato para crear una respuesta oficial rápida.
                    </span>
                  </div>
                </div>

                {/* Attribute Search Filter */}
                <div className="specs-search-bar">
                  <Search size={14} className="specs-search-icon" />
                  <input
                    type="text"
                    placeholder="Filtrar características (ej. garantía, color, voltaje)..."
                    value={attrSearch}
                    onChange={(e) => setAttrSearch(e.target.value)}
                  />
                  {attrSearch && (
                    <button
                      type="button"
                      className="btn-clear-attr-search"
                      onClick={() => setAttrSearch('')}
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* Attributes List */}
                <div className="specs-list-container">
                  {justAddedAttr && (
                    <div className="attr-added-toast">
                      <Check size={14} color="#10b981" /> FAQ creada a partir de "{justAddedAttr}"
                    </div>
                  )}

                  {filteredAttributes.length === 0 ? (
                    <div className="empty-specs-box">
                      <Layers size={22} className="text-muted" />
                      <p>No se encontraron atributos con esa búsqueda.</p>
                    </div>
                  ) : (
                    <div className="attributes-grid">
                      {filteredAttributes.map((attr, idx) => {
                        const val = attr.value_name || 'No especificado'
                        return (
                          <div key={attr.id || `${attr.name}-${idx}`} className="attr-card">
                            <div className="attr-card-content">
                              <span className="attr-card-name">{attr.name}</span>
                              <span className="attr-card-value" title={val}>{val}</span>
                            </div>
                            <button
                              type="button"
                              className="btn-attr-to-faq"
                              onClick={() => handleAddFaqFromAttribute(attr)}
                              title={`Crear pregunta frecuente sobre ${attr.name}`}
                            >
                              <Plus size={11} /> <span>FAQ</span>
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>

                {/* Collapsible Official Description Viewer */}
                {itemDetails?.descriptionText && (
                  <div className="description-accordion">
                    <button
                      type="button"
                      className="description-toggle-btn"
                      onClick={() => setShowDescription(!showDescription)}
                    >
                      <div className="description-toggle-left">
                        <FileText size={15} />
                        <span>Descripción Oficial de la Publicación</span>
                      </div>
                      {showDescription ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>

                    {showDescription && (
                      <div className="description-body">
                        <div className="description-actions">
                          <button
                            type="button"
                            className="btn-copy-desc"
                            onClick={handleCopyDescription}
                          >
                            {copiedDesc ? <Check size={13} color="#10b981" /> : <Copy size={13} />}
                            {copiedDesc ? '¡Copiado!' : 'Copiar texto'}
                          </button>
                        </div>
                        <div className="description-scroll-box">
                          {itemDetails.descriptionText}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
            )}

            {activeTab === 'quality' && (
              <div className="quality-tab">
                <div className="quality-tab-header">
                  <span className="quality-tab-title">Calidad de Publicación</span>
                  {!qualityLoading && !qualityError && qualityChecks.length > 0 && (
                    <span className="quality-counter">
                      {qualityChecks.filter((c) => c.status === 'ok').length}/{qualityChecks.length} ítems
                    </span>
                  )}
                </div>

                {qualityLoading && (
                  <div className="quality-loading">
                    <span className="pulse-dot" /> Analizando publicación...
                  </div>
                )}

                {qualityError && !qualityLoading && (
                  <div className="quality-error">
                    {qualityError}
                    <button
                      className="btn-secondary btn-sm"
                      onClick={() => selectedProduct && openKnowledgeEditor(selectedProduct)}
                    >
                      Reintentar
                    </button>
                  </div>
                )}

                {!qualityLoading && !qualityError && qualityChecks.length > 0 && (
                  <div className="quality-checklist">
                    {qualityChecks.map((check) => (
                      <div key={check.key} className={`quality-check-row quality-check-row--${check.status}`}>
                        <span className="quality-check-icon">
                          {check.status === 'ok' ? '✅' : check.status === 'warning' ? '⚠️' : '❌'}
                        </span>
                        <div className="quality-check-body">
                          <span className="quality-check-label">{check.label}</span>
                          <span className="quality-check-detail">{check.detail}</span>
                          {check.suggestion && (
                            <span className="quality-check-suggestion">{check.suggestion}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

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
