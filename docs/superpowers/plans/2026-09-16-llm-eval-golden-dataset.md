# LLM Eval & Golden Dataset Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Registrar decisiones humanas (approve/edit/reject) en un golden dataset por tenant, y correr evals automáticos en CI/CD que verifiquen que el intent y la moderación no regresionan al cambiar prompts.

**Architecture:** `SaveHumanDecisionUseCase` orquesta las acciones existentes (approve/reject) y, cuando la decisión es `approved`/`edited`/`edited_from_scratch`, persiste una `GoldenDatasetEntry` con el contexto del ítem congelado. Un `EvalRunner` puro (sin LLM) toma entradas golden + outputs de LLM y retorna pass/fail — los tests de CI usan fixtures estáticos, sin costo real de API.

**Tech Stack:** TypeScript · Fastify · Drizzle ORM · PostgreSQL · Vitest

---

## File Map

| Acción | Archivo |
|--------|---------|
| Modify | `src/infrastructure/persistence/drizzle/schema.ts` |
| Create | `src/infrastructure/persistence/drizzle/migrations/0001_golden_dataset.sql` |
| Create | `src/domain/entities/GoldenDatasetEntry.ts` |
| Create | `src/application/interfaces/IGoldenDatasetRepository.ts` |
| Create | `src/infrastructure/persistence/postgres/PostgresGoldenDatasetRepository.ts` |
| Create | `src/application/use-cases/SaveHumanDecisionUseCase.ts` |
| Create | `src/infrastructure/eval/EvalRunner.ts` |
| Create | `src/tests/evals/moderation.eval.test.ts` |
| Create | `src/tests/evals/eval-runner.eval.test.ts` |
| Create | `src/tests/evals/SaveHumanDecision.eval.test.ts` |
| Modify | `src/presentation/controllers/QuestionsController.ts` |
| Modify | `src/app.ts` |

---

## Task 1: Schema SQL — tabla `golden_dataset`

**Files:**
- Modify: `src/infrastructure/persistence/drizzle/schema.ts`

- [ ] **Step 1: Agregar la tabla al schema de Drizzle**

Agregar al final de `src/infrastructure/persistence/drizzle/schema.ts`, antes del último `export`:

```typescript
export const goldenDataset = pgTable('golden_dataset', {
  id: text('id').primaryKey(),
  sellerId: text('seller_id').notNull(),
  sourceQuestionId: text('source_question_id').notNull(),
  questionText: text('question_text').notNull(),
  itemSnapshot: text('item_snapshot').notNull(), // JSON.stringify del ítem completo
  llmIntent: text('llm_intent').notNull(),
  humanIntent: text('human_intent').notNull(),
  llmAnswer: text('llm_answer').notNull(),
  finalAnswer: text('final_answer').notNull(),
  decision: text('decision').notNull(), // 'approved' | 'edited' | 'edited_from_scratch'
  qualityRating: integer('quality_rating'), // 1-5, nullable
  reviewerId: text('reviewer_id'),
  reasoningNote: text('reasoning_note'),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => [
  index('idx_golden_seller').on(table.sellerId),
  index('idx_golden_intent').on(table.humanIntent),
  index('idx_golden_decision').on(table.decision),
]);
```

- [ ] **Step 2: Generar el archivo SQL de migración**

```bash
npm run db:generate
```

Expected: crea `src/infrastructure/persistence/drizzle/migrations/0001_*.sql` con el CREATE TABLE.

- [ ] **Step 3: Aplicar la migración**

```bash
npm run db:migrate
```

Expected: "Migration applied successfully" (o similar). Si falla porque la DB no está corriendo: `docker compose up -d` primero.

- [ ] **Step 4: Commit**

```bash
git add src/infrastructure/persistence/drizzle/schema.ts src/infrastructure/persistence/drizzle/migrations/
git commit -m "feat: add golden_dataset table to schema"
```

---

## Task 2: Domain entity + Application interface

**Files:**
- Create: `src/domain/entities/GoldenDatasetEntry.ts`
- Create: `src/application/interfaces/IGoldenDatasetRepository.ts`

- [ ] **Step 1: Escribir el test que falla primero**

Crear `src/tests/evals/SaveHumanDecision.eval.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { GoldenDatasetEntry } from "../../domain/entities/GoldenDatasetEntry.js";

describe("GoldenDatasetEntry", () => {
  it("construye correctamente y expone sus campos", () => {
    const entry = new GoldenDatasetEntry({
      id: "gd-1",
      sellerId: "seller-1",
      sourceQuestionId: "q-123",
      questionText: "¿Tienen stock?",
      itemSnapshot: { id: "MLB123", title: "Auriculares" },
      llmIntent: "stock",
      humanIntent: "stock",
      llmAnswer: "Sí, tenemos stock disponible.",
      finalAnswer: "Sí, tenemos stock disponible.",
      decision: "approved",
      qualityRating: 5,
      reviewerId: "user-1",
      reasoningNote: null,
    });

    expect(entry.sellerId).toBe("seller-1");
    expect(entry.decision).toBe("approved");
    expect(entry.humanIntent).toBe("stock");
    expect(entry.qualityRating).toBe(5);
    expect(entry.itemSnapshot).toEqual({ id: "MLB123", title: "Auriculares" });
  });

  it("acepta decision 'edited_from_scratch' con humanIntent distinto al llmIntent", () => {
    const entry = new GoldenDatasetEntry({
      id: "gd-2",
      sellerId: "seller-1",
      sourceQuestionId: "q-124",
      questionText: "¿Me hacés precio?",
      itemSnapshot: { id: "MLB124", title: "Teclado" },
      llmIntent: "otro",
      humanIntent: "precio_negociacion",
      llmAnswer: "Los precios son fijos.",
      finalAnswer: "Los precios son fijos según Mercado Libre, pero podés aprovechar las promociones.",
      decision: "edited_from_scratch",
      qualityRating: 4,
      reviewerId: "user-1",
      reasoningNote: "El LLM no detectó la intención de negociación",
    });

    expect(entry.decision).toBe("edited_from_scratch");
    expect(entry.humanIntent).toBe("precio_negociacion");
    expect(entry.llmIntent).toBe("otro");
  });
});
```

