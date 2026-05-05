#!/usr/bin/env node
import { createServer } from "node:http";
import { initDb } from "./db.js";

const db = initDb();
const PORT = 3456;

function getStats() {
  const hospitals = (db.prepare("SELECT COUNT(*) as n FROM hospitals").get() as { n: number }).n;
  const patients = (db.prepare("SELECT COUNT(*) as n FROM patients").get() as { n: number }).n;
  const doctors = (db.prepare("SELECT COUNT(*) as n FROM doctors").get() as { n: number }).n;
  const scheduled = (db.prepare("SELECT COUNT(*) as n FROM appointments WHERE status = 'scheduled'").get() as { n: number }).n;
  const cancelled = (db.prepare("SELECT COUNT(*) as n FROM appointments WHERE status = 'cancelled'").get() as { n: number }).n;
  return { hospitals, patients, doctors, scheduled, cancelled };
}

function getAppointments() {
  return db.prepare(`
    SELECT a.*, h.name as hospital_name, p.name as patient_name, d.name as doctor_name, d.specialty
    FROM appointments a
    JOIN hospitals h ON a.hospital_id = h.id
    JOIN patients p ON a.patient_id = p.id
    JOIN doctors d ON a.doctor_id = d.id
    ORDER BY a.date, a.time
  `).all();
}

function getHospitals() {
  return db.prepare("SELECT * FROM hospitals ORDER BY name").all();
}

function getPatients() {
  return db.prepare("SELECT * FROM patients ORDER BY name").all();
}

function getDoctors() {
  return db.prepare("SELECT d.*, h.name as hospital_name FROM doctors d JOIN hospitals h ON d.hospital_id = h.id ORDER BY d.specialty, d.name").all();
}

function getSpecialtyBreakdown() {
  return db.prepare(`
    SELECT d.specialty, COUNT(*) as count
    FROM appointments a
    JOIN doctors d ON a.doctor_id = d.id
    WHERE a.status = 'scheduled'
    GROUP BY d.specialty ORDER BY count DESC
  `).all();
}

function getHospitalAppointmentCounts() {
  return db.prepare(`
    SELECT h.name, COUNT(a.id) as count
    FROM hospitals h
    LEFT JOIN appointments a ON h.id = a.hospital_id AND a.status = 'scheduled'
    GROUP BY h.id
    HAVING count > 0
    ORDER BY count DESC
    LIMIT 10
  `).all();
}

