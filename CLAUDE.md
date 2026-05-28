# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev           # Next.js dev server on port 3456
npm test              # Run all tests (vitest)
npm run test:watch    # Tests in watch mode
npx vitest run tests/server/db.test.ts  # Single test file
npm run typecheck     # tsc --noEmit
npm run seed          # Seed DB from data/ CSVs (247 hospitals, 20 doctors, 10 patients)
npm run scrape        # Re-fetch hospital CSVs from public APIs (requires pip install requests)
npm run build         # Production build (next build)
npm start             # Production server (next start)
npm run mcp:stdio     # MCP server on stdio (for Claude Code)
npm run db:up         # Start local Postgres (docker compose)
npm run db:generate   # Generate a new Drizzle migration from schema changes
npm run db:migrate    # Apply pending migrations against $DATABASE_URL
npm run db:push       # Sync schema directly (skips migration files)
npm run db:studio     # Open Drizzle Studio
```

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

### MCP

`server/mcp.ts` exports `createMcpServer(dbPath?)` which registers 7 tools. Two entry points:
- `mcp-stdio.ts` — standalone stdio transport (what `.mcp.json` points to)
- `app/mcp/route.ts` — Next.js route handler that bridges Web `Request`/`Response`. Session state (Mcp-Session-Id → transport) is kept in a module-level `Map` stored on `globalThis.__mcp_sessions` to survive HMR.

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

Vitest with node environment. Tests hit the same local Postgres (the dev DB), resetting state via `TRUNCATE ... RESTART IDENTITY CASCADE` in `tests/helpers/db.ts`. Set `DATABASE_URL` in `.env` and run `npm run db:up` before testing.

Test files: `tests/server/db.test.ts` (DB queries), `tests/server/mcp.test.ts` (MCP server), `tests/routes/loaders.test.ts` (DB-backed page data), `tests/integration/server.test.ts` (MCP route handler invoked directly via `Request`).

## Next.js gotchas

- `pg` must stay in `serverExternalPackages` in `next.config.ts` — Next shouldn't try to bundle the native driver
- DB paths use `process.cwd()`, not `import.meta.url`
- Imports of `.ts` source files from other `.ts` files use bare paths (no `.js` extension) so the Next bundler resolves them. The standalone scripts (`mcp-stdio.ts`, `seed.ts`) run via `tsx`, which also accepts bare paths.
- The `~` alias resolves to `./app` via tsconfig `paths`

## MCP connection

`.mcp.json` in the project root has a hardcoded path — update it to your local checkout before using `npm run mcp:stdio` with Claude Code.

## Data

`data/` contains Paraguay health facility CSVs from OpenStreetMap. `scraper/paraguay_hospitals.py` re-fetches them (requires `pip install requests`). After scraping, re-run `npm run seed`.