- [ ] **Step 2: Correr el test para verificar que falla**

```bash
npm test -- src/tests/evals/SaveHumanDecision.eval.test.ts
```

Expected: FAIL con "Cannot find module '../../domain/entities/GoldenDatasetEntry.js'"

- [ ] **Step 3: Crear la entidad `GoldenDatasetEntry`**

Crear `src/domain/entities/GoldenDatasetEntry.ts`:

```typescript
import { IntentType } from "../value-objects/Intent.js";

export type GoldenDecision = "approved" | "edited" | "edited_from_scratch";

export interface GoldenDatasetEntryProps {
  id: string;
  sellerId: string;
  sourceQuestionId: string;
  questionText: string;
  itemSnapshot: Record<string, unknown>;
  llmIntent: IntentType;
  humanIntent: IntentType;
  llmAnswer: string;
  finalAnswer: string;
  decision: GoldenDecision;
  qualityRating: number | null;
  reviewerId: string | null;
  reasoningNote: string | null;
  createdAt?: Date;
}

export class GoldenDatasetEntry {
  public readonly id: string;
  public readonly sellerId: string;
  public readonly sourceQuestionId: string;
  public readonly questionText: string;
  public readonly itemSnapshot: Record<string, unknown>;
  public readonly llmIntent: IntentType;
  public readonly humanIntent: IntentType;
  public readonly llmAnswer: string;
  public readonly finalAnswer: string;
  public readonly decision: GoldenDecision;
  public readonly qualityRating: number | null;
  public readonly reviewerId: string | null;
  public readonly reasoningNote: string | null;
  public readonly createdAt: Date;

  constructor(props: GoldenDatasetEntryProps) {
    this.id = props.id;
    this.sellerId = props.sellerId;
    this.sourceQuestionId = props.sourceQuestionId;
    this.questionText = props.questionText;
    this.itemSnapshot = props.itemSnapshot;
    this.llmIntent = props.llmIntent;
    this.humanIntent = props.humanIntent;
    this.llmAnswer = props.llmAnswer;
    this.finalAnswer = props.finalAnswer;
    this.decision = props.decision;
    this.qualityRating = props.qualityRating;
    this.reviewerId = props.reviewerId;
    this.reasoningNote = props.reasoningNote;
    this.createdAt = props.createdAt ?? new Date();
  }
}
```

- [ ] **Step 4: Crear la interface del repositorio**

Crear `src/application/interfaces/IGoldenDatasetRepository.ts`:

```typescript
import { GoldenDatasetEntry } from "../../domain/entities/GoldenDatasetEntry.js";
import { IntentType } from "../../domain/value-objects/Intent.js";
import { GoldenDecision } from "../../domain/entities/GoldenDatasetEntry.js";

export interface GoldenDatasetFilters {
  intent?: IntentType;
  decision?: GoldenDecision;
  limit?: number;
  offset?: number;
}

export interface GoldenDatasetMetrics {
  total: number;
  byDecision: Record<GoldenDecision, number>;
  byIntent: Record<string, number>;
  intentMismatchRate: number; // % donde llmIntent !== humanIntent
  avgQualityRating: number | null;
}

export interface IGoldenDatasetRepository {
  save(entry: GoldenDatasetEntry): Promise<void>;
  findBySellerId(sellerId: string, filters?: GoldenDatasetFilters): Promise<GoldenDatasetEntry[]>;
  getMetricsBySellerId(sellerId: string): Promise<GoldenDatasetMetrics>;
}
```

- [ ] **Step 5: Correr los tests para verificar que pasan**

```bash
npm test -- src/tests/evals/SaveHumanDecision.eval.test.ts
```

Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add src/domain/entities/GoldenDatasetEntry.ts src/application/interfaces/IGoldenDatasetRepository.ts src/tests/evals/SaveHumanDecision.eval.test.ts
git commit -m "feat: add GoldenDatasetEntry entity and IGoldenDatasetRepository interface"
```

---

## Task 3: Infrastructure — PostgresGoldenDatasetRepository

**Files:**
- Create: `src/infrastructure/persistence/postgres/PostgresGoldenDatasetRepository.ts`

- [ ] **Step 1: Crear el repositorio**

Crear `src/infrastructure/persistence/postgres/PostgresGoldenDatasetRepository.ts`:

```typescript
import { eq, sql, desc } from "drizzle-orm";
import { DrizzleDB } from "../drizzle/db.js";
import { goldenDataset } from "../drizzle/schema.js";
import { IGoldenDatasetRepository, GoldenDatasetFilters, GoldenDatasetMetrics } from "../../../application/interfaces/IGoldenDatasetRepository.js";
import { GoldenDatasetEntry, GoldenDecision } from "../../../domain/entities/GoldenDatasetEntry.js";
import { IntentType } from "../../../domain/value-objects/Intent.js";

export class PostgresGoldenDatasetRepository implements IGoldenDatasetRepository {
  constructor(private readonly db: DrizzleDB) {}

  public async save(entry: GoldenDatasetEntry): Promise<void> {
    await this.db.insert(goldenDataset).values({
      id: entry.id,
      sellerId: entry.sellerId,
      sourceQuestionId: entry.sourceQuestionId,
      questionText: entry.questionText,
      itemSnapshot: JSON.stringify(entry.itemSnapshot),
      llmIntent: entry.llmIntent,
      humanIntent: entry.humanIntent,
      llmAnswer: entry.llmAnswer,
      finalAnswer: entry.finalAnswer,
      decision: entry.decision,
      qualityRating: entry.qualityRating ?? null,
      reviewerId: entry.reviewerId ?? null,
      reasoningNote: entry.reasoningNote ?? null,
    }).onConflictDoNothing();
  }

