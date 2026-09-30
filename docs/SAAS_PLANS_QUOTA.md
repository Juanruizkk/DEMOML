# SaaS Plans & Quota Enforcement

**Implementado:** 2026-09-17/18  
**Plan original:** `docs/superpowers/plans/2026-09-17-saas-plans-quota.md`

---

## Objetivo

Convertir el sistema multi-tenant en un producto SaaS con 3 planes pagos (Starter / Pro / Business), enforceando cuotas de respuestas LLM mensuales, feature gating por plan, notificaciones de advertencia al 80%, y un grace period de 12 horas antes de pausar el bot.

---

## Planes y límites

| Plan | Respuestas LLM/mes | Reclamos | WhatsApp |
|------|--------------------|----------|----------|
| Starter | 300 | ❌ | ❌ |
| Pro | 1.000 | ✅ | ❌ |
| Business | 5.000 | ✅ | ✅ |
| Enterprise | Ilimitado (999.999.999) | ✅ | ✅ |

---

## Arquitectura

### Campos nuevos en `TenantSettings`

```typescript
monthlyLLMLimit: number          // límite mensual del plan
llmResponsesThisMonth: number    // contador del ciclo actual
llmQuotaExhaustedAt: string | null  // timestamp del agotamiento
billingStatus: "active" | "overdue" | "cancelled"
nextBillingDate: string          // ISO date próximo vencimiento
```

### Métodos nuevos en `Tenant`

| Método | Qué hace |
|--------|----------|
| `incrementLLMResponses()` | Suma 1 al contador; setea `llmQuotaExhaustedAt` la primera vez que cruza el límite |
| `isLLMQuotaAtWarning()` | `true` si >= 80% del límite y todavía no agotado |
| `canAutoAnswer()` | `false` si billing != active, o si agotado por más de 12h |
| `canAccessClaims()` | Delega a `PLAN_LIMITS[planId].claimsEnabled` |
| `canAccessWhatsApp()` | Delega a `PLAN_LIMITS[planId].whatsappEnabled` |

### Flujo de enforcement

```
Webhook pregunta/mensaje entrante
  → ProcessQuestionUseCase / ProcessOrderMessageUseCase
      ├── tenant.canAutoAnswer() == false?
      │     → marcar pending_review + log quota_exceeded + return
      └── LLM call
            → tenant.incrementLLMResponses()
            → tenantRepo.save(tenant)
            → isLLMQuotaAtWarning() cruzado? → log quota_warning
            → llmQuotaExhaustedAt seteado por primera vez? → log quota_exhausted
```

```
Webhook reclamo entrante
  → IngestClaimWebhookUseCase
      ├── tenant.canAccessClaims() == false?
      │     → log claims_plan_blocked + return { queued: false }
      └── processClaimUseCase.execute() (fire-and-forget)
```

### Grace period

Durante las 12 horas siguientes al agotamiento de la cuota, el bot **sigue respondiendo** (grace period). Pasadas las 12h, `canAutoAnswer()` devuelve `false` y todas las preguntas/mensajes se marcan como `pending_review`.

El grace period está definido como constante en `Tenant.ts`:
```typescript
const QUOTA_GRACE_PERIOD_MS = 12 * 60 * 60 * 1000;
```

---

## Archivos modificados

| Acción | Archivo |
|--------|---------|
| Modify | `src/domain/entities/Tenant.ts` |
| Modify | `src/application/use-cases/questions/ProcessQuestionUseCase.ts` |
| Modify | `src/application/use-cases/order-messages/ProcessOrderMessageUseCase.ts` |
| Modify | `src/application/use-cases/claims/IngestClaimWebhookUseCase.ts` |
| Create | `src/application/use-cases/admin/UpdateTenantPlanUseCase.ts` |
| Modify | `src/presentation/controllers/AdminController.ts` |
| Modify | `src/presentation/routes/adminRoutes.ts` |
| Modify | `src/infrastructure/persistence/drizzle/schema.ts` |
| Create | `src/infrastructure/persistence/drizzle/migrations/0003_superb_slipstream.sql` |
| Modify | `src/infrastructure/persistence/postgres/PostgresTenantRepository.ts` |
| Modify | `src/composition/container.ts` |
| Modify | `client/src/pages/AdminPage.tsx` |
| Create | `tests/domain/Tenant.saas.test.ts` |
| Create | `tests/admin/UpdateTenantPlanUseCase.test.ts` |
| Modify | `tests/application/ProcessQuestionUseCase.test.ts` |

---

## Endpoint nuevo

```
PUT /api/admin/tenants/:sellerId/plan
Auth: requireSuperAdmin
Body: { planId, billingStatus, nextBillingDate }
Response: { sellerId, planId, monthlyLLMLimit, billingStatus, nextBillingDate }
```

Cuando el plan se actualiza a uno con mayor límite (`isUpgrade`), se limpia `llmQuotaExhaustedAt` para que el bot retome automáticamente.

---

## Columnas DB nuevas

Tabla `tenants`:
```sql
billing_status   TEXT DEFAULT 'active'
next_billing_date TIMESTAMP
```

Migración: `0003_superb_slipstream.sql` (aplicada).

---

## Admin UI

En `AdminPage.tsx`, sección **Plan & Facturación** dentro del panel de detalle de tenant:
- Selector de plan (Starter / Pro / Business / Enterprise)
- Selector de estado de facturación (Activo / Vencido / Cancelado)
- Input de fecha de próximo vencimiento
- Contador de respuestas IA usadas este mes (con % y advertencia amber al 80%)

---

## Tests

- `tests/domain/Tenant.saas.test.ts` — 26 tests (PLAN_LIMITS, incrementLLMResponses, isLLMQuotaAtWarning, canAutoAnswer, canAccessClaims, canAccessWhatsApp, createDefault)
- `tests/admin/UpdateTenantPlanUseCase.test.ts` — 4 tests
- `tests/application/ProcessQuestionUseCase.test.ts` — +2 tests de quota enforcement

**Total suite:** 218/218 pasando.

---

## Decisiones de diseño

- **No usar `Infinity`** en PLAN_LIMITS — `JSON.stringify(Infinity) === null`, rompería la DB. Se usa `999_999_999` para enterprise.
- **Eventos de una sola vez** — `quota_warning` y `quota_exhausted` se logean solo al cruzar el umbral (patrón `wasAtWarning` / `wasExhausted` capturados antes del increment).
- **`monthlyLLMLimit` redundante** — es una copia de `PLAN_LIMITS[planId]` guardada en settings, mantenida en sync por `UpdateTenantPlanUseCase`. Permite consultas futuras sin joins.
- **Claims gate en el webhook** — se filtra en `IngestClaimWebhookUseCase` (entry point) para no desperdiciar llamadas a MELI. Si el tenant no se encuentra, el procesamiento continúa (no bloquea).

---

## Follow-ups pendientes

- [ ] Tests para `IngestClaimWebhookUseCase` plan gate (ramas: bloqueado / tenant null / permitido)
- [ ] Tests para quota short-circuit en `ProcessOrderMessageUseCase`
