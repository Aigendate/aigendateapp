# Turnos PY

Hospital appointment scheduling for Paraguay. Next.js 15 App Router serves both the SSR UI and an MCP server for AI assistant integration from a single Node process.

Real hospitals from OpenStreetMap, doctors across multiple specialties, patient registration, appointment scheduling (including recurring series and a waitlist) — all backed by PostgreSQL via Drizzle ORM.

## Quick Start

```bash
npm install
cp .env.example .env   # then adjust if needed
npm run db:up          # start local Postgres (docker compose, host port 5434)
npm run db:migrate     # apply migrations
npm run seed           # populate hospitals, doctors, patients
npm run dev            # http://localhost:3456
```

## Environment

Copy `.env.example` to `.env`. The file is gitignored — never commit real credentials.

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Runtime connection. Locally this is docker Postgres; in production it's the Supabase pooler (port 6543). |
| `DIRECT_URL` | Direct (non-pooled) connection used by migrations. In production this is the Supabase direct connection (port 5432) — the pgbouncer pooler breaks advisory locks and some DDL the migrator needs. |
| `DATABASE_URL_TEST` | Isolated test DB used by the suite. Create it with `npm run db:test:setup`, then add the printed line to `.env`. |

## Populate Hospitals from OpenStreetMap

For the full hospital dataset with real coordinates from Paraguay:

```bash
pip install -r scraper/requirements.txt   # install Python dependencies
npm run scrape                            # fetch hospital CSVs from OSM into scraper/data/
npm run populate:hospitals                # insert hospitals into Postgres (clears existing data)
npm run seed                              # seed doctors, patients, appointments
```

`npm run scrape` downloads facility data from OpenStreetMap (and optionally healthsites.io, WHO, World Bank) into `scraper/data/osm_facilities.csv`.

`populate-hospitals.ts` reads that CSV, filters for hospitals with valid coordinates, clears the existing `hospitals` table (cascading to dependent rows), and inserts all matches. Re-run `npm run seed` afterward to recreate doctors, patients, and appointments.

`npm run seed` reads `data/osm_facilities.csv` at the project root; if the CSV isn't found it falls back to 10 hardcoded hospitals.

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Next.js dev server (port 3456) |
| `npm run build` | Production build |
| `npm start` | Run production server (port 3456) |
| `npm test` | Run test suite (vitest) |
| `npm run test:watch` | Tests in watch mode |
| `npm run typecheck` | Type check with `tsc --noEmit` |
| `npm run seed` | Seed DB from CSV data |
| `npm run populate:hospitals` | Insert OSM hospitals into Postgres (clears existing data) |
| `npm run scrape` | Re-fetch hospital data from public APIs |
| `npm run mcp:stdio` | Start MCP server (stdio transport) |
| `npm run db:up` / `db:down` | Start / stop local Postgres (docker compose) |
| `npm run db:generate` | Generate a Drizzle migration from schema changes |
| `npm run db:migrate` | Apply pending migrations |
| `npm run db:push` | Sync schema directly (skips migration files) |
| `npm run db:studio` | Open Drizzle Studio |
| `npm run db:test:setup` | Create + migrate the isolated test DB |

## Project Structure

```
app/                        Next.js App Router
  (public)/                 Public SSR pages (query the DB directly)
    page.tsx                Dashboard
    hospitales/page.tsx     Hospital list with search
    doctores/page.tsx       Doctor list by specialty
    pacientes/page.tsx      Patient list
    turnos/page.tsx         Appointments with filters
  (admin)/admin/            Admin dashboard + server actions
    agenda, turnos, doctores, hospitales, pacientes, lista-espera
  mcp/route.ts              MCP HTTP route handler (StreamableHTTP)
  components/               UI components (incl. shadcn-style ui/)
server/                     Shared server-side code
  schema.ts                 Drizzle table definitions
  client.ts                 Lazy `db` singleton (NodePgDatabase)
  db.ts                     High-level query helpers
  migrate.ts                Migration runner (prefers DIRECT_URL)
  mcp.ts                    MCP tool registration (7 tools)
  setup-test-db.ts          Creates the isolated test DB
drizzle/                    Generated migration SQL
scraper/                    Python data scraper
data/                       CSV source files for seeding
tests/                      Vitest test suite
mcp-stdio.ts                MCP stdio entry (for Claude Code)
seed.ts                     Database seeding script
populate-hospitals.ts       Insert OSM hospitals (clears tables, re-seed after)
vercel-build.ts             Vercel build entry (migrates on prod, then next build)
```