  public async findBySellerId(
    sellerId: string,
    filters: GoldenDatasetFilters = {}
  ): Promise<GoldenDatasetEntry[]> {
    const { limit = 100, offset = 0, intent, decision } = filters;

    let query = this.db
      .select()
      .from(goldenDataset)
      .where(eq(goldenDataset.sellerId, sellerId))
      .orderBy(desc(goldenDataset.createdAt))
      .limit(limit)
      .offset(offset);

    const rows = await query;

    return rows
      .filter((r) => (!intent || r.humanIntent === intent) && (!decision || r.decision === decision))
      .map(this.map);
  }

  public async getMetricsBySellerId(sellerId: string): Promise<GoldenDatasetMetrics> {
    const rows = await this.db
      .select()
      .from(goldenDataset)
      .where(eq(goldenDataset.sellerId, sellerId));

    const byDecision: Record<GoldenDecision, number> = {
      approved: 0,
      edited: 0,
      edited_from_scratch: 0,
    };
    const byIntent: Record<string, number> = {};
    let mismatchCount = 0;
    let ratingSum = 0;
    let ratingCount = 0;

    for (const r of rows) {
      byDecision[r.decision as GoldenDecision] = (byDecision[r.decision as GoldenDecision] ?? 0) + 1;
      byIntent[r.humanIntent] = (byIntent[r.humanIntent] ?? 0) + 1;
      if (r.llmIntent !== r.humanIntent) mismatchCount++;
      if (r.qualityRating != null) {
        ratingSum += r.qualityRating;
        ratingCount++;
      }
    }

    return {
      total: rows.length,
      byDecision,
      byIntent,
      intentMismatchRate: rows.length > 0 ? mismatchCount / rows.length : 0,
      avgQualityRating: ratingCount > 0 ? ratingSum / ratingCount : null,
    };
  }

  private map(row: typeof goldenDataset.$inferSelect): GoldenDatasetEntry {
    return new GoldenDatasetEntry({
      id: row.id,
      sellerId: row.sellerId,
      sourceQuestionId: row.sourceQuestionId,
      questionText: row.questionText,
      itemSnapshot: JSON.parse(row.itemSnapshot) as Record<string, unknown>,
      llmIntent: row.llmIntent as IntentType,
      humanIntent: row.humanIntent as IntentType,
      llmAnswer: row.llmAnswer,
      finalAnswer: row.finalAnswer,
      decision: row.decision as GoldenDecision,
      qualityRating: row.qualityRating ?? null,
      reviewerId: row.reviewerId ?? null,
      reasoningNote: row.reasoningNote ?? null,
      createdAt: row.createdAt ?? new Date(),
    });
  }
}
```

- [ ] **Step 2: Correr todos los tests para verificar que no rompiste nada**

```bash
npm test
```

Expected: todos los tests existentes siguen pasando.

- [ ] **Step 3: Commit**

```bash
git add src/infrastructure/persistence/postgres/PostgresGoldenDatasetRepository.ts
git commit -m "feat: add PostgresGoldenDatasetRepository"
```

---

## Task 4: Use Case — SaveHumanDecisionUseCase

**Files:**
- Create: `src/application/use-cases/SaveHumanDecisionUseCase.ts`

- [ ] **Step 1: Agregar los tests del use case a `src/tests/evals/SaveHumanDecision.eval.test.ts`**

Agregar estos tests al archivo existente (mantener los de Task 2, agregar a continuación):

```typescript
import { describe, it, expect, vi } from "vitest";
import { GoldenDatasetEntry } from "../../domain/entities/GoldenDatasetEntry.js";
import { SaveHumanDecisionUseCase } from "../../application/use-cases/SaveHumanDecisionUseCase.js";
import { Question } from "../../domain/entities/Question.js";

// Mock repositorios y casos de uso
function makeQuestion(overrides: Partial<ConstructorParameters<typeof Question>[0]> = {}): Question {
  return new Question({
    id: "q-123",
    sellerId: "seller-1",
    itemId: "MLB123",
    text: "¿Tienen stock?",
    appStatus: "pending_review",
    intent: "stock",
    confidence: 0.6,
    suggestedAnswer: "Sí, tenemos stock.",
    ...overrides,
  });
}

