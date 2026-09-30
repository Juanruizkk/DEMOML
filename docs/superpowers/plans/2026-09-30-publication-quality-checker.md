# Publication Quality Checker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Calidad de Publicación" tab to the product modal that automatically checks each MercadoLibre listing against 7 quality rules and renders a checklist of what's missing or suboptimal.

**Architecture:** Extend the `Item` entity with three fields (`pictures`, `videoId`, `freeShipping`) already returned by the MELI API but currently discarded. A new pure use case `AnalyzeItemQualityUseCase` computes the checks. A new `GET /api/tenant/products/:itemId/quality` route exposes it. The frontend fires this request in parallel with the existing knowledge fetch when opening the product modal, and renders the result in a new tab.

**Tech Stack:** TypeScript, Fastify (backend), React 19 + Vite (frontend), Vitest (tests).

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src/domain/entities/Item.ts` | Modify | Add `pictures`, `videoId`, `freeShipping` optional fields |
| `src/infrastructure/meli/MeliApiClient.ts` | Modify | Map new fields in `getItem()` |
| `src/application/use-cases/products/AnalyzeItemQualityUseCase.ts` | Create | Pure quality-check logic, no external deps |
| `tests/application/AnalyzeItemQuality.test.ts` | Create | Unit tests for the use case |
| `src/presentation/controllers/ProductsController.ts` | Modify | Add `getQuality` method |
| `src/presentation/routes/productsRoutes.ts` | Modify | Register `GET /:itemId/quality` |
| `client/src/pages/ProductsPage.tsx` | Modify | Tab state, parallel fetch, tab nav, quality tab UI |
| `client/src/pages/ProductsPage.css` | Modify | Tab nav + quality checklist styles |

---

## Task 1: Extend Item entity with pictures, videoId, freeShipping

**Files:**
- Modify: `src/domain/entities/Item.ts`

- [ ] **Step 1: Add fields to `ItemProps` and `Item`**

Replace the contents of `src/domain/entities/Item.ts` with:

```typescript
export interface ItemAttribute {
  id?: string;
  name: string;
  value_name: string | null;
}

export interface ItemProps {
  id: string;
  sellerId?: string;
  title: string;
  price: number;
  currencyId: string;
  availableQuantity: number;
  condition: string;
  attributes: ItemAttribute[];
  descriptionText: string;
  permalink?: string;
  pictures?: string[];
  videoId?: string | null;
  freeShipping?: boolean;
  cachedAt?: number;
}

export class Item {
  public readonly id: string;
  public readonly sellerId?: string;
  public readonly title: string;
  public readonly price: number;
  public readonly currencyId: string;
  public readonly availableQuantity: number;
  public readonly condition: string;
  public readonly attributes: ItemAttribute[];
  public readonly descriptionText: string;
  public readonly permalink?: string;
  public readonly pictures: string[];
  public readonly videoId: string | null;
  public readonly freeShipping: boolean;
  public readonly cachedAt: number;

  constructor(props: ItemProps) {
    this.id = props.id;
    this.sellerId = props.sellerId;
    this.title = props.title;
    this.price = props.price;
    this.currencyId = props.currencyId;
    this.availableQuantity = props.availableQuantity;
    this.condition = props.condition;
    this.attributes = props.attributes || [];
    this.descriptionText = props.descriptionText || "";
    this.permalink = props.permalink;
    this.pictures = props.pictures ?? [];
    this.videoId = props.videoId ?? null;
    this.freeShipping = props.freeShipping ?? false;
    this.cachedAt = props.cachedAt || Date.now();
  }

