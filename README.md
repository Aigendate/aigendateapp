# Turnos PY

Hospital appointment scheduling for Paraguay. React Router 7 frontend with an MCP server for AI assistant integration.

247 real hospitals from OpenStreetMap, 20 doctors across 10 specialties, patient registration, and appointment management — all backed by SQLite.

## Quick Start

```bash
npm install
npm run seed        # populate the database
npm run dev         # http://localhost:3456
```

The seed script works without scraped data — it includes 10 fallback hospitals. For the full 247-hospital dataset, run the scraper first:

```bash
pip install -r scraper/requirements.txt
npm run scrape      # fetch hospital CSVs into data/
npm run seed        # populate SQLite from CSVs
```

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
- **Data**: OpenStreetMap Paraguay hospital data (247 facilities)

## Scraper

The `scraper/` directory contains a Python script that pulls facility data from four public APIs. To re-fetch:

```bash
pip install -r scraper/requirements.txt
npm run scrape
```

Output goes to `data/`. Re-run `npm run seed` after scraping to update the database.