describe("SaveHumanDecisionUseCase", () => {
  const makeRepo = () => ({
    findById: vi.fn(),
    save: vi.fn(),
    findBySellerId: vi.fn(),
  });

  const makeGoldenRepo = () => ({
    save: vi.fn(),
    findBySellerId: vi.fn(),
    getMetricsBySellerId: vi.fn(),
  });

  const makeApproveUseCase = () => ({
    execute: vi.fn().mockResolvedValue(makeQuestion({ appStatus: "approved" })),
  });

  const makeRejectUseCase = () => ({
    execute: vi.fn().mockResolvedValue(makeQuestion({ appStatus: "rejected" })),
  });

  const makeItemCacheRepo = () => ({
    getItem: vi.fn().mockResolvedValue({ id: "MLB123", title: "Auriculares", price: 5000 }),
  });

  it("decision 'approved' guarda en golden dataset con humanIntent del LLM", async () => {
    const questionRepo = makeRepo();
    const question = makeQuestion();
    questionRepo.findById.mockResolvedValue(question);

    const goldenRepo = makeGoldenRepo();
    const approveUseCase = makeApproveUseCase();
    const rejectUseCase = makeRejectUseCase();
    const itemCacheRepo = makeItemCacheRepo();

    const useCase = new SaveHumanDecisionUseCase(
      questionRepo as any,
      goldenRepo as any,
      approveUseCase as any,
      rejectUseCase as any,
      itemCacheRepo as any,
    );

    await useCase.execute({
      questionId: "q-123",
      decision: "approved",
      humanIntent: undefined, // usa el del LLM
      qualityRating: 5,
      reviewerId: "user-1",
      reasoningNote: null,
    });

    expect(approveUseCase.execute).toHaveBeenCalledWith({
      questionId: "q-123",
      customAnswerText: undefined,
    });
    expect(goldenRepo.save).toHaveBeenCalledOnce();
    const savedEntry: GoldenDatasetEntry = goldenRepo.save.mock.calls[0][0];
    expect(savedEntry.decision).toBe("approved");
    expect(savedEntry.humanIntent).toBe("stock"); // tomó el del LLM
    expect(savedEntry.finalAnswer).toBe("Sí, tenemos stock.");
    expect(savedEntry.qualityRating).toBe(5);
  });

  it("decision 'edited' guarda finalAnswer con el texto custom", async () => {
    const questionRepo = makeRepo();
    questionRepo.findById.mockResolvedValue(makeQuestion());
    const goldenRepo = makeGoldenRepo();
    const approveUseCase = makeApproveUseCase();
    const rejectUseCase = makeRejectUseCase();
    const itemCacheRepo = makeItemCacheRepo();

    const useCase = new SaveHumanDecisionUseCase(
      questionRepo as any,
      goldenRepo as any,
      approveUseCase as any,
      rejectUseCase as any,
      itemCacheRepo as any,
    );

    await useCase.execute({
      questionId: "q-123",
      decision: "edited",
      customAnswer: "Sí, tenemos varias unidades disponibles.",
      humanIntent: "stock",
      qualityRating: 4,
      reviewerId: "user-1",
      reasoningNote: null,
    });

    expect(approveUseCase.execute).toHaveBeenCalledWith({
      questionId: "q-123",
      customAnswerText: "Sí, tenemos varias unidades disponibles.",
    });
    const savedEntry: GoldenDatasetEntry = goldenRepo.save.mock.calls[0][0];
    expect(savedEntry.decision).toBe("edited");
    expect(savedEntry.finalAnswer).toBe("Sí, tenemos varias unidades disponibles.");
  });

  it("decision 'rejected' NO guarda en golden dataset y llama a rejectUseCase", async () => {
    const questionRepo = makeRepo();
    questionRepo.findById.mockResolvedValue(makeQuestion());
    const goldenRepo = makeGoldenRepo();
    const approveUseCase = makeApproveUseCase();
    const rejectUseCase = makeRejectUseCase();
    const itemCacheRepo = makeItemCacheRepo();

    const useCase = new SaveHumanDecisionUseCase(
      questionRepo as any,
      goldenRepo as any,
      approveUseCase as any,
      rejectUseCase as any,
      itemCacheRepo as any,
    );

    await useCase.execute({
      questionId: "q-123",
      decision: "rejected",
      reviewerId: "user-1",
    });

    expect(rejectUseCase.execute).toHaveBeenCalledWith("q-123");
    expect(goldenRepo.save).not.toHaveBeenCalled();
  });

  it("decision 'edited_from_scratch' guarda en golden dataset y llama a approveUseCase", async () => {
    const questionRepo = makeRepo();
    questionRepo.findById.mockResolvedValue(makeQuestion());
    const goldenRepo = makeGoldenRepo();
    const approveUseCase = makeApproveUseCase();
    const rejectUseCase = makeRejectUseCase();
    const itemCacheRepo = makeItemCacheRepo();

    const useCase = new SaveHumanDecisionUseCase(
      questionRepo as any,
      goldenRepo as any,
      approveUseCase as any,
      rejectUseCase as any,
      itemCacheRepo as any,
    );

    await useCase.execute({
      questionId: "q-123",
      decision: "edited_from_scratch",
      customAnswer: "Tenemos 3 unidades disponibles para entrega inmediata.",
      humanIntent: "stock",
      qualityRating: 5,
      reviewerId: "user-1",
      reasoningNote: "El LLM generó respuesta vaga",
    });

    expect(approveUseCase.execute).toHaveBeenCalled();
    expect(rejectUseCase.execute).not.toHaveBeenCalled();
    const savedEntry: GoldenDatasetEntry = goldenRepo.save.mock.calls[0][0];
    expect(savedEntry.decision).toBe("edited_from_scratch");
    expect(savedEntry.reasoningNote).toBe("El LLM generó respuesta vaga");
  });

  it("lanza error si la pregunta no existe", async () => {
    const questionRepo = makeRepo();
    questionRepo.findById.mockResolvedValue(null);
    const goldenRepo = makeGoldenRepo();
    const approveUseCase = makeApproveUseCase();
    const rejectUseCase = makeRejectUseCase();
    const itemCacheRepo = makeItemCacheRepo();

    const useCase = new SaveHumanDecisionUseCase(
      questionRepo as any,
      goldenRepo as any,
      approveUseCase as any,
      rejectUseCase as any,
      itemCacheRepo as any,
    );

    await expect(
      useCase.execute({ questionId: "q-999", decision: "approved", reviewerId: "user-1" })
    ).rejects.toThrow("Pregunta no encontrada");
  });
});
```

- [ ] **Step 2: Correr los tests para verificar que fallan**

```bash
npm test -- src/tests/evals/SaveHumanDecision.eval.test.ts
```

Expected: FAIL con "Cannot find module '../../application/use-cases/SaveHumanDecisionUseCase.js'"

- [ ] **Step 3: Implementar el use case**

Crear `src/application/use-cases/SaveHumanDecisionUseCase.ts`:

```typescript
import { randomUUID } from "node:crypto";
import { IQuestionRepository } from "../interfaces/IQuestionRepository.js";
import { IGoldenDatasetRepository } from "../interfaces/IGoldenDatasetRepository.js";
import { IItemCacheRepository } from "../interfaces/IItemCacheRepository.js";
import { ApproveAnswerUseCase } from "./ApproveAnswerUseCase.js";
import { RejectAnswerUseCase } from "./RejectAnswerUseCase.js";
import { GoldenDatasetEntry, GoldenDecision } from "../../domain/entities/GoldenDatasetEntry.js";
import { IntentType } from "../../domain/value-objects/Intent.js";
import { Question } from "../../domain/entities/Question.js";

