import Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

interface Hospital {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
}

interface Appointment {
  id: string;
  hospital_id: string;
  hospital_name?: string;
  patient: string;
  doctor: string;
  date: string;
  time: string;
  specialty: string;
  status: string;
  created_at: string;
}

const SEED_HOSPITALS: Omit<Hospital, "id">[] = [
  { name: "Hospital Central", address: "Av. Corrientes 3200, Buenos Aires", lat: -34.6037, lng: -58.3816 },
  { name: "Clínica Norte", address: "Av. Cabildo 1500, Buenos Aires", lat: -34.5614, lng: -58.4519 },
  { name: "Hospital del Sur", address: "Av. Caseros 2100, Buenos Aires", lat: -34.6345, lng: -58.3990 },
  { name: "Sanatorio del Oeste", address: "Av. Rivadavia 8500, Buenos Aires", lat: -34.6283, lng: -58.4655 },
  { name: "Centro Médico del Este", address: "Av. Libertador 4200, Buenos Aires", lat: -34.5780, lng: -58.4100 },
];

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function initDb(): Database.Database {
  const dbPath = path.join(__dirname, "..", "turnos.db");
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  db.exec(`
    CREATE TABLE IF NOT EXISTS hospitals (
      id      TEXT PRIMARY KEY,
      name    TEXT NOT NULL,
      address TEXT NOT NULL,
      lat     REAL NOT NULL,
      lng     REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS appointments (
      id          TEXT PRIMARY KEY,
      hospital_id TEXT NOT NULL REFERENCES hospitals(id),
      patient     TEXT NOT NULL,
      doctor      TEXT NOT NULL,
      date        TEXT NOT NULL,
      time        TEXT NOT NULL,
      specialty   TEXT NOT NULL,
      status      TEXT NOT NULL DEFAULT 'scheduled',
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  const count = db.prepare("SELECT COUNT(*) as n FROM hospitals").get() as { n: number };
  if (count.n === 0) {
    const insert = db.prepare("INSERT INTO hospitals (id, name, address, lat, lng) VALUES (?, ?, ?, ?, ?)");
    for (const h of SEED_HOSPITALS) {
      insert.run(randomUUID(), h.name, h.address, h.lat, h.lng);
    }
  }

  return db;
}

export function listHospitals(db: Database.Database, lat?: number, lng?: number): (Hospital & { distance_km?: number })[] {
  const rows = db.prepare("SELECT * FROM hospitals").all() as Hospital[];
  if (lat !== undefined && lng !== undefined) {
    return rows
      .map((h) => ({ ...h, distance_km: Math.round(haversineKm(lat, lng, h.lat, h.lng) * 10) / 10 }))
      .sort((a, b) => a.distance_km - b.distance_km);
  }
  return rows;
}

export function createAppointment(
  db: Database.Database,
  params: { hospital_id: string; patient: string; doctor: string; date: string; time: string; specialty: string }
): { ok: true; appointment: Appointment } | { ok: false; error: string } {
  const hospital = db.prepare("SELECT id FROM hospitals WHERE id = ?").get(params.hospital_id) as Hospital | undefined;
  if (!hospital) return { ok: false, error: `Hospital not found: ${params.hospital_id}` };

  const conflict = db
    .prepare(
      "SELECT id FROM appointments WHERE hospital_id = ? AND doctor = ? AND date = ? AND time = ? AND status = 'scheduled'"
    )
    .get(params.hospital_id, params.doctor, params.date, params.time);
  if (conflict) return { ok: false, error: `Doctor ${params.doctor} already has an appointment at ${params.date} ${params.time} at this hospital.` };

  const id = randomUUID();
  db.prepare(
    "INSERT INTO appointments (id, hospital_id, patient, doctor, date, time, specialty) VALUES (?, ?, ?, ?, ?, ?, ?)"
  ).run(id, params.hospital_id, params.patient, params.doctor, params.date, params.time, params.specialty);

  return { ok: true, appointment: { id, ...params, status: "scheduled", created_at: new Date().toISOString() } };
}

export function listAppointments(
  db: Database.Database,
  filters: { hospital_id?: string; date?: string; doctor?: string; patient?: string; status?: string }
): Appointment[] {
  const conditions: string[] = [];
  const values: unknown[] = [];

  if (filters.hospital_id) { conditions.push("a.hospital_id = ?"); values.push(filters.hospital_id); }
  if (filters.date) { conditions.push("a.date = ?"); values.push(filters.date); }
  if (filters.doctor) { conditions.push("a.doctor = ?"); values.push(filters.doctor); }
  if (filters.patient) { conditions.push("a.patient = ?"); values.push(filters.patient); }
  conditions.push("a.status = ?");
  values.push(filters.status ?? "scheduled");

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  return db
    .prepare(`SELECT a.*, h.name as hospital_name FROM appointments a JOIN hospitals h ON a.hospital_id = h.id ${where} ORDER BY a.date, a.time`)
    .all(...values) as Appointment[];
}

export function cancelAppointment(
  db: Database.Database,
  id: string
): { ok: true; appointment: Appointment } | { ok: false; error: string } {
  const row = db.prepare("SELECT a.*, h.name as hospital_name FROM appointments a JOIN hospitals h ON a.hospital_id = h.id WHERE a.id = ?").get(id) as Appointment | undefined;
  if (!row) return { ok: false, error: "Appointment not found." };
  if (row.status === "cancelled") return { ok: false, error: "Appointment is already cancelled." };

  db.prepare("UPDATE appointments SET status = 'cancelled' WHERE id = ?").run(id);
  return { ok: true, appointment: { ...row, status: "cancelled" } };
}