  public isCacheValid(ttlMs: number = 5 * 60 * 1000): boolean {
    return Date.now() - this.cachedAt < ttlMs;
  }
}
```

- [ ] **Step 2: Run existing tests to verify no regressions**

```bash
npx vitest run --reporter=verbose
```

Expected: all tests pass (new fields are optional, existing `Item` construction still works).

- [ ] **Step 3: Commit**

```bash
git add src/domain/entities/Item.ts
git commit -m "feat(item): add pictures, videoId, freeShipping fields to Item entity"
```

---

## Task 2: Map new fields in MeliApiClient.getItem()

**Files:**
- Modify: `src/infrastructure/meli/MeliApiClient.ts`

- [ ] **Step 1: Update the `Item` construction in `getItem()`**

In `MeliApiClient.ts`, find the `return new Item({...})` block inside `getItem()` (around line 79) and add the three new fields:

```typescript
return new Item({
  id: itemData.id,
  sellerId: String(itemData.seller_id || sellerId),
  title: itemData.title,
  price: itemData.price,
  currencyId: itemData.currency_id,
  availableQuantity: itemData.available_quantity,
  condition: itemData.condition,
  attributes: itemData.attributes || [],
  descriptionText: descriptionData.plain_text || "",
  permalink: itemData.permalink,
  pictures: (itemData.pictures || []).map((p: any) => p.url as string),
  videoId: itemData.video_id ?? null,
  freeShipping: itemData.shipping?.free_shipping ?? false,
  cachedAt: Date.now(),
});
```

- [ ] **Step 2: Run existing tests to verify no regressions**

```bash
npx vitest run --reporter=verbose
```

Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/infrastructure/meli/MeliApiClient.ts
git commit -m "feat(meli): map pictures, videoId, freeShipping from MELI API in getItem()"
```

---

## Task 3: Create AnalyzeItemQualityUseCase (TDD)

**Files:**
- Create: `src/application/use-cases/products/AnalyzeItemQualityUseCase.ts`
- Create: `tests/application/AnalyzeItemQuality.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/application/AnalyzeItemQuality.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { AnalyzeItemQualityUseCase } from "../../src/application/use-cases/products/AnalyzeItemQualityUseCase.js";
import { Item } from "../../src/domain/entities/Item.js";

function makeItem(overrides: Partial<ConstructorParameters<typeof Item>[0]> = {}): Item {
  return new Item({
    id: "MLA123",
    sellerId: "seller-1",
    title: "Teclado Gamer Samsung Galaxy S24",
    price: 10000,
    currencyId: "ARS",
    availableQuantity: 5,
    condition: "new",
    attributes: [
      { name: "Marca", value_name: "Samsung" },
      { name: "Modelo", value_name: "Galaxy S24" },
    ],
    descriptionText: "Este es un teclado gamer de alta calidad con switches mecánicos y retroiluminación RGB. Ideal para gaming competitivo.",
    pictures: ["url1", "url2", "url3", "url4"],
    videoId: "vid123",
    freeShipping: true,
    ...overrides,
  });
}

describe("AnalyzeItemQualityUseCase", () => {
  const useCase = new AnalyzeItemQualityUseCase();

  describe("title_brand check", () => {
    it("ok when brand attribute value appears in title", () => {
      const item = makeItem();
      const checks = useCase.execute(item);
      const check = checks.find((c) => c.key === "title_brand")!;
      expect(check.status).toBe("ok");
      expect(check.detail).toContain("Samsung");
    });

    it("error when brand attribute exists but value not in title", () => {
      const item = makeItem({ title: "Teclado Gamer sin marca" });
      const checks = useCase.execute(item);
      const check = checks.find((c) => c.key === "title_brand")!;
      expect(check.status).toBe("error");
      expect(check.suggestion).toBeDefined();
    });

    it("error when brand attribute is missing", () => {
      const item = makeItem({ attributes: [{ name: "Modelo", value_name: "Galaxy S24" }] });
      const checks = useCase.execute(item);
      const check = checks.find((c) => c.key === "title_brand")!;
      expect(check.status).toBe("error");
    });
  });

  describe("title_model check", () => {
    it("ok when model attribute value appears in title", () => {
      const item = makeItem();
      const checks = useCase.execute(item);
      const check = checks.find((c) => c.key === "title_model")!;
      expect(check.status).toBe("ok");
    });

    it("error when model attribute exists but value not in title", () => {
      const item = makeItem({ title: "Teclado Gamer Samsung sin modelo" });
      const checks = useCase.execute(item);
      const check = checks.find((c) => c.key === "title_model")!;
      expect(check.status).toBe("error");
      expect(check.suggestion).toBeDefined();
    });

    it("error when model attribute is missing", () => {
      const item = makeItem({ attributes: [{ name: "Marca", value_name: "Samsung" }] });
      const checks = useCase.execute(item);
      const check = checks.find((c) => c.key === "title_model")!;
      expect(check.status).toBe("error");
    });
  });

  describe("images check", () => {
    it("ok when 4 or more pictures", () => {
      const item = makeItem({ pictures: ["a", "b", "c", "d"] });
      const check = useCase.execute(item).find((c) => c.key === "images")!;
      expect(check.status).toBe("ok");
      expect(check.detail).toBe("4 imágenes");
    });

    it("warning when 1-3 pictures", () => {
      const item = makeItem({ pictures: ["a", "b"] });
      const check = useCase.execute(item).find((c) => c.key === "images")!;
      expect(check.status).toBe("warning");
      expect(check.suggestion).toBeDefined();
    });

    it("error when no pictures", () => {
      const item = makeItem({ pictures: [] });
      const check = useCase.execute(item).find((c) => c.key === "images")!;
      expect(check.status).toBe("error");
    });
  });

  describe("video check", () => {
    it("ok when videoId is set", () => {
      const item = makeItem({ videoId: "vid123" });
      const check = useCase.execute(item).find((c) => c.key === "video")!;
      expect(check.status).toBe("ok");
    });

    it("warning when videoId is null", () => {
      const item = makeItem({ videoId: null });
      const check = useCase.execute(item).find((c) => c.key === "video")!;
      expect(check.status).toBe("warning");
      expect(check.suggestion).toBeDefined();
    });
  });

  describe("description check", () => {
    it("ok when description longer than 100 chars", () => {
      const item = makeItem({ descriptionText: "a".repeat(101) });
      const check = useCase.execute(item).find((c) => c.key === "description")!;
      expect(check.status).toBe("ok");
    });

    it("warning when description is 1-100 chars", () => {
      const item = makeItem({ descriptionText: "Corto" });
      const check = useCase.execute(item).find((c) => c.key === "description")!;
      expect(check.status).toBe("warning");
    });

    it("error when description is empty", () => {
      const item = makeItem({ descriptionText: "" });
      const check = useCase.execute(item).find((c) => c.key === "description")!;
      expect(check.status).toBe("error");
    });
  });

  describe("free_shipping check", () => {
    it("ok when freeShipping is true", () => {
      const item = makeItem({ freeShipping: true });
      const check = useCase.execute(item).find((c) => c.key === "free_shipping")!;
      expect(check.status).toBe("ok");
    });

    it("warning when freeShipping is false", () => {
      const item = makeItem({ freeShipping: false });
      const check = useCase.execute(item).find((c) => c.key === "free_shipping")!;
      expect(check.status).toBe("warning");
      expect(check.suggestion).toBeDefined();
    });
  });

  describe("stock check", () => {
    it("ok when stock > 0", () => {
      const item = makeItem({ availableQuantity: 3 });
      const check = useCase.execute(item).find((c) => c.key === "stock")!;
      expect(check.status).toBe("ok");
      expect(check.detail).toBe("3 unidades");
    });

    it("error when stock is 0", () => {
      const item = makeItem({ availableQuantity: 0 });
      const check = useCase.execute(item).find((c) => c.key === "stock")!;
      expect(check.status).toBe("error");
    });
  });

  it("returns exactly 7 checks in fixed order", () => {
    const item = makeItem();
    const checks = useCase.execute(item);
    expect(checks).toHaveLength(7);
    expect(checks.map((c) => c.key)).toEqual([
      "title_brand",
      "title_model",
      "images",
      "video",
      "description",
      "free_shipping",
      "stock",
    ]);
  });
});
```