export type HumanDecision = GoldenDecision | "rejected";

export interface SaveHumanDecisionParams {
  questionId: string;
  decision: HumanDecision;
  customAnswer?: string;
  humanIntent?: IntentType;
  qualityRating?: number;
  reviewerId: string;
  reasoningNote?: string | null;
}

export class SaveHumanDecisionUseCase {
  constructor(
    private readonly questionRepo: IQuestionRepository,
    private readonly goldenRepo: IGoldenDatasetRepository,
    private readonly approveUseCase: ApproveAnswerUseCase,
    private readonly rejectUseCase: RejectAnswerUseCase,
    private readonly itemCacheRepo: IItemCacheRepository,
  ) {}

  public async execute(params: SaveHumanDecisionParams): Promise<Question> {
    const { questionId, decision, customAnswer, humanIntent, qualityRating, reviewerId, reasoningNote } = params;

    const question = await this.questionRepo.findById(questionId);
    if (!question) {
      throw new Error(`Pregunta no encontrada (ID: ${questionId})`);
    }

    if (decision === "rejected") {
      return this.rejectUseCase.execute(questionId);
    }

    // approved | edited | edited_from_scratch → siempre llamamos a approve
    const updatedQuestion = await this.approveUseCase.execute({
      questionId,
      customAnswerText: customAnswer,
    });

    // Congelar el snapshot del ítem
    let itemSnapshot: Record<string, unknown> = { id: question.itemId };
    try {
      const item = await this.itemCacheRepo.getItem(question.itemId);
      if (item) {
        itemSnapshot = { id: item.id, title: item.title, price: item.price } as Record<string, unknown>;
      }
    } catch {
      // Si falla el cache, guardamos con el snapshot mínimo
    }

    const finalAnswer = customAnswer ?? question.suggestedAnswer ?? "";
    const resolvedHumanIntent = humanIntent ?? question.intent ?? "otro";

    const entry = new GoldenDatasetEntry({
      id: randomUUID(),
      sellerId: question.sellerId,
      sourceQuestionId: questionId,
      questionText: question.text,
      itemSnapshot,
      llmIntent: question.intent ?? "otro",
      humanIntent: resolvedHumanIntent,
      llmAnswer: question.suggestedAnswer ?? "",
      finalAnswer,
      decision: decision as GoldenDecision,
      qualityRating: qualityRating ?? null,
      reviewerId,
      reasoningNote: reasoningNote ?? null,
    });

    await this.goldenRepo.save(entry);

    return updatedQuestion;
  }
}
```

- [ ] **Step 4: Correr los tests para verificar que pasan**

```bash
npm test -- src/tests/evals/SaveHumanDecision.eval.test.ts
```

Expected: PASS (7 tests: 2 de Task 2 + 5 nuevos).

- [ ] **Step 5: Commit**

```bash
git add src/application/use-cases/SaveHumanDecisionUseCase.ts src/tests/evals/SaveHumanDecision.eval.test.ts
git commit -m "feat: add SaveHumanDecisionUseCase with golden dataset persistence"
```

---

## Task 5: EvalRunner — evaluador puro para CI/CD

**Files:**
- Create: `src/infrastructure/eval/EvalRunner.ts`
- Create: `src/tests/evals/eval-runner.eval.test.ts`

- [ ] **Step 1: Escribir los tests del EvalRunner**

Crear `src/tests/evals/eval-runner.eval.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { runEval, EvalInput } from "../../infrastructure/eval/EvalRunner.js";
import { GoldenDatasetEntry } from "../../domain/entities/GoldenDatasetEntry.js";

function makeGoldenEntry(overrides: Partial<ConstructorParameters<typeof GoldenDatasetEntry>[0]> = {}): GoldenDatasetEntry {
  return new GoldenDatasetEntry({
    id: "gd-1",
    sellerId: "seller-1",
    sourceQuestionId: "q-1",
    questionText: "¿Tienen stock?",
    itemSnapshot: { id: "MLB1", title: "Auriculares" },
    llmIntent: "stock",
    humanIntent: "stock",
    llmAnswer: "Sí, tenemos stock.",
    finalAnswer: "Sí, tenemos stock.",
    decision: "approved",
    qualityRating: 5,
    reviewerId: "user-1",
    reasoningNote: null,
    ...overrides,
  });
}

