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

interface Patient {
  id: string;
  name: string;
  email: string;
  phone: string;
  created_at: string;
}

interface Appointment {
  id: string;
  hospital_id: string;
  hospital_name?: string;
  patient_id: string;
  patient_name?: string;
  doctor: string;
  date: string;
  time: string;
  specialty: string;
  status: string;
  created_at: string;
}

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

    CREATE TABLE IF NOT EXISTS patients (
      id         TEXT PRIMARY KEY,
      name       TEXT NOT NULL,
      email      TEXT NOT NULL UNIQUE,
      phone      TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS appointments (
      id          TEXT PRIMARY KEY,
      hospital_id TEXT NOT NULL REFERENCES hospitals(id),
      patient_id  TEXT NOT NULL REFERENCES patients(id),
      doctor      TEXT NOT NULL,
      date        TEXT NOT NULL,
      time        TEXT NOT NULL,
      specialty   TEXT NOT NULL,
      status      TEXT NOT NULL DEFAULT 'scheduled',
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  return db;
}

export function insertHospital(
  db: Database.Database,
  params: { name: string; address: string; lat: number; lng: number }
): string {
  const id = randomUUID();
  db.prepare("INSERT INTO hospitals (id, name, address, lat, lng) VALUES (?, ?, ?, ?, ?)").run(id, params.name, params.address, params.lat, params.lng);
  return id;
}

export function listHospitals(db: Database.Database, opts: { name?: string; lat?: number; lng?: number } = {}): (Hospital & { distance_km?: number })[] {
  let rows: Hospital[];
  if (opts.name) {
    rows = db.prepare("SELECT * FROM hospitals WHERE name LIKE ?").all(`%${opts.name}%`) as Hospital[];
  } else {
    rows = db.prepare("SELECT * FROM hospitals").all() as Hospital[];
  }
  if (opts.lat !== undefined && opts.lng !== undefined) {
    return rows
      .map((h) => ({ ...h, distance_km: Math.round(haversineKm(opts.lat!, opts.lng!, h.lat, h.lng) * 10) / 10 }))
      .sort((a, b) => a.distance_km - b.distance_km);
  }
  return rows;
}

export function registerPatient(
  db: Database.Database,
  params: { name: string; email: string; phone: string }
): { ok: true; patient: Patient } | { ok: false; error: string } {
  const existing = db.prepare("SELECT id FROM patients WHERE email = ?").get(params.email) as Patient | undefined;
  if (existing) return { ok: false, error: `A patient with email ${params.email} is already registered.` };

  const id = randomUUID();
  db.prepare("INSERT INTO patients (id, name, email, phone) VALUES (?, ?, ?, ?)").run(id, params.name, params.email, params.phone);
  return { ok: true, patient: { id, ...params, created_at: new Date().toISOString() } };
}

export function listPatients(
  db: Database.Database,
  search?: string
): Patient[] {
  if (search) {
    const pattern = `%${search}%`;
    return db.prepare("SELECT * FROM patients WHERE name LIKE ? OR email LIKE ? ORDER BY name").all(pattern, pattern) as Patient[];
  }
  return db.prepare("SELECT * FROM patients ORDER BY name").all() as Patient[];
}

export function createAppointment(
  db: Database.Database,
  params: { hospital_id: string; patient_id: string; doctor: string; date: string; time: string; specialty: string }
): { ok: true; appointment: Appointment } | { ok: false; error: string } {
  const hospital = db.prepare("SELECT id FROM hospitals WHERE id = ?").get(params.hospital_id) as Hospital | undefined;
  if (!hospital) return { ok: false, error: `Hospital not found: ${params.hospital_id}` };

  const patient = db.prepare("SELECT id FROM patients WHERE id = ?").get(params.patient_id) as Patient | undefined;
  if (!patient) return { ok: false, error: `Patient not found: ${params.patient_id}. Register them first with register_patient.` };

  const conflict = db
    .prepare(
      "SELECT id FROM appointments WHERE hospital_id = ? AND doctor = ? AND date = ? AND time = ? AND status = 'scheduled'"
    )
    .get(params.hospital_id, params.doctor, params.date, params.time);
  if (conflict) return { ok: false, error: `Doctor ${params.doctor} already has an appointment at ${params.date} ${params.time} at this hospital.` };

  const id = randomUUID();
  db.prepare(
    "INSERT INTO appointments (id, hospital_id, patient_id, doctor, date, time, specialty) VALUES (?, ?, ?, ?, ?, ?, ?)"
  ).run(id, params.hospital_id, params.patient_id, params.doctor, params.date, params.time, params.specialty);

  return { ok: true, appointment: { id, ...params, status: "scheduled", created_at: new Date().toISOString() } };
}

export function listAppointments(
  db: Database.Database,
  filters: { hospital_id?: string; date?: string; doctor?: string; patient_id?: string; status?: string }
): Appointment[] {
  const conditions: string[] = [];
  const values: unknown[] = [];

  if (filters.hospital_id) { conditions.push("a.hospital_id = ?"); values.push(filters.hospital_id); }
  if (filters.date) { conditions.push("a.date = ?"); values.push(filters.date); }
  if (filters.doctor) { conditions.push("a.doctor = ?"); values.push(filters.doctor); }
  if (filters.patient_id) { conditions.push("a.patient_id = ?"); values.push(filters.patient_id); }
  conditions.push("a.status = ?");
  values.push(filters.status ?? "scheduled");

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  return db
    .prepare(`SELECT a.*, h.name as hospital_name, p.name as patient_name FROM appointments a JOIN hospitals h ON a.hospital_id = h.id JOIN patients p ON a.patient_id = p.id ${where} ORDER BY a.date, a.time`)
    .all(...values) as Appointment[];
}

export function cancelAppointment(
  db: Database.Database,
  id: string
): { ok: true; appointment: Appointment } | { ok: false; error: string } {
  const row = db.prepare("SELECT a.*, h.name as hospital_name, p.name as patient_name FROM appointments a JOIN hospitals h ON a.hospital_id = h.id JOIN patients p ON a.patient_id = p.id WHERE a.id = ?").get(id) as Appointment | undefined;
  if (!row) return { ok: false, error: "Appointment not found." };
  if (row.status === "cancelled") return { ok: false, error: "Appointment is already cancelled." };

  db.prepare("UPDATE appointments SET status = 'cancelled' WHERE id = ?").run(id);
  return { ok: true, appointment: { ...row, status: "cancelled" } };
}