- [ ] **Step 2: Run tests — expect them to fail**

```bash
npx vitest run tests/application/AnalyzeItemQuality.test.ts --reporter=verbose
```

Expected: FAIL with "Cannot find module ... AnalyzeItemQualityUseCase".

- [ ] **Step 3: Implement the use case**

Create `src/application/use-cases/products/AnalyzeItemQualityUseCase.ts`:

```typescript
import { Item } from "../../../domain/entities/Item.js";

export type QualityStatus = "ok" | "warning" | "error";

export interface QualityCheck {
  key: string;
  label: string;
  status: QualityStatus;
  detail: string;
  suggestion?: string;
}

export class AnalyzeItemQualityUseCase {
  public execute(item: Item): QualityCheck[] {
    return [
      this.checkTitleBrand(item),
      this.checkTitleModel(item),
      this.checkImages(item),
      this.checkVideo(item),
      this.checkDescription(item),
      this.checkFreeShipping(item),
      this.checkStock(item),
    ];
  }

  private getAttribute(item: Item, name: string): string | null {
    const attr = item.attributes.find(
      (a) => a.name.toLowerCase() === name.toLowerCase()
    );
    return attr?.value_name ?? null;
  }

  private checkTitleBrand(item: Item): QualityCheck {
    const brand = this.getAttribute(item, "Marca");
    if (!brand) {
      return {
        key: "title_brand",
        label: "Título incluye marca",
        status: "error",
        detail: 'Atributo "Marca" no encontrado',
        suggestion: "Completá el atributo Marca en la publicación",
      };
    }
    const inTitle = item.title.toLowerCase().includes(brand.toLowerCase());
    return {
      key: "title_brand",
      label: "Título incluye marca",
      status: inTitle ? "ok" : "error",
      detail: inTitle
        ? `"${brand}" encontrado en el título`
        : `"${brand}" no está en el título`,
      suggestion: inTitle ? undefined : `Agregá "${brand}" al título`,
    };
  }

  private checkTitleModel(item: Item): QualityCheck {
    const model = this.getAttribute(item, "Modelo");
    if (!model) {
      return {
        key: "title_model",
        label: "Título incluye modelo",
        status: "error",
        detail: 'Atributo "Modelo" no encontrado',
        suggestion: "Completá el atributo Modelo en la publicación",
      };
    }
    const inTitle = item.title.toLowerCase().includes(model.toLowerCase());
    return {
      key: "title_model",
      label: "Título incluye modelo",
      status: inTitle ? "ok" : "error",
      detail: inTitle
        ? `"${model}" encontrado en el título`
        : `"${model}" no está en el título`,
      suggestion: inTitle ? undefined : `Agregá "${model}" al título`,
    };
  }

  private checkImages(item: Item): QualityCheck {
    const count = item.pictures.length;
    if (count >= 4) {
      return {
        key: "images",
        label: "Imágenes suficientes",
        status: "ok",
        detail: `${count} imágenes`,
      };
    }
    if (count >= 1) {
      return {
        key: "images",
        label: "Imágenes suficientes",
        status: "warning",
        detail: `${count} imagen${count > 1 ? "es" : ""}`,
        suggestion: "ML recomienda al menos 4 imágenes desde distintos ángulos",
      };
    }
    return {
      key: "images",
      label: "Imágenes suficientes",
      status: "error",
      detail: "Sin imágenes",
      suggestion: "Agregá fotos de alta calidad desde distintos ángulos",
    };
  }

  private checkVideo(item: Item): QualityCheck {
    if (item.videoId) {
      return {
        key: "video",
        label: "Video",
        status: "ok",
        detail: "Video cargado",
      };
    }
    return {
      key: "video",
      label: "Video",
      status: "warning",
      detail: "Sin video",
      suggestion: "Un video mejora la confianza del comprador",
    };
  }

  private checkDescription(item: Item): QualityCheck {
    const len = item.descriptionText.length;
    if (len > 100) {
      return {
        key: "description",
        label: "Descripción completa",
        status: "ok",
        detail: `${len} caracteres`,
      };
    }
    if (len > 0) {
      return {
        key: "description",
        label: "Descripción completa",
        status: "warning",
        detail: `${len} caracteres`,
        suggestion:
          "Ampliá la descripción con especificaciones y beneficios del producto",
      };
    }
    return {
      key: "description",
      label: "Descripción completa",
      status: "error",
      detail: "Sin descripción",
      suggestion:
        "Agregá una descripción detallada para reducir preguntas y reclamos",
    };
  }

  private checkFreeShipping(item: Item): QualityCheck {
    if (item.freeShipping) {
      return {
        key: "free_shipping",
        label: "Envío gratis",
        status: "ok",
        detail: "Envío gratis activo",
      };
    }
    return {
      key: "free_shipping",
      label: "Envío gratis",
      status: "warning",
      detail: "Sin envío gratis",
      suggestion:
        "Ofrecé envío gratis para aparecer más arriba en los resultados",
    };
  }

  private checkStock(item: Item): QualityCheck {
    if (item.availableQuantity > 0) {
      return {
        key: "stock",
        label: "Stock disponible",
        status: "ok",
        detail: `${item.availableQuantity} unidades`,
      };
    }
    return {
      key: "stock",
      label: "Stock disponible",
      status: "error",
      detail: "Sin stock",
      suggestion:
        "Actualizá el stock para que la publicación sea visible",
    };
  }
}
```

