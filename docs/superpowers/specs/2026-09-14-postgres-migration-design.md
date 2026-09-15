# Migración SQLite → PostgreSQL con Drizzle ORM

**Fecha:** 2026-09-14  
**Estado:** Aprobado

## Contexto

El proyecto usa `better-sqlite3` con SQL crudo y un schema inline en `SqliteDatabase.ts`. Para producción y escalabilidad se migra a PostgreSQL self-hosted. Se adopta Drizzle ORM por su similitud conceptual con Entity Framework: schema tipado en TypeScript, migraciones versionadas generadas automáticamente, y queries con type-safety.

## Decisiones clave

- **Corte limpio**: se elimina SQLite por completo, sin modo dual ni compatibilidad hacia atrás.
- **Drizzle ORM** sobre `pg` (node-postgres) como driver.
- **Self-hosted PostgreSQL** en VPS propio.
- **Datos existentes** no se migran en este scope (migración puntual de datos queda como tarea separada si se necesita).

## Dependencias

**Agregar:**
- `drizzle-orm`
- `pg` + `@types/pg`
- `drizzle-kit` (devDependency)

**Eliminar:**
- `better-sqlite3`
- `@types/better-sqlite3`

## Estructura de archivos

```
src/infrastructure/persistence/
├── drizzle/
│   ├── schema.ts             ← definición de todas las tablas en TypeScript
│   ├── db.ts                 ← singleton: drizzle(new Pool({ connectionString }))
│   └── migrations/           ← archivos SQL generados por drizzle-kit generate
└── postgres/
    ├── PostgresUserRepository.ts
    ├── PostgresQuestionRepository.ts
    ├── PostgresTenantRepository.ts
    ├── PostgresClaimRepository.ts
    ├── PostgresOrderMessageRepository.ts
    ├── PostgresItemCacheRepository.ts
    ├── PostgresItemKnowledgeRepository.ts
    ├── PostgresEventRepository.ts
    └── PostgresLLMUsageRepository.ts
```

**Eliminar:** `src/infrastructure/persistence/sqlite/` completo.

**Agregar en raíz:** `drizzle.config.ts`

## Adaptaciones SQLite → PostgreSQL

| SQLite | PostgreSQL / Drizzle |
|--------|---------------------|
| `INTEGER PRIMARY KEY AUTOINCREMENT` | `serial('id').primaryKey()` |
| `TEXT PRIMARY KEY` (UUIDs) | `text('id').primaryKey()` |
| `INTEGER` para booleanos (0/1) | `boolean()` nativo |
| `DATETIME DEFAULT CURRENT_TIMESTAMP` | `timestamp().defaultNow()` |
| `REAL` | `doublePrecision()` |
| `ON CONFLICT(col) DO UPDATE SET` | `.onConflictDoUpdate({ target, set })` de Drizzle |
| `?` positional placeholders | Drizzle los maneja internamente |
| Schema inline + `addColumnIfNotExists` | Migraciones versionadas con `drizzle-kit` |

## Variables de entorno

Se agrega `DATABASE_URL` al `.env`:

```env
DATABASE_URL=postgres://user:password@localhost:5432/meli_bot
```

## Scripts de package.json

```json
"db:generate": "drizzle-kit generate",
"db:migrate":  "drizzle-kit migrate"
```

## Flujo de migraciones

Equivalente a EF Migrations. Drizzle mantiene la tabla `__drizzle_migrations` para rastrear qué migraciones ya se aplicaron.

```bash
# Generar SQL a partir del schema.ts (como `dotnet ef migrations add`)
npm run db:generate

# Aplicar migraciones pendientes a la BD (como `dotnet ef database update`)
npm run db:migrate
```

En producción, `npm run db:migrate` se ejecuta antes de iniciar el servidor.

## Wire-up en app.ts

Se reemplaza:
```ts
const db = SqliteDatabase.getInstance();
const userRepo = new SqliteUserRepository(db);
// ...
```

Por:
```ts
import { db } from "./infrastructure/persistence/drizzle/db.js";
const userRepo = new PostgresUserRepository(db);
// ...
```

Cambio concentrado en ~15 líneas de `app.ts`. El resto de la app no cambia porque los repositorios implementan las mismas interfaces (`IUserRepository`, `IQuestionRepository`, etc.).

## Repositorios

Cada `SqliteXxxRepository` se reemplaza por su equivalente `PostgresXxxRepository` implementando la misma interfaz. Las queries se reescriben usando la API de Drizzle (`db.select()`, `db.insert()`, `db.update()`, `db.delete()`).

Los booleanos que se guardaban como `0/1` se leen/escriben directamente como `boolean` — no se necesita conversión manual.