## Architecture

A single Next.js process serves the web app and MCP:

- **`/mcp`** — App Router route handler (`app/mcp/route.ts`) using `WebStandardStreamableHTTPServerTransport` from the MCP SDK.
- **Pages** — Server Components under `app/*/page.tsx` that query the DB directly during SSR. All pages are dynamic (`force-dynamic`) since they depend on live DB state.

The MCP server also runs standalone via stdio for Claude Code (`npm run mcp:stdio`).

### Database

Drizzle ORM on PostgreSQL via `pg.Pool`. Tables: `hospitals`, `patients`, `doctors`, `doctor_schedules`, `appointments`, `waitlist_entries`. UUID primary keys are generated client-side.

Notable invariants the code relies on:

- **Partial unique index** on `appointments(doctor_id, date, time) WHERE status='scheduled'` — every insert/update path catches the `23505` violation and surfaces a friendly error.
- **Cascade FKs** into `appointments`/`doctors`/`patients`/`hospitals`/`doctor_schedules`, so deletes are single statements. `waitlist_entries.doctor_id` is the exception (`ON DELETE SET NULL`) — entries survive doctor removal as "any doctor".
- **Self-FK** on `appointments.parent_appointment_id` (`ON DELETE SET NULL`) so deleting a recurring-series parent detaches children rather than dangling.

Migrations live in `drizzle/`. Edit `server/schema.ts`, run `npm run db:generate`, then `npm run db:migrate`.

### Deployment (Vercel)

`vercel-build.ts` is the build entry. It applies pending migrations only when `VERCEL_ENV=production`, then runs `next build`. Preview builds skip migrations so PR previews don't mutate the prod DB. Production must have `DATABASE_URL` (pooler) and `DIRECT_URL` (direct) set.

### MCP Tools

| Tool | Description |
|---|---|
| `list_hospitals` | Search by name, sort by distance (lat/lng) |
| `list_doctors` | Filter by hospital, specialty, or name |
| `register_patient` | Register a patient (only name required) |
| `list_patients` | Search by name or email |
| `create_appointment` | Schedule with doctor/patient/hospital validation |
| `list_appointments` | Filter by date, doctor, patient, status |
| `cancel_appointment` | Cancel by appointment ID |

### Connecting to Claude Code

The `.mcp.json` in the project root configures Claude Code (update its hardcoded path to your checkout first). Or add manually:

```json
{
  "mcpServers": {
    "turnos": {
      "command": "node",
      "args": ["--import", "tsx", "/path/to/turnos/mcp-stdio.ts"]
    }
  }
}
```

## Testing

Vitest with the node environment. The suite prefers `DATABASE_URL_TEST` (the isolated `turnos_test` DB from `npm run db:test:setup`), falling back to `DATABASE_URL` with a warning — the fallback truncates the dev seed, so prefer the isolated DB. Start Postgres with `npm run db:up` first.

## Stack

- **Framework**: Next.js 15 (App Router, React 19, SSR)
- **Styling**: Tailwind v4, shadcn-style UI components
- **Server**: MCP SDK (stdio + HTTP route handler)
- **Database**: PostgreSQL via Drizzle ORM (`pg`)
- **Testing**: Vitest
- **Data**: OpenStreetMap Paraguay hospital data
- **Hosting**: Vercel (Supabase Postgres)