- [ ] **Step 4: Run tests — expect them to pass**

```bash
npx vitest run tests/application/AnalyzeItemQuality.test.ts --reporter=verbose
```

Expected: all 17 tests pass.

- [ ] **Step 5: Run full suite to check no regressions**

```bash
npx vitest run --reporter=verbose
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/application/use-cases/products/AnalyzeItemQualityUseCase.ts tests/application/AnalyzeItemQuality.test.ts
git commit -m "feat(products): add AnalyzeItemQualityUseCase with 7 ML quality checks"
```

---

## Task 4: Add getQuality endpoint

**Files:**
- Modify: `src/presentation/controllers/ProductsController.ts`
- Modify: `src/presentation/routes/productsRoutes.ts`

- [ ] **Step 1: Add import and `getQuality` method to `ProductsController`**

At the top of `ProductsController.ts`, add the import after the existing imports:

```typescript
import { AnalyzeItemQualityUseCase } from "../../application/use-cases/products/AnalyzeItemQualityUseCase.js";
```

Then add the following method to the `ProductsController` class (after the `simulate` method, before the closing brace):

```typescript
public getQuality = async (request: FastifyRequest, reply: FastifyReply) => {
  const sellerId = this.extractSellerId(request);
  const { itemId } = request.params as { itemId: string };

  if (!sellerId || !itemId) {
    return reply.status(400).send({ error: "sellerId e itemId son requeridos." });
  }

  try {
    const item = await this.meliClient.getItem(sellerId, itemId);
    const checks = new AnalyzeItemQualityUseCase().execute(item);
    return reply.send({ ok: true, checks });
  } catch (err: any) {
    return reply.status(500).send({ error: err.message });
  }
};
```

