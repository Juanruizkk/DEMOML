# Publication Quality Checker

## Overview

A quality analysis tab inside the existing product modal that checks each MercadoLibre listing against ML's official publication quality guidelines and surfaces a checklist of what's missing or suboptimal.

Triggered automatically when the seller opens a product's modal. Runs in parallel with the existing knowledge fetch.

---

## Backend

### 1. Extend `Item` entity

Add three optional fields to `ItemProps` and `Item` in `src/domain/entities/Item.ts`:

```ts
pictures?: string[]     // array of image URLs
videoId?: string | null // ML video_id or null
freeShipping?: boolean  // shipping.free_shipping
```

### 2. Update `MeliApiClient.getItem()`

The `/items/{id}` MELI API response already includes `pictures`, `video_id`, and `shipping.free_shipping`. Map them when constructing the `Item`:

```ts
pictures: (itemData.pictures || []).map((p: any) => p.url as string),
videoId: itemData.video_id ?? null,
freeShipping: itemData.shipping?.free_shipping ?? false,
```

### 3. New use case: `AnalyzeItemQualityUseCase`

File: `src/application/use-cases/products/AnalyzeItemQualityUseCase.ts`

Pure function — no external dependencies. Receives an `Item` and returns `QualityCheck[]`.

```ts
export type QualityStatus = 'ok' | 'warning' | 'error'

export interface QualityCheck {
  key: string
  label: string
  status: QualityStatus
  detail: string        // what was found (e.g. "6 imágenes")
  suggestion?: string   // shown only on warning/error
}
```

**Seven checks (in display order):**

| key | Label | OK condition | Warning condition | Error condition |
|---|---|---|---|---|
| `title_brand` | Título incluye marca | brand attribute value found in title (case-insensitive) | — | brand attribute exists but not in title; or no brand attribute |
| `title_model` | Título incluye modelo | model attribute value found in title | — | model attribute exists but not in title; or no model attribute |
| `images` | Imágenes suficientes | `pictures.length >= 4` | `1–3` | `0` |
| `video` | Video | `videoId` is non-null non-empty | — | absent (suggestion only, not blocking) |
| `description` | Descripción completa | `descriptionText.length > 100` | `1–100` | empty |
| `free_shipping` | Envío gratis | `freeShipping === true` | — | false (suggestion to consider enabling) |
| `stock` | Stock disponible | `availableQuantity > 0` | — | `0` |

Brand/model lookup: search `item.attributes` for an entry whose `name` matches `"Marca"` or `"Modelo"` (case-insensitive), then check if that value appears in `item.title`.

### 4. New route

`GET /tenant/products/:itemId/quality`

- Auth: tenant JWT (same as existing `/tenant/products/:itemId/knowledge`)
- Fetches item via `MeliApiClient.getItem()`
- Runs `AnalyzeItemQualityUseCase.execute(item)`
- Returns:

```json
{
  "ok": true,
  "checks": [
    {
      "key": "title_brand",
      "label": "Título incluye marca",
      "status": "ok",
      "detail": "\"Samsung\" encontrado en el título"
    },
    {
      "key": "video",
      "label": "Video",
      "status": "warning",
      "detail": "Sin video",
      "suggestion": "Agregar un video mejora la confianza del comprador"
    }
  ]
}
```

---

## Frontend

### 1. Tab state in product modal (`ProductsPage.tsx`)

Add `activeTab: 'knowledge' | 'quality'` state, defaulting to `'knowledge'`.

### 2. Parallel data fetch on modal open

In `openKnowledgeEditor()`, fire `GET /tenant/products/:itemId/quality` in parallel with the existing knowledge fetch. Store result in `qualityChecks: QualityCheck[]` state. Handle loading/error independently.

### 3. Tab navigation row

Between the modal header and the body split, add:

```
[ ✨ Conocimiento IA ]  [ 🎯 Calidad de Publicación ]
```

Active tab has an underline accent. The body below renders the active tab's content.

### 4. `QualityTab` component

Displayed when `activeTab === 'quality'`. Full-width layout (no split columns).

**Header row:** "Calidad de Publicación" label on the left + `{okCount}/{total} ítems` counter on the right (no numeric score, just a count).

**Check list:** one row per check:
- Status icon: ✅ (ok) / ⚠️ (warning) / ❌ (error)
- Label text (bold)
- Detail text (secondary color, same line or below)
- Suggestion text (muted, below — only shown for warning/error)

**Loading state:** skeleton or spinner while quality fetch is in flight.
**Error state:** inline message "No se pudo analizar la calidad" with a retry button.

### 5. Existing tab ("Conocimiento IA") unchanged

The split-column layout with knowledge rules, FAQs, simulator, and tech specs remains exactly as-is when `activeTab === 'knowledge'`.

---

## Files changed

| File | Change |
|---|---|
| `src/domain/entities/Item.ts` | Add `pictures`, `videoId`, `freeShipping` fields |
| `src/infrastructure/meli/MeliApiClient.ts` | Map new fields in `getItem()` |
| `src/application/use-cases/products/AnalyzeItemQualityUseCase.ts` | New file |
| `src/presentation/controllers/` | New quality controller |
| `src/presentation/routes/` | Register new route |
| `client/src/pages/ProductsPage.tsx` | Tab state, parallel fetch, tab nav, QualityTab |
| `client/src/pages/ProductsPage.css` | Tab nav + quality tab styles |

---

## Out of scope

- AI-generated suggestions (checklist is rule-based only)
- Competitive pricing analysis (requires external data)
- Payment/installments check (not exposed in standard item endpoint)
- Caching quality results (fetched fresh each modal open)
