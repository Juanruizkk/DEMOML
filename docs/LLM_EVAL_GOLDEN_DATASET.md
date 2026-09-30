# LLM Eval & Golden Dataset

**Implementado:** 2026-09-16/17  
**Estado:** Completo — 358 tests pasan, 9 commits en `main`

---

## Qué se construyó

Sistema de evaluación de LLMs de 5 capas para MELI AI Assistant. Las decisiones humanas (approve/edit/reject) alimentan un **golden dataset** por tenant, que sirve como suite de tests automáticos en CI/CD para detectar regresiones en intent classification y moderación cuando se cambian prompts.

---

## Arquitectura

```
Pregunta llega → LLM clasifica + genera respuesta → Moderación
    ↓ baja confianza o falla moderación
Revisión humana (approve / edit / edited_from_scratch / reject)
    ↓ si no es rejected
Golden Dataset (por tenant, solo superadmin lo ve)
    ↓ en CI/CD
EvalRunner (función pura, $0, sin LLM real)
    → chequea intent match + moderación → pass/fail
```

---

## Archivos nuevos

| Archivo | Responsabilidad |
|---------|----------------|
| `src/domain/entities/GoldenDatasetEntry.ts` | Entidad de dominio |
| `src/application/interfaces/IGoldenDatasetRepository.ts` | Interface: save, findBySellerId, getMetricsBySellerId |
| `src/infrastructure/persistence/postgres/PostgresGoldenDatasetRepository.ts` | Implementación Postgres |
| `src/application/use-cases/SaveHumanDecisionUseCase.ts` | Orquesta approve/reject + persiste en golden dataset |
| `src/infrastructure/eval/EvalRunner.ts` | Función pura para CI/CD: intent match + moderación |
| `src/tests/evals/moderation.eval.test.ts` | 15 tests de regresión sobre ModerationService |
| `src/tests/evals/eval-runner.eval.test.ts` | 6 tests para EvalRunner |
| `src/tests/evals/SaveHumanDecision.eval.test.ts` | 7 tests: entidad + use case |

**Plan completo:** `docs/superpowers/plans/2026-09-16-llm-eval-golden-dataset.md`

---

## Tabla DB nueva: `golden_dataset`

```sql
CREATE TABLE golden_dataset (
  id                 TEXT PRIMARY KEY,
  seller_id          TEXT NOT NULL,
  source_question_id TEXT NOT NULL,
  question_text      TEXT NOT NULL,
  item_snapshot      TEXT NOT NULL,  -- JSON congelado del ítem al momento de la decisión
  llm_intent         TEXT NOT NULL,  -- lo que clasificó el LLM
  human_intent       TEXT NOT NULL,  -- lo que el humano dice que era (puede diferir)
  llm_answer         TEXT NOT NULL,
  final_answer       TEXT NOT NULL,  -- respuesta aprobada/editada por el humano
  decision           TEXT NOT NULL,  -- 'approved' | 'edited' | 'edited_from_scratch'
  quality_rating     INTEGER,        -- 1-5, nullable
  reviewer_id        TEXT,
  reasoning_note     TEXT,
  created_at         TIMESTAMP DEFAULT NOW()
);
-- Índices: seller_id, human_intent, decision, source_question_id
```

---

## Endpoints nuevos

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| `POST` | `/api/questions/:id/human-decision` | authenticate | Registra decisión humana + guarda en golden dataset |
| `GET` | `/api/admin/tenants/:sellerId/golden-dataset` | requireSuperAdmin | Lista golden dataset con filtros (intent, decision, limit, offset) |
| `GET` | `/api/admin/tenants/:sellerId/golden-dataset/metrics` | requireSuperAdmin | Métricas: intentMismatchRate, avgQualityRating, byDecision, byIntent |

### Body de `POST /api/questions/:id/human-decision`

```json
{
  "decision": "approved | edited | edited_from_scratch | rejected",
  "customAnswer": "Texto alternativo (requerido para edited y edited_from_scratch)",
  "humanIntent": "stock | envio | caracteristicas | garantia | facturacion | precio_negociacion | reclamo | contacto_externo | otro",
  "qualityRating": 5,
  "reasoningNote": "Opcional — por qué se editó"
}
```

---

## Tipos de decisión

| `decision` | Se guarda en golden dataset | Cuándo |
|---|---|---|
| `approved` | ✅ | Humano aprueba la respuesta del LLM tal cual |
| `edited` | ✅ | Humano modifica la respuesta del LLM |
| `edited_from_scratch` | ✅ | Humano rechaza y escribe su propia respuesta — el caso más valioso |
| `rejected` | ❌ | Humano rechaza sin dar alternativa — no hay respuesta correcta que aprender |

---

## EvalRunner (CI/CD)

Función pura en `src/infrastructure/eval/EvalRunner.ts`. Para cada entrada del golden dataset verifica:

1. **Intent match**: ¿el intent del LLM coincide con `humanIntent`?
2. **Moderación**: ¿la respuesta pasa `ModerationService.moderate()`?

Sin LLM real, sin DB, sin costo. Corre en cada PR con `npm test`.

```typescript
import { runEval } from "./infrastructure/eval/EvalRunner.js";

const result = runEval([
  { entry: goldenEntry, llmOutput: { intent: "stock", answer: "Sí, hay stock.", confidence: 0.9 } }
]);
// result.passed, result.failed, result.failureRate, result.failures
```

---

## Tests de regresión en CI

Los 27 tests en `src/tests/evals/` corren con `npm test` sin configuración adicional:

- `moderation.eval.test.ts` — 15 tests: si una regla de moderación se rompe, falla
- `eval-runner.eval.test.ts` — 6 tests: valida la lógica del evaluador
- `SaveHumanDecision.eval.test.ts` — 7 tests: entidad + flujo de decisiones humanas

---

## Decisiones de diseño

- **Sin LLM-as-judge**: más simple, sin costo extra, suficiente para detectar regresiones
- **Sin tabla `traces`**: ya existe en `questions` + `events`
- **Item snapshot congelado**: el eval en CI usa el contexto del ítem al momento de la decisión, no el estado actual (que puede haber cambiado)
- **El humano puede corregir el intent**: `humanIntent` puede diferir de `llmIntent`, esto es lo que hace el dataset valioso para detectar regresiones de clasificación
- **Golden dataset visible solo para superadmin**: cada tenant tiene su propio dataset pero no lo ve directamente; el superadmin lo usa para analizar y mejorar prompts

---

## Commits

```
f538833 fix: add humanIntent and qualityRating validation in humanDecision endpoint
9295564 feat: wire SaveHumanDecisionUseCase and golden dataset endpoints
aba1584 feat: add EvalRunner for CI/CD golden dataset evaluation
372a674 feat: add SaveHumanDecisionUseCase with golden dataset persistence
4b3828e feat: add PostgresGoldenDatasetRepository
b6404db feat: add moderation eval suite for CI regression testing
dfe1488 feat: add GoldenDatasetEntry entity and IGoldenDatasetRepository interface
8ac5fe5 fix: add index on source_question_id in golden_dataset
1b1dc4b feat: add golden_dataset table to schema
```
