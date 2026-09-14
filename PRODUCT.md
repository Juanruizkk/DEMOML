# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

React 19 + Vite + React Router 7 + TypeScript (client). Fastify + TypeScript + SQLite (API). Monorepo: `client/` (SPA) + `src/` (API).

## Users

**Tenant (primary):** MercadoLibre seller managing their store. Uses the app daily to handle buyer questions (auto-answered by AI) and post-sale claims. Works from desktop, needs fast scanning of pending items and urgency signals.

**Super Admin (internal):** Platform operator managing all tenants — activates accounts, configures permissions, monitors platform health. Occasional use, needs overview and control.

**Demo:** Sales prospect exploring the product in a guided presentation. Needs to see value quickly with no friction.

## Product Purpose

AI assistant for MercadoLibre sellers that automatically answers buyer questions with high confidence, surfaces low-confidence ones for human review, and manages post-sale claims with urgency timers. Reduces seller response time from hours to seconds and prevents SLA breaches on claims.

## Positioning

The only MercadoLibre-native AI assistant that combines auto-answer (pre-sale) and claim SLA management (post-sale) in a single dashboard, with multi-channel alerts (WhatsApp + Telegram) and super-admin multi-tenant control.

## Operating Context

- Sellers check the dashboard frequently throughout the day (mobile + desktop)
- Claims have hard SLA deadlines (hours); urgency is the dominant signal
- Questions arrive in bursts; the AI resolves most, flagging ~25% for review
- Super admin checks in occasionally for tenant health and permission management
- Demo mode used in live sales calls — needs instant "wow" with seeded data

## Capabilities and Constraints

- Auto-answer engine with confidence threshold per tenant
- Manual approve/reject per question
- Claim SLA tracker with urgency levels (critical / warning / safe)
- Multi-channel alerts: WhatsApp + Telegram (email reserved for future)
- Super admin: tenant list, metrics, toggle features, set granular permissions
  - Permissions: whatsappEnabled, telegramEnabled, emailEnabled, preSaleEnabled, postSaleEnabled
- MercadoLibre OAuth for token management
- Roles: super_admin | tenant | demo
- No logo or brand name confirmed — name and mark to be established in design

## Brand Commitments

None established. Name and visual identity to be created as part of this design round.

## Evidence on Hand

- Working API with real MercadoLibre data flow
- Existing dark UI (deep navy #080c14, Inter font, emerald/amber/indigo/rose accents)
- 68 passing tests

## Product Principles

1. **Urgency first** — the most time-sensitive item must be impossible to miss at a glance
2. **Trust the AI, own the exceptions** — auto-handled items recede; human-needed items surface
3. **Calm power** — depth and motion signal capability without creating noise or distraction
