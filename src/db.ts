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

interface Doctor {
  id: string;
  name: string;
  specialty: string;
  hospital_id: string;
  hospital_name?: string;
}

interface Appointment {
  id: string;
  hospital_id: string;
  hospital_name?: string;
  patient_id: string;
  patient_name?: string;
  doctor_id: string;
  doctor_name?: string;
  specialty?: string;
  date: string;
  time: string;
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
      email      TEXT UNIQUE,
      phone      TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS doctors (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      specialty   TEXT NOT NULL,
      hospital_id TEXT NOT NULL REFERENCES hospitals(id)
    );

    CREATE TABLE IF NOT EXISTS appointments (
      id          TEXT PRIMARY KEY,
      hospital_id TEXT NOT NULL REFERENCES hospitals(id),
      patient_id  TEXT NOT NULL REFERENCES patients(id),
      doctor_id   TEXT NOT NULL REFERENCES doctors(id),
      date        TEXT NOT NULL,
      time        TEXT NOT NULL,
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

export function insertDoctor(
  db: Database.Database,
  params: { name: string; specialty: string; hospital_id: string }
): string {
  const id = randomUUID();
  db.prepare("INSERT INTO doctors (id, name, specialty, hospital_id) VALUES (?, ?, ?, ?)").run(id, params.name, params.specialty, params.hospital_id);
  return id;
}

export function listDoctors(
  db: Database.Database,
  filters: { hospital_id?: string; specialty?: string; name?: string } = {}
): Doctor[] {
  const conditions: string[] = [];
  const values: unknown[] = [];

  if (filters.hospital_id) { conditions.push("d.hospital_id = ?"); values.push(filters.hospital_id); }
  if (filters.specialty) { conditions.push("d.specialty LIKE ?"); values.push(`%${filters.specialty}%`); }
  if (filters.name) { conditions.push("d.name LIKE ?"); values.push(`%${filters.name}%`); }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  return db
    .prepare(`SELECT d.*, h.name as hospital_name FROM doctors d JOIN hospitals h ON d.hospital_id = h.id ${where} ORDER BY d.specialty, d.name`)
    .all(...values) as Doctor[];
}

export function registerPatient(
  db: Database.Database,
  params: { name: string; email?: string; phone?: string }
): { ok: true; patient: Patient } | { ok: false; error: string } {
  if (params.email) {
    const existing = db.prepare("SELECT id FROM patients WHERE email = ?").get(params.email) as Patient | undefined;
    if (existing) return { ok: false, error: `A patient with email ${params.email} is already registered.` };
  }

  const id = randomUUID();
  db.prepare("INSERT INTO patients (id, name, email, phone) VALUES (?, ?, ?, ?)").run(id, params.name, params.email ?? null, params.phone ?? null);
  return { ok: true, patient: { id, name: params.name, email: params.email ?? "", phone: params.phone ?? "", created_at: new Date().toISOString() } };
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
  params: { hospital_id: string; patient_id: string; doctor_id: string; date: string; time: string }
): { ok: true; appointment: Appointment } | { ok: false; error: string } {
  const hospital = db.prepare("SELECT id FROM hospitals WHERE id = ?").get(params.hospital_id) as Hospital | undefined;
  if (!hospital) return { ok: false, error: `Hospital not found: ${params.hospital_id}` };

  const patient = db.prepare("SELECT id FROM patients WHERE id = ?").get(params.patient_id) as Patient | undefined;
  if (!patient) return { ok: false, error: `Patient not found: ${params.patient_id}. Register them first with register_patient.` };

  const doctor = db.prepare("SELECT * FROM doctors WHERE id = ?").get(params.doctor_id) as Doctor | undefined;
  if (!doctor) return { ok: false, error: `Doctor not found: ${params.doctor_id}. Use list_doctors to find one.` };

  if (doctor.hospital_id !== params.hospital_id) return { ok: false, error: `Dr. ${doctor.name} does not practice at this hospital.` };

  const conflict = db
    .prepare(
      "SELECT id FROM appointments WHERE doctor_id = ? AND date = ? AND time = ? AND status = 'scheduled'"
    )
    .get(params.doctor_id, params.date, params.time);
  if (conflict) return { ok: false, error: `Dr. ${doctor.name} already has an appointment at ${params.date} ${params.time}.` };

  const id = randomUUID();
  db.prepare(
    "INSERT INTO appointments (id, hospital_id, patient_id, doctor_id, date, time) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(id, params.hospital_id, params.patient_id, params.doctor_id, params.date, params.time);

  return { ok: true, appointment: { id, ...params, status: "scheduled", created_at: new Date().toISOString() } };
}

export function listAppointments(
  db: Database.Database,
  filters: { hospital_id?: string; date?: string; doctor_id?: string; patient_id?: string; status?: string }
): Appointment[] {
  const conditions: string[] = [];
  const values: unknown[] = [];

  if (filters.hospital_id) { conditions.push("a.hospital_id = ?"); values.push(filters.hospital_id); }
  if (filters.date) { conditions.push("a.date = ?"); values.push(filters.date); }
  if (filters.doctor_id) { conditions.push("a.doctor_id = ?"); values.push(filters.doctor_id); }
  if (filters.patient_id) { conditions.push("a.patient_id = ?"); values.push(filters.patient_id); }
  conditions.push("a.status = ?");
  values.push(filters.status ?? "scheduled");

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  return db
    .prepare(`SELECT a.*, h.name as hospital_name, p.name as patient_name, d.name as doctor_name, d.specialty FROM appointments a JOIN hospitals h ON a.hospital_id = h.id JOIN patients p ON a.patient_id = p.id JOIN doctors d ON a.doctor_id = d.id ${where} ORDER BY a.date, a.time`)
    .all(...values) as Appointment[];
}

export function cancelAppointment(
  db: Database.Database,
  id: string
): { ok: true; appointment: Appointment } | { ok: false; error: string } {
  const row = db.prepare("SELECT a.*, h.name as hospital_name, p.name as patient_name, d.name as doctor_name, d.specialty FROM appointments a JOIN hospitals h ON a.hospital_id = h.id JOIN patients p ON a.patient_id = p.id JOIN doctors d ON a.doctor_id = d.id WHERE a.id = ?").get(id) as Appointment | undefined;
  if (!row) return { ok: false, error: "Appointment not found." };
  if (row.status === "cancelled") return { ok: false, error: "Appointment is already cancelled." };

  db.prepare("UPDATE appointments SET status = 'cancelled' WHERE id = ?").run(id);
  return { ok: true, appointment: { ...row, status: "cancelled" } };
}