describe("EvalRunner", () => {
  it("pasa cuando el intent y la moderación son correctos", () => {
    const inputs: EvalInput[] = [
      {
        entry: makeGoldenEntry(),
        llmOutput: { intent: "stock", answer: "Sí, tenemos stock disponible.", confidence: 0.9 },
      },
    ];
    const result = runEval(inputs);
    expect(result.passed).toBe(1);
    expect(result.failed).toBe(0);
    expect(result.failures).toHaveLength(0);
  });

  it("falla cuando el intent del LLM no coincide con el humanIntent del golden", () => {
    const inputs: EvalInput[] = [
      {
        entry: makeGoldenEntry({ humanIntent: "stock" }),
        llmOutput: { intent: "envio", answer: "Sí, tenemos stock.", confidence: 0.8 },
      },
    ];
    const result = runEval(inputs);
    expect(result.failed).toBe(1);
    expect(result.failures[0].reason).toContain("intent");
    expect(result.failures[0].expected).toBe("stock");
    expect(result.failures[0].got).toBe("envio");
  });

  it("falla cuando la respuesta del LLM no pasa moderación (número de teléfono)", () => {
    const inputs: EvalInput[] = [
      {
        entry: makeGoldenEntry(),
        llmOutput: { intent: "stock", answer: "Llamanos al 011-4567-8901.", confidence: 0.9 },
      },
    ];
    const result = runEval(inputs);
    expect(result.failed).toBe(1);
    expect(result.failures[0].reason).toContain("moderación");
  });

  it("falla cuando la respuesta del LLM menciona WhatsApp", () => {
    const inputs: EvalInput[] = [
      {
        entry: makeGoldenEntry(),
        llmOutput: { intent: "stock", answer: "Escribinos al WhatsApp.", confidence: 0.8 },
      },
    ];
    const result = runEval(inputs);
    expect(result.failed).toBe(1);
    expect(result.failures[0].reason).toContain("moderación");
  });

  it("procesa múltiples entradas y acumula resultados correctamente", () => {
    const inputs: EvalInput[] = [
      {
        entry: makeGoldenEntry({ id: "gd-1", humanIntent: "stock" }),
        llmOutput: { intent: "stock", answer: "Sí hay stock.", confidence: 0.9 },
      },
      {
        entry: makeGoldenEntry({ id: "gd-2", humanIntent: "envio" }),
        llmOutput: { intent: "stock", answer: "Enviamos en 24hs.", confidence: 0.7 }, // intent incorrecto
      },
      {
        entry: makeGoldenEntry({ id: "gd-3", humanIntent: "garantia" }),
        llmOutput: { intent: "garantia", answer: "Tiene 1 año de garantía oficial.", confidence: 0.95 },
      },
    ];
    const result = runEval(inputs);
    expect(result.totalEntries).toBe(3);
    expect(result.passed).toBe(2);
    expect(result.failed).toBe(1);
  });

  it("retorna failureRate correcto", () => {
    const inputs: EvalInput[] = [
      {
        entry: makeGoldenEntry({ id: "gd-1", humanIntent: "stock" }),
        llmOutput: { intent: "envio", answer: "ok", confidence: 0.9 },
      },
      {
        entry: makeGoldenEntry({ id: "gd-2" }),
        llmOutput: { intent: "stock", answer: "ok", confidence: 0.9 },
      },
    ];
    const result = runEval(inputs);
    expect(result.failureRate).toBe(0.5);
  });
});
```

- [ ] **Step 2: Correr los tests para verificar que fallan**

```bash
npm test -- src/tests/evals/eval-runner.eval.test.ts
```

Expected: FAIL con "Cannot find module '../../infrastructure/eval/EvalRunner.js'"

- [ ] **Step 3: Implementar el EvalRunner**

Crear `src/infrastructure/eval/EvalRunner.ts`:

```typescript
import { GoldenDatasetEntry } from "../../domain/entities/GoldenDatasetEntry.js";
import { ModerationService } from "../../domain/services/ModerationService.js";
import { IntentType } from "../../domain/value-objects/Intent.js";

export interface EvalInput {
  entry: GoldenDatasetEntry;
  llmOutput: {
    intent: IntentType;
    answer: string;
    confidence: number;
  };
}

export interface EvalFailure {
  questionText: string;
  reason: string;
  expected: string;
  got: string;
}

export interface EvalResult {
  totalEntries: number;
  passed: number;
  failed: number;
  failureRate: number;
  failures: EvalFailure[];
}

export function runEval(inputs: EvalInput[]): EvalResult {
  const failures: EvalFailure[] = [];

  for (const { entry, llmOutput } of inputs) {
    // Check 1: intent match
    if (llmOutput.intent !== entry.humanIntent) {
      failures.push({
        questionText: entry.questionText,
        reason: `intent incorrecto`,
        expected: entry.humanIntent,
        got: llmOutput.intent,
      });
      continue; // una sola falla por entrada es suficiente
    }

    // Check 2: moderation
    const modResult = ModerationService.moderate(llmOutput.answer);
    if (modResult.blocked) {
      failures.push({
        questionText: entry.questionText,
        reason: `moderación bloqueada: ${modResult.reason}`,
        expected: "respuesta sin contenido bloqueado",
        got: llmOutput.answer.slice(0, 100),
      });
    }
  }

  const passed = inputs.length - failures.length;
  return {
    totalEntries: inputs.length,
    passed,
    failed: failures.length,
    failureRate: inputs.length > 0 ? failures.length / inputs.length : 0,
    failures,
  };
}
```

- [ ] **Step 4: Correr los tests para verificar que pasan**

```bash
npm test -- src/tests/evals/eval-runner.eval.test.ts
```

Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/infrastructure/eval/EvalRunner.ts src/tests/evals/eval-runner.eval.test.ts
git commit -m "feat: add EvalRunner for CI/CD golden dataset evaluation"
```

---

## Task 6: Tests de moderación formalizados como evals

**Files:**
- Create: `src/tests/evals/moderation.eval.test.ts`

- [ ] **Step 1: Crear los tests**