function renderPage(): string {
  const stats = getStats();
  const appointments = getAppointments();
  const hospitals = getHospitals();
  const doctors = getDoctors();
  const patients = getPatients();
  const specialtyBreakdown = getSpecialtyBreakdown();
  const topHospitals = getHospitalAppointmentCounts();

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Turnos — Dashboard</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=DM+Mono:wght@400;500&family=Anybody:wght@400;600;800&display=swap" rel="stylesheet">
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --bg: #F6F1EB;
    --bg-card: #FFFCF8;
    --ink: #1A1A18;
    --ink-muted: #6B6860;
    --accent: #C4510A;
    --accent-light: #F4DFC8;
    --teal: #1A6B5A;
    --teal-light: #D2EDE6;
    --red: #B83232;
    --red-light: #F5DCDC;
    --border: #E0D9CF;
    --shadow: 0 1px 3px rgba(26,26,24,0.06), 0 4px 12px rgba(26,26,24,0.04);
  }

  html { font-size: 15px; }

  body {
    font-family: 'DM Mono', monospace;
    background: var(--bg);
    color: var(--ink);
    min-height: 100vh;
    -webkit-font-smoothing: antialiased;
  }

  .noise {
    position: fixed; inset: 0; z-index: 0; pointer-events: none; opacity: 0.3;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E");
  }

  .shell { position: relative; z-index: 1; max-width: 1280px; margin: 0 auto; padding: 2rem 2.5rem 4rem; }

  header {
    display: flex; align-items: baseline; justify-content: space-between;
    border-bottom: 2px solid var(--ink); padding-bottom: 1.2rem; margin-bottom: 2.5rem;
  }

  header h1 {
    font-family: 'Instrument Serif', serif;
    font-size: 2.8rem; font-weight: 400; letter-spacing: -0.02em; line-height: 1;
  }

  header h1 em { font-style: italic; color: var(--accent); }

  header .meta { font-size: 0.75rem; color: var(--ink-muted); text-transform: uppercase; letter-spacing: 0.08em; }

  /* --- Stats strip --- */
  .stats {
    display: grid; grid-template-columns: repeat(5, 1fr); gap: 1rem; margin-bottom: 2.5rem;
  }

  .stat {
    background: var(--bg-card); border: 1px solid var(--border); padding: 1.4rem 1.5rem;
    box-shadow: var(--shadow); position: relative; overflow: hidden;
  }

  .stat::before {
    content: ''; position: absolute; top: 0; left: 0; width: 4px; height: 100%;
  }

  .stat:nth-child(1)::before { background: var(--teal); }
  .stat:nth-child(2)::before { background: var(--accent); }
  .stat:nth-child(3)::before { background: #5B4FC7; }
  .stat:nth-child(4)::before { background: var(--ink); }
  .stat:nth-child(5)::before { background: var(--red); }

  .stat .label {
    font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.1em;
    color: var(--ink-muted); margin-bottom: 0.5rem;
  }

  .stat .value {
    font-family: 'Anybody', sans-serif; font-weight: 800; font-size: 2.4rem;
    line-height: 1; letter-spacing: -0.03em;
  }

  .stat:nth-child(1) .value { color: var(--teal); }
  .stat:nth-child(2) .value { color: var(--accent); }
  .stat:nth-child(3) .value { color: #5B4FC7; }
  .stat:nth-child(5) .value { color: var(--red); }

  /* --- Grid layout --- */
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; margin-bottom: 2.5rem; }
  .grid.triple { grid-template-columns: 1fr 1fr 1fr; }

  .card {
    background: var(--bg-card); border: 1px solid var(--border);
    box-shadow: var(--shadow); padding: 1.5rem; overflow: hidden;
  }

  .card-title {
    font-family: 'Instrument Serif', serif;
    font-size: 1.4rem; font-weight: 400; margin-bottom: 1.2rem;
    padding-bottom: 0.8rem; border-bottom: 1px solid var(--border);
    display: flex; align-items: baseline; justify-content: space-between;
  }

  .card-title .badge {
    font-family: 'DM Mono', monospace; font-size: 0.65rem;
    text-transform: uppercase; letter-spacing: 0.08em;
    background: var(--teal-light); color: var(--teal);
    padding: 0.2rem 0.6rem;
  }

  /* --- Appointments table --- */
  .appointments-table { width: 100%; border-collapse: collapse; font-size: 0.8rem; }

  .appointments-table th {
    text-align: left; font-size: 0.65rem; text-transform: uppercase;
    letter-spacing: 0.1em; color: var(--ink-muted); padding: 0 0.8rem 0.6rem 0;
    border-bottom: 1px solid var(--border); font-weight: 500;
  }

  .appointments-table td {
    padding: 0.7rem 0.8rem 0.7rem 0; border-bottom: 1px solid #f0ebe3;
    vertical-align: top;
  }

  .appointments-table tr:last-child td { border-bottom: none; }

  .appointments-table tr { transition: background 0.15s; }
  .appointments-table tbody tr:hover { background: #F9F5EF; }

  .pill {
    display: inline-block; font-size: 0.6rem; text-transform: uppercase;
    letter-spacing: 0.06em; padding: 0.15rem 0.5rem; font-family: 'DM Mono', monospace;
  }

  .pill.scheduled { background: var(--teal-light); color: var(--teal); }
  .pill.cancelled { background: var(--red-light); color: var(--red); }

  .specialty-tag {
    display: inline-block; font-size: 0.65rem; padding: 0.15rem 0.5rem;
    background: var(--accent-light); color: var(--accent);
    font-family: 'DM Mono', monospace;
  }

  /* --- Bar chart --- */
  .bar-row { display: flex; align-items: center; gap: 0.8rem; margin-bottom: 0.6rem; }
  .bar-row:last-child { margin-bottom: 0; }

  .bar-label {
    font-size: 0.7rem; width: 120px; flex-shrink: 0;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }

  .bar-track { flex: 1; height: 22px; background: #f0ebe3; position: relative; overflow: hidden; }

  .bar-fill {
    height: 100%; background: var(--teal); transition: width 0.6s cubic-bezier(0.16, 1, 0.3, 1);
    position: relative;
  }

  .bar-fill.accent { background: var(--accent); }

  .bar-val {
    font-size: 0.65rem; font-weight: 500; width: 28px; text-align: right; flex-shrink: 0;
  }

  /* --- Hospital list --- */
  .hospital-grid {
    display: grid; grid-template-columns: 1fr 1fr; gap: 0;
    max-height: 400px; overflow-y: auto;
  }

  .hospital-grid::-webkit-scrollbar { width: 6px; }
  .hospital-grid::-webkit-scrollbar-track { background: transparent; }
  .hospital-grid::-webkit-scrollbar-thumb { background: var(--border); }

  .hospital-item {
    padding: 0.6rem 0.8rem; border-bottom: 1px solid #f0ebe3;
    font-size: 0.75rem; transition: background 0.15s;
  }

  .hospital-item:hover { background: #F9F5EF; }

  .hospital-item .h-name { font-weight: 500; margin-bottom: 0.15rem; }
  .hospital-item .h-addr { color: var(--ink-muted); font-size: 0.65rem; }

  /* --- Patient list --- */
  .patient-row {
    display: flex; align-items: center; justify-content: space-between;
    padding: 0.6rem 0; border-bottom: 1px solid #f0ebe3; font-size: 0.8rem;
  }

  .patient-row:last-child { border-bottom: none; }
  .patient-row .p-name { font-weight: 500; }
  .patient-row .p-contact { color: var(--ink-muted); font-size: 0.7rem; }

  /* --- Search --- */
  .search-box {
    width: 100%; padding: 0.6rem 0.8rem; border: 1px solid var(--border);
    background: var(--bg); font-family: 'DM Mono', monospace; font-size: 0.8rem;
    margin-bottom: 1rem; outline: none; transition: border-color 0.2s;
  }

  .search-box:focus { border-color: var(--teal); }
  .search-box::placeholder { color: #B8B0A4; }

  /* --- Tabs --- */
  .tabs { display: flex; gap: 0; margin-bottom: 1.2rem; border-bottom: 1px solid var(--border); }

  .tab {
    padding: 0.5rem 1rem; font-size: 0.7rem; text-transform: uppercase;
    letter-spacing: 0.08em; cursor: pointer; border-bottom: 2px solid transparent;
    color: var(--ink-muted); transition: all 0.2s; font-family: 'DM Mono', monospace;
    background: none; border-top: none; border-left: none; border-right: none;
  }

  .tab:hover { color: var(--ink); }
  .tab.active { color: var(--ink); border-bottom-color: var(--accent); }

  .tab-content { display: none; }
  .tab-content.active { display: block; }

  /* --- Animations --- */
  @keyframes slideUp {
    from { opacity: 0; transform: translateY(12px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .stat { animation: slideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) backwards; }
  .stat:nth-child(1) { animation-delay: 0s; }
  .stat:nth-child(2) { animation-delay: 0.06s; }
  .stat:nth-child(3) { animation-delay: 0.12s; }
  .stat:nth-child(4) { animation-delay: 0.18s; }
  .stat:nth-child(5) { animation-delay: 0.24s; }
  .stat:nth-child(4) { animation-delay: 0.18s; }

  .card { animation: slideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) 0.25s backwards; }

  @media (max-width: 768px) {
    .shell { padding: 1.5rem 1rem; }
    .stats { grid-template-columns: repeat(2, 1fr); }
    .grid { grid-template-columns: 1fr; }
    .grid.triple { grid-template-columns: 1fr; }
    .hospital-grid { grid-template-columns: 1fr; }
    header h1 { font-size: 2rem; }
  }
</style>
</head>
<body>
<div class="noise"></div>
<div class="shell">
  <header>
    <h1>Turnos <em>PY</em></h1>
    <div class="meta">${new Date().toLocaleDateString("es-PY", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</div>
  </header>

  <div class="stats">
    <div class="stat">
      <div class="label">Hospitales</div>
      <div class="value">${stats.hospitals}</div>
    </div>
    <div class="stat">
      <div class="label">Pacientes</div>
      <div class="value">${stats.patients}</div>
    </div>
    <div class="stat">
      <div class="label">Doctores</div>
      <div class="value">${stats.doctors}</div>
    </div>
    <div class="stat">
      <div class="label">Turnos Activos</div>
      <div class="value">${stats.scheduled}</div>
    </div>
    <div class="stat">
      <div class="label">Cancelados</div>
      <div class="value">${stats.cancelled}</div>
    </div>
  </div>

  <div class="grid">
    <div class="card">
      <div class="card-title">
        Especialidades
        <span class="badge">${specialtyBreakdown.length} activas</span>
      </div>
      ${(specialtyBreakdown as { specialty: string; count: number }[]).map((s) => {
        const max = Math.max(...(specialtyBreakdown as { count: number }[]).map((x) => x.count));
        return `<div class="bar-row">
          <div class="bar-label">${s.specialty}</div>
          <div class="bar-track"><div class="bar-fill accent" style="width:${(s.count / max) * 100}%"></div></div>
          <div class="bar-val">${s.count}</div>
        </div>`;
      }).join("")}
    </div>
    <div class="card">
      <div class="card-title">
        Hospitales con más turnos
        <span class="badge">Top 10</span>
      </div>
      ${(topHospitals as { name: string; count: number }[]).map((h) => {
        const max = Math.max(...(topHospitals as { count: number }[]).map((x) => x.count));
        return `<div class="bar-row">
          <div class="bar-label" title="${h.name}">${h.name}</div>
          <div class="bar-track"><div class="bar-fill" style="width:${(h.count / max) * 100}%"></div></div>
          <div class="bar-val">${h.count}</div>
        </div>`;
      }).join("")}
    </div>
  </div>

  <div class="card" style="margin-bottom: 2.5rem;">
    <div class="card-title">Turnos</div>
    <div style="overflow-x: auto;">
      <table class="appointments-table">
        <thead><tr>
          <th>Fecha</th><th>Hora</th><th>Paciente</th><th>Doctor</th>
          <th>Especialidad</th><th>Hospital</th><th>Estado</th>
        </tr></thead>
        <tbody>
          ${(appointments as { date: string; time: string; patient_name: string; doctor_name: string; specialty: string; hospital_name: string; status: string }[]).map((a) => `<tr>
            <td>${a.date}</td>
            <td>${a.time}</td>
            <td>${a.patient_name}</td>
            <td>${a.doctor_name}</td>
            <td><span class="specialty-tag">${a.specialty}</span></td>
            <td>${a.hospital_name}</td>
            <td><span class="pill ${a.status}">${a.status === "scheduled" ? "activo" : "cancelado"}</span></td>
          </tr>`).join("")}
        </tbody>
      </table>
    </div>
  </div>

  <div class="grid">
    <div class="card">
      <div class="card-title">Hospitales <span class="badge">${stats.hospitals}</span></div>
      <input type="text" class="search-box" placeholder="Buscar hospital..." id="hospital-search">
      <div class="hospital-grid" id="hospital-list">
        ${(hospitals as { name: string; address: string }[]).map((h) => `<div class="hospital-item" data-name="${h.name.toLowerCase()}">
          <div class="h-name">${h.name}</div>
          <div class="h-addr">${h.address}</div>
        </div>`).join("")}
      </div>
    </div>
    <div class="card">
      <div class="card-title">Pacientes <span class="badge">${stats.patients}</span></div>
      ${(patients as { name: string; email: string; phone: string }[]).map((p) => `<div class="patient-row">
        <div>
          <div class="p-name">${p.name}</div>
          <div class="p-contact">${p.email}</div>
        </div>
        <div class="p-contact">${p.phone}</div>
      </div>`).join("")}
    </div>
  </div>
</div>

<script>
document.getElementById('hospital-search').addEventListener('input', function() {
  const q = this.value.toLowerCase();
  document.querySelectorAll('.hospital-item').forEach(function(el) {
    el.style.display = el.dataset.name.includes(q) ? '' : 'none';
  });
});
</script>
</body>
</html>`;
}

const server = createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(renderPage());
});

server.listen(PORT, () => {
  console.log(`Dashboard running at http://localhost:${PORT}`);
});
