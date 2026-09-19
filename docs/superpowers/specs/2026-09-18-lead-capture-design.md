# Lead Capture Form & CRM

**Date:** 2026-09-18  
**Author:** Juan Ruiz  
**Status:** Approved

---

## Overview

Add a lead capture form to the LandingPage and a leads management view in AdminPage. Leads are stored in the DB and trigger an email notification to the admin. The goal is to qualify inbound interest before the manual onboarding process (Telegram + WhatsApp setup).

---

## Data Model

New table `leads` in PostgreSQL via Drizzle schema:

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | auto-generated |
| `name` | text NOT NULL | |
| `email` | text NOT NULL | |
| `phone` | text NOT NULL | WhatsApp number |
| `mlStore` | text NOT NULL | store name or ML link |
| `weeklyQuestions` | text NOT NULL | `'<10' \| '10-50' \| '50-200' \| '200+'` |
| `qualified` | boolean NOT NULL | `weeklyQuestions !== '<10'` |
| `status` | text NOT NULL | `'nuevo' \| 'contactado' \| 'convertido' \| 'descartado'` default `'nuevo'` |
| `createdAt` | timestamp NOT NULL | server-set on insert |

No foreign keys — leads are independent of tenants until manually converted.

---

## Backend Architecture

### Domain

**`src/domain/entities/Lead.ts`**  
Plain entity class. Constructor accepts all fields. No framework dependencies.

**`src/domain/repositories/ILeadRepository.ts`**  
Interface with:
- `save(lead: Lead): Promise<void>`
- `findAll(): Promise<Lead[]>`
- `findById(id: string): Promise<Lead | null>`
- `updateStatus(id: string, status: LeadStatus): Promise<void>`

### Application — Use Cases

**`CreateLeadUseCase`** (`src/application/use-cases/leads/`)
- Input: `{ name, email, phone, mlStore, weeklyQuestions }`
- Computes `qualified = weeklyQuestions !== '<10'`
- Creates `Lead` entity with `status: 'nuevo'`
- Saves via `ILeadRepository`
- If `qualified`, calls `ResendEmailClient.sendNewLeadAlert(lead)`
- Returns `{ id, qualified }`

**`UpdateLeadStatusUseCase`** (`src/application/use-cases/leads/`)
- Input: `{ id, status: LeadStatus }`
- Finds lead by id, throws if not found
- Calls `ILeadRepository.updateStatus(id, status)`
- Returns `{ id, status }`

**`ListLeadsUseCase`** (`src/application/use-cases/leads/`)
- No input
- Returns `Lead[]` sorted by `createdAt` desc

### Infrastructure

**`DrizzleLeadRepository`** (`src/infrastructure/persistence/drizzle/`)  
Implements `ILeadRepository` using Drizzle ORM against the `leads` table.

**`ResendEmailClient`** — add `sendNewLeadAlert(lead: Lead)`  
HTML email to admin with all lead fields. Subject: `"Nuevo lead: {name} — {weeklyQuestions} preg/sem"`.

### HTTP Layer

**Routes:**
- `POST /api/leads` — public, no auth. Body: CreateLeadDTO. Returns `{ id, qualified }`.
- `PATCH /api/leads/:id/status` — protected, `super_admin` only. Body: `{ status }`.
- `GET /api/leads` — protected, `super_admin` only. Returns lead list.

**`LeadController`** handles all three, injected with the three use cases.

---

## Frontend

### LandingPage — `#form` section

New section added at the bottom of `LandingPage.tsx`, just before the footer, with `id="form"`.

**Fields:**
1. Nombre completo (text input)
2. Email (email input)
3. Teléfono / WhatsApp (tel input)
4. Nombre o link de tu tienda en ML (text input)
5. Preguntas por semana (select: `<10` / `10-50` / `50-200` / `200+`)

**Behavior:**
- Submit → POST `/api/leads`
- If `qualified === false` (backend or preemptive check on `<10`): show inline disqualification message — "Tu tienda todavía no genera el volumen mínimo para aprovechar el bot, pero podés empezar cuando quieras →" with link to `/login?register=true`. Form is NOT replaced, visitor stays on page.
- If `qualified === true`: replace form with success message — "Perfecto, te contactamos en menos de 24hs por WhatsApp."
- Button shows loading state during POST.

**Styles:** new section in `LandingPage.css` (or existing landing styles file).

### AdminPage — Leads tab

New tab `"Leads"` added to the existing tab bar in `AdminPage.tsx`.

**Table columns:** Nombre · Email · Teléfono · Tienda ML · Preg/sem · Calificado · Estado · Fecha

- **Calificado**: green badge "Sí" / red badge "No"
- **Estado**: `<select>` inline — `nuevo / contactado / convertido / descartado`. On change fires PATCH `/api/leads/:id/status` immediately.
- **Filter**: dropdown above table to filter by status.
- Sorted by `createdAt` desc.

---

## Email Notification

Triggered only for qualified leads. HTML template (inline, same pattern as existing emails in `ResendEmailClient.ts`):

```
Subject: Nuevo lead: {name} — {weeklyQuestions} preg/sem

Nombre:   {name}
Email:    {email}
Teléfono: {phone}
Tienda:   {mlStore}
Preg/sem: {weeklyQuestions}

Ver en panel → /admin (Leads tab)
```

---

## Pre-qualification Logic

Single rule: `weeklyQuestions === '<10'` → `qualified = false`.

This maps naturally to the existing plan structure:
- `10-50` → Starter territory
- `50-200` → Pro territory  
- `200+` → Business territory

No complex scoring. The status flow handles the rest manually.

---

## Lead Status Flow

```
nuevo → contactado → convertido
             ↓
         descartado
```

All transitions are manual (admin updates via AdminPage select). No automated transitions.

---

## Files to Create / Modify

**New files:**
- `src/domain/entities/Lead.ts`
- `src/domain/repositories/ILeadRepository.ts`
- `src/application/use-cases/leads/CreateLeadUseCase.ts`
- `src/application/use-cases/leads/UpdateLeadStatusUseCase.ts`
- `src/application/use-cases/leads/ListLeadsUseCase.ts`
- `src/application/dtos/LeadDTOs.ts`
- `src/infrastructure/persistence/drizzle/DrizzleLeadRepository.ts`
- `src/interfaces/http/controllers/LeadController.ts`
- `src/interfaces/http/routes/leadRoutes.ts`

**Modified files:**
- `src/infrastructure/persistence/drizzle/schema.ts` — add `leads` table
- `src/infrastructure/email/ResendEmailClient.ts` — add `sendNewLeadAlert`
- `src/interfaces/http/server.ts` (or equivalent) — register lead routes
- `client/src/pages/LandingPage.tsx` — add `#form` section
- `client/src/pages/LandingPage.css` — add form styles
- `client/src/pages/AdminPage.tsx` — add Leads tab