Crear `src/tests/evals/moderation.eval.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { ModerationService } from "../../domain/services/ModerationService.js";

describe("ModerationService — eval suite (regresión)", () => {
  describe("bloquea contenido prohibido", () => {
    it("bloquea número de teléfono con guiones", () => {
      const result = ModerationService.moderate("Llamanos al 011-4567-8901 para más info.");
      expect(result.blocked).toBe(true);
      expect(result.matchedRule).toBe("phone_digits");
    });

    it("bloquea número de teléfono con espacios", () => {
      const result = ModerationService.moderate("Contactanos al 15 3456 7890.");
      expect(result.blocked).toBe(true);
    });

    it("bloquea WhatsApp explícito", () => {
      const result = ModerationService.moderate("Escribinos al WhatsApp.");
      expect(result.blocked).toBe(true);
      expect(result.matchedRule).toBe("whatsapp_keywords");
    });

    it("bloquea WhatsApp camuflado como 'wsp'", () => {
      const result = ModerationService.moderate("Mandanos un wsp.");
      expect(result.blocked).toBe(true);
    });

    it("bloquea WhatsApp camuflado como 'wasap'", () => {
      const result = ModerationService.moderate("Contactanos por wasap.");
      expect(result.blocked).toBe(true);
    });

    it("bloquea email", () => {
      const result = ModerationService.moderate("Escribinos a ventas@tienda.com");
      expect(result.blocked).toBe(true);
      expect(result.matchedRule).toBe("email");
    });

    it("bloquea URL con http", () => {
      const result = ModerationService.moderate("Más info en http://mi-tienda.com");
      expect(result.blocked).toBe(true);
      expect(result.matchedRule).toBe("urls");
    });

    it("bloquea URL con www", () => {
      const result = ModerationService.moderate("Visitá www.mitienda.com.ar");
      expect(result.blocked).toBe(true);
    });

    it("bloquea mención de Instagram con usuario", () => {
      const result = ModerationService.moderate("Seguinos en instagram: @mitienda");
      expect(result.blocked).toBe(true);
      expect(result.matchedRule).toBe("social_media");
    });

    it("bloquea pago fuera de plataforma", () => {
      const result = ModerationService.moderate("Podemos coordinar un pago por afuera.");
      expect(result.blocked).toBe(true);
    });
  });

  describe("permite respuestas normales", () => {
    it("permite respuesta de stock sin datos de contacto", () => {
      const result = ModerationService.moderate("Sí, tenemos stock disponible para entrega inmediata.");
      expect(result.blocked).toBe(false);
    });

    it("permite respuesta de envío", () => {
      const result = ModerationService.moderate("Enviamos por Mercado Envíos a todo el país. El plazo es de 3 a 5 días hábiles.");
      expect(result.blocked).toBe(false);
    });

    it("permite respuesta de garantía", () => {
      const result = ModerationService.moderate("El producto tiene 1 año de garantía oficial del fabricante.");
      expect(result.blocked).toBe(false);
    });

    it("permite respuesta de precio sin negociación fuera de plataforma", () => {
      const result = ModerationService.moderate("El precio es el publicado en Mercado Libre. No hay descuentos adicionales.");
      expect(result.blocked).toBe(false);
    });

    it("no bloquea la palabra 'once' usada como número en contexto no telefónico", () => {
      const result = ModerationService.moderate("Tenemos once colores disponibles.");
      expect(result.blocked).toBe(false);
    });
  });
});
```

- [ ] **Step 2: Correr los tests para verificar que pasan (sin cambiar nada)**

```bash
npm test -- src/tests/evals/moderation.eval.test.ts
```

Expected: PASS (15 tests). Estos son 100% determinísticos — si alguno falla, es una regresión real en `ModerationService`.

- [ ] **Step 3: Commit**

```bash
git add src/tests/evals/moderation.eval.test.ts
git commit -m "feat: add moderation eval suite for CI regression testing"
```

---

## Task 7: Controller + Routes

**Files:**
- Modify: `src/presentation/controllers/QuestionsController.ts`
- Modify: `src/app.ts`

- [ ] **Step 1: Agregar el endpoint `humanDecision` al `QuestionsController`**

En `src/presentation/controllers/QuestionsController.ts`, agregar el import y el parámetro en el constructor:

```typescript
// Agregar en los imports al inicio del archivo (después de los imports existentes):
import { SaveHumanDecisionUseCase } from "../../application/use-cases/SaveHumanDecisionUseCase.js";
import { IGoldenDatasetRepository } from "../../application/interfaces/IGoldenDatasetRepository.js";
```

Modificar la clase `QuestionsController` para aceptar los nuevos parámetros:

```typescript
export class QuestionsController {
  constructor(
    private readonly questionRepo: IQuestionRepository,
    private readonly approveUseCase: ApproveAnswerUseCase,
    private readonly rejectUseCase: RejectAnswerUseCase,
    private readonly itemCacheRepo?: IItemCacheRepository,
    private readonly saveHumanDecisionUseCase?: SaveHumanDecisionUseCase,
    private readonly goldenDatasetRepo?: IGoldenDatasetRepository,
  ) {}
```

Agregar los métodos nuevos al final de la clase (antes del `}`):

