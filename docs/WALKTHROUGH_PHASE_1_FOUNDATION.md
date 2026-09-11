# Walkthrough: Fase 1 — Cimientos con Clean Architecture (TypeScript + Fastify)

En esta fase se migró el MVP original en JavaScript/Express hacia una arquitectura desacoplada, orientada a producción y con tipado estricto en TypeScript.

---

## 🎯 Objetivos Cumplidos

1. **Creación de la rama base**: `refactor/clean-architecture-foundation`.
2. **Setup de TypeScript y Fastify**:
   - `tsconfig.json` con target ES2022 y resolución NodeNext.
   - Scripts de desarrollo (`tsx watch src/server.ts`), testing (`vitest`) y build (`tsc`).
3. **Capa de Dominio**:
   - Entidades: `Tenant`, `Question`, `Item`, `EventLog`.
   - Value Objects: `Intent` y `ModerationResult`.
   - `ModerationService`: blindaje determinístico contra sanciones de Mercado Libre.
4. **Capa de Aplicación**:
   - Interfaces desacopladas para repositorios, clientes externos y colas.
   - Casos de uso: `IngestWebhookUseCase`, `ProcessQuestionUseCase`, `ApproveAnswerUseCase`, `RejectAnswerUseCase`, `SimulateQuestionUseCase`.
5. **Capa de Infraestructura**:
   - `SqliteDatabase` con schema relacional particionado por `seller_id`.
   - `MeliApiClient` con mutex de tokens para evitar race conditions en el refresco OAuth.
   - `LangChainLLMService` con Structured Output (Zod) y soporte para Groq, Anthropic y OpenAI.
   - `InMemoryQueueBroker` con concurrencia controlada (5 workers simultáneos).
   - `FastifySseNotifier` con canales aislados por tienda.
6. **Tests Automatizados**:
   - Pruebas unitarias de moderación y del pipeline de procesamiento.
