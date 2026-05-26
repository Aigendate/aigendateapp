# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Next.js dev server on port 3456
npm test             # Run all tests (vitest)
npm run test:watch   # Tests in watch mode
npx vitest run tests/server/db.test.ts  # Single test file
npm run typecheck    # tsc --noEmit
npm run seed         # Seed DB from data/ CSVs (247 hospitals, 20 doctors, 10 patients)
npm run scrape       # Re-fetch hospital CSVs from public APIs (requires pip install requests)
npm run build        # Production build (next build)
npm start            # Production server (next start)
npm run mcp:stdio    # MCP server on stdio (for Claude Code)
```

## Architecture

Next.js 15 App Router serves both the SSR UI and the MCP HTTP endpoint as a single Node process:

- **`/mcp`** is an App Router route handler at `app/mcp/route.ts` using `WebStandardStreamableHTTPServerTransport` from `@modelcontextprotocol/sdk`
- **Pages** are Server Components under `app/*/page.tsx` that query the DB directly during SSR
- All pages are marked dynamic (`export const dynamic = "force-dynamic"` on the root layout) since they depend on live DB state

### Shared database layer

`server/db.ts` is imported by both route pages and MCP tools. Key patterns:

- **`getDb(dbPath?)`** returns a singleton stored on `globalThis.__turnos_db` (survives HMR)
- Accepts `:memory:` for tests, defaults to `process.cwd()/turnos.db`
- `server/db.server.ts` re-exports everything (kept for the `.server.ts` convention even though Next App Router doesn't require it — Server Components already exclude server-only modules from client bundles)
- `better-sqlite3` is listed in `serverExternalPackages` in `next.config.ts` so Next doesn't try to bundle the native addon
- Four tables: `hospitals`, `doctors`, `patients`, `appointments`. WAL mode, foreign keys enforced. DB file (`turnos.db`) is created in the project root on first run

### MCP

`server/mcp.ts` exports `createMcpServer(dbPath?)` which registers 7 tools. Two entry points:
- `mcp-stdio.ts` — standalone stdio transport (what `.mcp.json` points to)
- `app/mcp/route.ts` — Next.js route handler that bridges Web `Request`/`Response`. Session state (Mcp-Session-Id → transport) is kept in a module-level `Map` stored on `globalThis.__mcp_sessions` to survive HMR.

### Route conventions

Server Components fetch directly:
```typescript
export default async function Page({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const db = getDb();
  const rows = listHospitals(db, { name: q });
  return <…/>;
}
```

Interactive filters live in client components (e.g. `app/components/search-input.tsx`, `app/turnos/filters.tsx`) that call `router.replace()` with new search params. The `~` alias resolves to `./app` via tsconfig `paths`.

## Testing

Vitest with node environment. Tests use in-memory SQLite — no DB file needed.

```typescript
let db: Database.Database;
beforeEach(() => { db = initDb(":memory:"); });
afterEach(() => { db.close(); (globalThis as any).__turnos_db = undefined; });
```

Always reset `globalThis.__turnos_db` in `afterEach` to avoid singleton leakage between tests.

Test files: `tests/server/db.test.ts` (DB queries), `tests/server/mcp.test.ts` (MCP server), `tests/routes/loaders.test.ts` (DB-backed page data), `tests/integration/server.test.ts` (MCP route handler invoked directly via `Request`).

## Next.js gotchas

- `better-sqlite3` must stay in `serverExternalPackages` in `next.config.ts` — it's a native C++ addon
- DB paths use `process.cwd()`, not `import.meta.url`
- Imports of `.ts` source files from other `.ts` files use bare paths (no `.js` extension) so the Next bundler resolves them. The standalone scripts (`mcp-stdio.ts`, `seed.ts`) run via `tsx`, which also accepts bare paths.
- The `~` alias resolves to `./app` via tsconfig `paths`

## MCP connection

`.mcp.json` in the project root has a hardcoded path — update it to your local checkout before using `npm run mcp:stdio` with Claude Code.

## Data

`data/` contains Paraguay health facility CSVs from OpenStreetMap. `scraper/paraguay_hospitals.py` re-fetches them (requires `pip install requests`). After scraping, re-run `npm run seed`.