```typescript
  public humanDecision = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user;
    const { id } = request.params as { id: string };
    const body = (request.body as {
      decision: "approved" | "edited" | "edited_from_scratch" | "rejected";
      customAnswer?: string;
      humanIntent?: string;
      qualityRating?: number;
      reasoningNote?: string;
    }) || {};

    if (!body.decision) {
      return reply.status(400).send({ error: "El campo 'decision' es requerido." });
    }

    const validDecisions = ["approved", "edited", "edited_from_scratch", "rejected"];
    if (!validDecisions.includes(body.decision)) {
      return reply.status(400).send({ error: `'decision' debe ser uno de: ${validDecisions.join(", ")}` });
    }

    const question = await this.questionRepo.findById(id);
    if (!question) {
      return reply.status(404).send({ error: "Pregunta no encontrada." });
    }

    if (user?.role === "tenant" && user?.sellerId && question.sellerId !== user.sellerId) {
      return reply.status(403).send({ error: "No tenés permisos para modificar preguntas de otro vendedor." });
    }

    if (!this.saveHumanDecisionUseCase) {
      return reply.status(501).send({ error: "SaveHumanDecisionUseCase no está configurado." });
    }

    try {
      const updatedQuestion = await this.saveHumanDecisionUseCase.execute({
        questionId: id,
        decision: body.decision,
        customAnswer: body.customAnswer,
        humanIntent: body.humanIntent as any,
        qualityRating: body.qualityRating,
        reviewerId: user?.id ?? "unknown",
        reasoningNote: body.reasoningNote ?? null,
      });
      return reply.send(updatedQuestion);
    } catch (err: any) {
      return reply.status(422).send({ error: err.message });
    }
  };

  public getGoldenDataset = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user;
    const { sellerId } = request.params as { sellerId: string };
    const query = (request.query as any) || {};

    // Solo superadmin puede acceder al golden dataset
    if (user?.role !== "super_admin") {
      return reply.status(403).send({ error: "Acceso denegado: se requieren permisos de Super Administrador." });
    }

    if (!this.goldenDatasetRepo) {
      return reply.status(501).send({ error: "GoldenDatasetRepository no está configurado." });
    }

    const entries = await this.goldenDatasetRepo.findBySellerId(sellerId, {
      intent: query.intent,
      decision: query.decision,
      limit: Number(query.limit) || 100,
      offset: Number(query.offset) || 0,
    });

    return reply.send({ ok: true, total: entries.length, entries });
  };

  public getGoldenDatasetMetrics = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user;
    const { sellerId } = request.params as { sellerId: string };

    if (user?.role !== "super_admin") {
      return reply.status(403).send({ error: "Acceso denegado: se requieren permisos de Super Administrador." });
    }

    if (!this.goldenDatasetRepo) {
      return reply.status(501).send({ error: "GoldenDatasetRepository no está configurado." });
    }

    const metrics = await this.goldenDatasetRepo.getMetricsBySellerId(sellerId);
    return reply.send({ ok: true, sellerId, metrics });
  };
```

- [ ] **Step 2: Cablear en `src/app.ts`**

En `src/app.ts`, agregar los imports nuevos junto al bloque de imports existentes:

```typescript
import { PostgresGoldenDatasetRepository } from "./infrastructure/persistence/postgres/PostgresGoldenDatasetRepository.js";
import { SaveHumanDecisionUseCase } from "./application/use-cases/SaveHumanDecisionUseCase.js";
```

Agregar la instanciación después de `const llmUsageRepo = ...` (sección "2. Persistencia"):

```typescript
const goldenDatasetRepo = new PostgresGoldenDatasetRepository(db);
```

Agregar el use case después de `const rejectAnswerUseCase = ...` (sección "5. Casos de Uso Core"):

```typescript
const saveHumanDecisionUseCase = new SaveHumanDecisionUseCase(
  questionRepo,
  goldenDatasetRepo,
  approveAnswerUseCase,
  rejectAnswerUseCase,
  itemCacheRepo,
);
```

Modificar la instanciación de `questionsCtrl` (línea donde dice `new QuestionsController(...)`) para incluir los nuevos parámetros:

```typescript
const questionsCtrl = new QuestionsController(
  questionRepo,
  approveAnswerUseCase,
  rejectAnswerUseCase,
  itemCacheRepo,
  saveHumanDecisionUseCase,
  goldenDatasetRepo,
);
```

Agregar las nuevas rutas en la sección "Rutas — Questions & Actions":

```typescript
app.post("/api/questions/:id/human-decision", { preHandler: authenticate }, questionsCtrl.humanDecision);
app.get("/api/admin/tenants/:sellerId/golden-dataset", { preHandler: requireSuperAdmin }, questionsCtrl.getGoldenDataset);
app.get("/api/admin/tenants/:sellerId/golden-dataset/metrics", { preHandler: requireSuperAdmin }, questionsCtrl.getGoldenDatasetMetrics);
```

- [ ] **Step 3: Correr todos los tests**

```bash
npm test
```

Expected: PASS en todos los tests (incluyendo los nuevos de evals/).

- [ ] **Step 4: Arrancar el servidor para verificar que compila**

```bash
npm run dev
```

Expected: el servidor arranca sin errores de TypeScript en `stderr`. Verificar en otro terminal:

```bash
curl http://localhost:3000/api/health
```

Expected: `{"ok":true}` (o el health check que tenga el proyecto).

- [ ] **Step 5: Commit final**

```bash
git add src/presentation/controllers/QuestionsController.ts src/app.ts
git commit -m "feat: wire SaveHumanDecisionUseCase and golden dataset endpoints"
```

---

## Resumen de endpoints nuevos

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| `POST` | `/api/questions/:id/human-decision` | tenant / superadmin | Registra decisión humana + guarda en golden dataset |
| `GET` | `/api/admin/tenants/:sellerId/golden-dataset` | superadmin | Lista golden dataset con filtros |
| `GET` | `/api/admin/tenants/:sellerId/golden-dataset/metrics` | superadmin | Métricas del golden dataset |

### Body de `POST /api/questions/:id/human-decision`

```json
{
  "decision": "approved | edited | edited_from_scratch | rejected",
  "customAnswer": "Texto de la respuesta (requerido para edited y edited_from_scratch)",
  "humanIntent": "stock | envio | caracteristicas | garantia | facturacion | precio_negociacion | reclamo | contacto_externo | otro",
  "qualityRating": 5,
  "reasoningNote": "El LLM generó una respuesta vaga"
}
```

---

## Evals en CI/CD (GitHub Actions)

Los tests en `src/tests/evals/` se corren con `npm test` (Vitest). No requieren LLM, DB, ni API keys — son 100% determinísticos.

Para agregar al workflow de GitHub Actions existente, agregar en el step de tests:

```yaml
- name: Run tests (includes eval suite)
  run: npm test
```

Los archivos `*.eval.test.ts` en `src/tests/evals/` son los que detectan regresiones:
- `moderation.eval.test.ts` → si una regla de moderación se rompe, falla
- `eval-runner.eval.test.ts` → si la lógica del evaluador cambia, falla
- `SaveHumanDecision.eval.test.ts` → si el flujo de decisión humana cambia, falla
