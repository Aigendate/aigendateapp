# Turnos PY

Hospital appointment scheduling for Paraguay. React Router 7 frontend with an MCP server for AI assistant integration.

248 real hospitals from OpenStreetMap, 20 doctors across 10 specialties, patient registration, and appointment management — all backed by SQLite.

## Quick Start

```bash
npm install
npm run seed        # populate the database (10 fallback hospitals)
npm run dev         # http://localhost:3456
```

## Populate Hospitals from OpenStreetMap

For the full 248-hospital dataset with real coordinates from Paraguay:

```bash
pip install -r scraper/requirements.txt   # install Python dependencies
npm run scrape                            # fetch hospital CSVs from OSM into scraper/data/
node --import tsx populate-hospitals.ts    # insert hospitals into SQLite (clears existing data)
npm run seed                               # seed doctors, patients, appointments
```

`npm run scrape` downloads facility data from OpenStreetMap (and optionally healthsites.io, WHO, World Bank) into `scraper/data/osm_facilities.csv`.

`populate-hospitals.ts` reads that CSV, filters for `facility_type === "hospital"` with valid coordinates, clears the existing `hospitals` table (and cascades to dependent rows), and inserts all matching hospitals. After running it, you must re-run `npm run seed` to recreate doctors, patients, and appointments.

The seed script (`npm run seed`) also reads `data/osm_facilities.csv` but looks in the `data/` directory at the project root. If the CSV is not found there, it falls back to 10 hardcoded hospitals.

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start dev server with HMR (port 3456) |
| `npm run build` | Production build |
| `npm start` | Run production server |
| `npm test` | Run test suite (33 tests) |
| `npm run test:watch` | Run tests in watch mode |
| `npm run typecheck` | Type check with tsc |
| `npm run seed` | Seed DB from CSV data |
| `npm run mcp:stdio` | Start MCP server (stdio transport) |
| `npm run scrape` | Re-fetch hospital data from public APIs |
| `node --import tsx populate-hospitals.ts` | Insert OSM hospitals into SQLite (clears existing data) |

## Project Structure

```
app/                     React Router 7 frontend
  root.tsx               Layout, nav, fonts, theme
  routes/
    _index.tsx           Dashboard (stats, charts, tables)
    hospitales.tsx       Hospital list with search
    doctores.tsx         Doctor list by specialty
    pacientes.tsx        Patient list
    turnos.tsx           Appointments with filters
  components/
    ui/                  shadcn/ui components (card, table, badge, input)
    stat-card.tsx        Dashboard stat card
    bar-chart.tsx        Horizontal bar chart
server/                  Shared server-side code
  db.ts                  SQLite schema, queries, types
  db.server.ts           Re-export (RR7 server boundary)
  mcp.ts                 MCP tool registration (7 tools)
scraper/                 Python data scraper
  paraguay_hospitals.py  Fetches from OSM, healthsites.io, WHO, World Bank
data/                    CSV source files for seeding
tests/                   Vitest test suite
server.ts                Express server (RR7 + MCP HTTP)
mcp-stdio.ts             MCP stdio entry (for Claude Code)
populate-hospitals.ts   Insert OSM hospitals into SQLite (clears all tables, re-seed after)
seed.ts                  Database seeding script
```

## Architecture

A single Express server handles both the web app and MCP:

- **`/mcp`** — MCP HTTP transport (StreamableHTTP with CORS and session management)
- **`/*`** — React Router 7 with SSR, loaders query SQLite directly

In development, Vite runs in middleware mode for HMR. In production, `react-router build` produces static client assets and a server bundle.

The MCP server also runs standalone via stdio for Claude Code integration (`npm run mcp:stdio`).

### Database

SQLite via `better-sqlite3`. Four tables: `hospitals`, `doctors`, `patients`, `appointments`. WAL mode, foreign keys enforced. The DB file (`turnos.db`) is created in the project root on first run.

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

The `.mcp.json` in the project root configures Claude Code automatically. Or add manually:

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

## Stack

- **Frontend**: React Router 7 (SSR), Tailwind v4, shadcn/ui
- **Server**: Express 5, MCP SDK (stdio + HTTP)
- **Database**: SQLite via better-sqlite3
- **Testing**: Vitest (33 tests)
- **Data**: OpenStreetMap Paraguay hospital data (248 facilities)

## Scraper

The `scraper/` directory contains a Python script that pulls facility data from four public APIs. To re-fetch:

```bash
pip install -r scraper/requirements.txt
npm run scrape
```

Output goes to `scraper/data/`. To populate the database with the scraped hospitals, run `node --import tsx populate-hospitals.ts` followed by `npm run seed`.