- [ ] **Step 2: Register the route in `productsRoutes.ts`**

Add one line to `registerProductsRoutes`, after the `simulate` route:

```typescript
app.get("/api/tenant/products/:itemId/quality", { preHandler: authenticate }, productsCtrl.getQuality);
```

- [ ] **Step 3: Run existing tests to verify no regressions**

```bash
npx vitest run --reporter=verbose
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/presentation/controllers/ProductsController.ts src/presentation/routes/productsRoutes.ts
git commit -m "feat(api): add GET /api/tenant/products/:itemId/quality endpoint"
```

---

## Task 5: Frontend — tab state and parallel quality fetch

**Files:**
- Modify: `client/src/pages/ProductsPage.tsx`

- [ ] **Step 1: Add QualityCheck interface and new state variables**

Near the top of `ProductsPage.tsx`, after the existing interfaces (after `KnowledgeDetail`), add:

```typescript
interface QualityCheck {
  key: string
  label: string
  status: 'ok' | 'warning' | 'error'
  detail: string
  suggestion?: string
}
```

Inside the `ProductsPage` component function, after the existing state declarations, add:

```typescript
const [activeTab, setActiveTab] = useState<'knowledge' | 'quality'>('knowledge')
const [qualityChecks, setQualityChecks] = useState<QualityCheck[]>([])
const [qualityLoading, setQualityLoading] = useState(false)
const [qualityError, setQualityError] = useState('')
```

- [ ] **Step 2: Reset new state and fire quality fetch in `openKnowledgeEditor`**

In `openKnowledgeEditor`, add the following right after the existing `setSimResult(null)` line:

```typescript
setActiveTab('knowledge')
setQualityChecks([])
setQualityError('')
setQualityLoading(true)
```

Then, after the `try { const res = await api.get(...)` block (i.e., after the existing try/catch that sets knowledge and itemDetails), add a separate parallel quality fetch. Replace the existing `openKnowledgeEditor` function entirely with:

```typescript
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

  const [knowledgeRes] = await Promise.allSettled([
    api.get<{ ok: boolean; knowledge: KnowledgeDetail; item?: ItemDetails }>(
      `/tenant/products/${product.id}/knowledge`
    ),
  ])

  if (knowledgeRes.status === 'fulfilled') {
    const res = knowledgeRes.value
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
  } else {
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
```

- [ ] **Step 3: Add tab navigation UI to the modal**

In the modal JSX, find the `<div className="modal-body-split">` opening tag and insert the tab nav immediately before it:

```tsx
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
```

Then wrap the existing `<div className="modal-body-split">` so it only renders when `activeTab === 'knowledge'`:

```tsx
{activeTab === 'knowledge' && (
  <div className="modal-body-split">
    {/* existing content — no changes inside */}
    ...
  </div>
)}
```

- [ ] **Step 4: Add quality tab content**

Immediately after the closing `)}` of the `activeTab === 'knowledge'` block (and before the `<div className="modal-footer">`), add:

```tsx
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
```

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/ProductsPage.tsx
git commit -m "feat(frontend): add quality tab state, parallel fetch, and checklist UI to product modal"
```

---

## Task 6: Frontend — styles for tabs and quality checklist

**Files:**
- Modify: `client/src/pages/ProductsPage.css`

- [ ] **Step 1: Add tab nav and quality tab styles**

Append the following to the end of `client/src/pages/ProductsPage.css`:

```css
/* ─── Modal Tab Navigation ─────────────────────────────────── */
.modal-tabs {
  display: flex;
  gap: 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  padding: 0 1.5rem;
  background: transparent;
}

.modal-tab {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.75rem 1.25rem;
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  color: rgba(255, 255, 255, 0.45);
  font-size: 0.85rem;
  font-weight: 500;
  cursor: pointer;
  transition: color 0.15s, border-color 0.15s;
  margin-bottom: -1px;
}

.modal-tab:hover {
  color: rgba(255, 255, 255, 0.75);
}

.modal-tab--active {
  color: #fff;
  border-bottom-color: #6366f1;
}

/* ─── Quality Tab ───────────────────────────────────────────── */
.quality-tab {
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  min-height: 320px;
}

.quality-tab-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.quality-tab-title {
  font-size: 0.9rem;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.85);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.quality-counter {
  font-size: 0.8rem;
  color: rgba(255, 255, 255, 0.45);
  background: rgba(255, 255, 255, 0.06);
  padding: 0.2rem 0.6rem;
  border-radius: 99px;
}

.quality-loading,
.quality-error {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  color: rgba(255, 255, 255, 0.5);
  font-size: 0.875rem;
  padding: 1rem 0;
}

.quality-error {
  color: #f87171;
}

.quality-checklist {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.quality-check-row {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.06);
}

.quality-check-row--ok {
  border-color: rgba(16, 185, 129, 0.15);
}

.quality-check-row--warning {
  border-color: rgba(245, 158, 11, 0.2);
}

.quality-check-row--error {
  border-color: rgba(239, 68, 68, 0.2);
}

.quality-check-icon {
  font-size: 1rem;
  flex-shrink: 0;
  margin-top: 1px;
}

.quality-check-body {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  flex: 1;
  min-width: 0;
}

.quality-check-label {
  font-size: 0.875rem;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.85);
}

.quality-check-detail {
  font-size: 0.8rem;
  color: rgba(255, 255, 255, 0.45);
}

.quality-check-suggestion {
  font-size: 0.78rem;
  color: rgba(245, 158, 11, 0.85);
  margin-top: 0.1rem;
}

.quality-check-row--error .quality-check-suggestion {
  color: rgba(239, 68, 68, 0.85);
}
```

- [ ] **Step 2: Start the dev server and verify visually**

```bash
cd client && npm run dev
```

Open `http://localhost:5173`, log in, navigate to the Products page, open any product modal, and click "Calidad de Publicación". Verify:
- Tab navigation renders and switches correctly
- Checklist loads with ✅/⚠️/❌ icons
- Suggestions appear on warning/error rows
- Counter in header updates (e.g., "5/7 ítems")
- Existing Conocimiento IA tab is unchanged

- [ ] **Step 3: Run full test suite one final time**

```bash
cd .. && npx vitest run --reporter=verbose
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add client/src/pages/ProductsPage.css
git commit -m "feat(frontend): add tab nav and quality checklist styles to product modal"
```

---

## Self-Review

**Spec coverage:**
- ✅ Item entity extended with `pictures`, `videoId`, `freeShipping` — Task 1
- ✅ `MeliApiClient.getItem()` maps new fields — Task 2
- ✅ `AnalyzeItemQualityUseCase` with all 7 checks — Task 3
- ✅ `GET /api/tenant/products/:itemId/quality` endpoint — Task 4
- ✅ Tab navigation in modal — Task 5
- ✅ Quality fetch fires automatically on modal open — Task 5
- ✅ Checklist full-width with ✅/⚠️/❌ — Task 5
- ✅ Counter `{ok}/{total} ítems` — Task 5
- ✅ Styles — Task 6
- ✅ Existing Conocimiento IA tab unchanged — Task 5 (wrapped in conditional)

**No placeholders found** — all steps have concrete code.

**Type consistency:**
- `QualityCheck` interface defined in Task 3 (use case), matches shape used in Task 4 (controller), matches frontend interface in Task 5
- `Item.pictures`, `Item.videoId`, `Item.freeShipping` defined in Task 1, mapped in Task 2, read in Task 3
- `AnalyzeItemQualityUseCase` instantiated inline in controller — no constructor params needed
