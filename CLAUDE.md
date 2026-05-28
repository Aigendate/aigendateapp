# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev           # Next.js dev server on port 3456
npm test              # Run all tests (vitest)
npm run test:watch    # Tests in watch mode
npx vitest run tests/server/db.test.ts  # Single test file
npm run typecheck     # tsc --noEmit
npm run seed          # Seed DB: 247 hospitals if data/osm_facilities.csv exists locally, else 10 inline fallback + 20 doctors + 10 patients
npm run scrape        # Re-fetch hospital CSVs from public APIs (requires pip install requests)
npm run build         # Production build (next build)
npm start             # Production server (next start)
npm run mcp:stdio     # MCP server on stdio (for Claude Code)
npm run db:up         # Start local Postgres (docker compose)
npm run db:generate   # Generate a new Drizzle migration from schema changes
npm run db:migrate    # Apply pending migrations against $DATABASE_URL
npm run db:push       # Sync schema directly (skips migration files)
npm run db:studio     # Open Drizzle Studio
npm run db:test:setup # Create + migrate a separate test DB (turnos_test)
```

After running `db:test:setup` once, add the printed `DATABASE_URL_TEST` line to your `.env` so `npm test` uses the isolated DB instead of truncating the dev seed.

## Architecture

Next.js 15 App Router serves both the SSR UI and the MCP HTTP endpoint as a single Node process:

- **`/mcp`** is an App Router route handler at `app/mcp/route.ts` using `WebStandardStreamableHTTPServerTransport` from `@modelcontextprotocol/sdk`
- **Pages** are Server Components under `app/*/page.tsx` that query the DB directly during SSR
- All pages are marked dynamic (`export const dynamic = "force-dynamic"` on the root layout) since they depend on live DB state

### Shared database layer

Drizzle ORM on PostgreSQL via `pg.Pool`. Three files make up the data layer:

- `server/schema.ts` — Drizzle table definitions (`hospitals`, `patients`, `doctors`, `doctor_schedules`, `appointments`, `waitlist_entries`). UUID PKs are generated client-side via `randomUUID()`.
- `server/client.ts` — exports `db`, a lazy `NodePgDatabase` singleton stored on `globalThis.__db` (survives HMR). Reads `DATABASE_URL` from env.
- `server/db.ts` — high-level helpers (`insertHospital`, `listDoctors`, `createAppointment`, …) used by MCP tools and the public `/hospitales`, `/doctores`, `/pacientes`, `/turnos` pages.

Admin pages and server actions in `app/(admin)/admin/` query Drizzle directly via `db` + `schema`. `pg` stays in `serverExternalPackages` in `next.config.ts` so Next doesn't try to bundle the native driver.

### Migrations

Generated SQL lives in `drizzle/`. After editing `server/schema.ts`, run `npm run db:generate` to emit a new file, then `npm run db:migrate` to apply it. `drizzle.config.ts` is the source of truth for the kit. The `__drizzle_migrations` table (in the `drizzle` schema) tracks applied migrations.

`server/migrate.ts` prefers `DIRECT_URL` over `DATABASE_URL` when both are set. Supabase's pgbouncer transaction pooler (typically `DATABASE_URL`, port 6543) breaks advisory locks and some DDL the migrator relies on, so migrations should hit the direct connection (port 5432). The runtime client (`server/client.ts`) still uses `DATABASE_URL` so the app benefits from the pool.

### Schema invariants

Patterns that aren't obvious from the schema file alone but the code depends on:

- **Partial unique index** on `appointments(doctor_id, date, time) WHERE status='scheduled'`. The four insert/update paths that can collide — `createAppointment`, `rescheduleAppointment`, `offerSlotToWaitlistEntry`, `createRecurringAppointment` — all catch the `23505` violation via `isUniqueViolation()` in `server/db.ts` and surface a friendly error. The recurring path runs in a transaction so a mid-series collision rolls back the parent too.
- **Cascade FKs** on every relationship into `appointments`, `doctors`, `patients`, `hospitals`, `doctor_schedules`. `deleteDoctor`/`deletePatient`/`deleteHospital` are intentionally single-statement deletes that rely on this. `waitlist_entries.doctor_id` is the deliberate exception (`ON DELETE SET NULL`) — entries survive doctor removal as "any doctor".
- **Self-FK** on `appointments.parent_appointment_id` → `appointments(id)` with `ON DELETE SET NULL`, so deleting a recurring-series parent detaches the children rather than leaving dangling references.

### Deployment (Vercel)

`vercel-build.ts` is the build entry — Vercel runs `npm run vercel-build` whenever that script exists. It applies pending migrations only when `VERCEL_ENV=production`, then invokes `next build`. Preview/dev builds skip migrations so PR previews don't mutate the prod DB. Production must have `DATABASE_URL` (pooler) and `DIRECT_URL` (direct) set; the build fails loudly if `DATABASE_URL` is missing on a production deploy.

Per session memory: CLI deploys from Claude on this project land in BLOCKED state — push to a connected GitHub branch or click Redeploy in the Vercel dashboard.

### MCP

`server/mcp.ts` exports `createMcpServer()` (no args), which registers 7 tools: `list_hospitals`, `register_patient`, `list_patients`, `list_doctors`, `create_appointment`, `list_appointments`, `cancel_appointment`. Two entry points:
- `mcp-stdio.ts` — standalone stdio transport (what `.mcp.json` points to)
- `app/mcp/route.ts` — Next.js route handler that bridges Web `Request`/`Response`. Session state (Mcp-Session-Id → transport) is kept in a module-level `Map` stored on `globalThis.__mcp_sessions` to survive HMR.

**Vercel caveat**: storing sessions on `globalThis` only survives within a single Function instance. Fluid Compute reuses warm instances so most sessions stick, but cross-instance requests will lose state. If MCP-over-HTTP becomes a real prod use case, sessions need to move to the DB.

### Admin server actions

`app/(admin)/admin/actions.ts` defines `"use server"` actions consumed by client forms in `app/(admin)/admin/*/client.tsx`. They return `void` and `throw new Error(...)` on failure — there's no `useActionState` wiring yet, so users see browser errors rather than inline messages. `createAppointment` routes through the validated helper in `server/db.ts` (which checks hospital/patient/doctor existence and "doctor practices at hospital") rather than raw insert.

### Route conventions

Server Components fetch directly:
```typescript
export default async function Page({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const rows = await listHospitals({ name: q });
  return <…/>;
}
```

Interactive filters live in client components (e.g. `app/components/search-input.tsx`) that call `router.replace()` with new search params. The `~` alias resolves to `./app` via tsconfig `paths`.

## Testing

Vitest with node environment. `tests/setup.ts` prefers `DATABASE_URL_TEST` (a separate `turnos_test` DB created via `npm run db:test:setup`), falling back to `DATABASE_URL` with a console warning. The fallback path truncates the dev seed via `tests/helpers/db.ts`, so always prefer the isolated DB during development. Run `npm run db:up` to start Postgres first.

Test files: `tests/server/db.test.ts` (DB queries), `tests/server/mcp.test.ts` (MCP server), `tests/routes/loaders.test.ts` (DB-backed page data), `tests/integration/server.test.ts` (MCP route handler invoked directly via `Request`).

## Next.js gotchas

- `pg` must stay in `serverExternalPackages` in `next.config.ts` — Next shouldn't try to bundle the native driver
- Imports of `.ts` source files from other `.ts` files use bare paths (no `.js` extension) so the Next bundler resolves them. The standalone scripts (`mcp-stdio.ts`, `seed.ts`, `vercel-build.ts`) run via `tsx`, which also accepts bare paths.
- The `~` alias resolves to `./app` via tsconfig `paths`

## MCP connection

`.mcp.json` in the project root has a hardcoded path — update it to your local checkout before using `npm run mcp:stdio` with Claude Code.

## Data

`data/` contains Paraguay health facility CSVs from OpenStreetMap. `scraper/paraguay_hospitals.py` re-fetches them (requires `pip install requests`). After scraping, re-run `npm run seed`.
