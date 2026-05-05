import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import {
  initDb,
  insertHospital,
  insertDoctor,
  registerPatient,
  createAppointment,
  listHospitals,
  listDoctors,
  listPatients,
  listAppointments,
} from "../../server/db.js";

function seedAll(db: Database.Database) {
  const h1 = insertHospital(db, { name: "Hospital Central", address: "Asunción", lat: -25.28, lng: -57.63 });
  const h2 = insertHospital(db, { name: "Clinica Norte", address: "CDE", lat: -25.51, lng: -54.61 });
  const d1 = insertDoctor(db, { name: "Dr. López", specialty: "Cardiología", hospital_id: h1 });
  const d2 = insertDoctor(db, { name: "Dr. Ruiz", specialty: "Pediatría", hospital_id: h2 });
  const p1 = registerPatient(db, { name: "Juan Pérez", email: "juan@test.com" });
  const p2 = registerPatient(db, { name: "Ana García" });
  if (!p1.ok || !p2.ok) throw new Error("seed failed");

  createAppointment(db, { hospital_id: h1, patient_id: p1.patient.id, doctor_id: d1, date: "2026-05-10", time: "09:00" });
  createAppointment(db, { hospital_id: h2, patient_id: p2.patient.id, doctor_id: d2, date: "2026-05-11", time: "10:00" });

  return { h1, h2, d1, d2, p1: p1.patient.id, p2: p2.patient.id };
}

describe("dashboard loader data", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = initDb(":memory:");
    seedAll(db);
  });
  afterEach(() => {
    db.close();
    (globalThis as any).__turnos_db = undefined;
  });

  it("returns correct stats", () => {
    const hospitals = (db.prepare("SELECT COUNT(*) as n FROM hospitals").get() as { n: number }).n;
    const patients = (db.prepare("SELECT COUNT(*) as n FROM patients").get() as { n: number }).n;
    const doctors = (db.prepare("SELECT COUNT(*) as n FROM doctors").get() as { n: number }).n;
    const scheduled = (db.prepare("SELECT COUNT(*) as n FROM appointments WHERE status = 'scheduled'").get() as { n: number }).n;

    expect(hospitals).toBe(2);
    expect(patients).toBe(2);
    expect(doctors).toBe(2);
    expect(scheduled).toBe(2);
  });

  it("returns specialty breakdown", () => {
    const breakdown = db
      .prepare(
        `SELECT d.specialty, COUNT(*) as count FROM appointments a JOIN doctors d ON a.doctor_id = d.id WHERE a.status = 'scheduled' GROUP BY d.specialty ORDER BY count DESC`
      )
      .all() as { specialty: string; count: number }[];
    expect(breakdown).toHaveLength(2);
    expect(breakdown[0].specialty).toBeTruthy();
    expect(breakdown[0].count).toBe(1);
  });
});

describe("hospital loader", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = initDb(":memory:");
    seedAll(db);
  });
  afterEach(() => {
    db.close();
    (globalThis as any).__turnos_db = undefined;
  });

  it("returns all hospitals when no search", () => {
    expect(listHospitals(db)).toHaveLength(2);
  });

  it("filters by name via search param", () => {
    const results = listHospitals(db, { name: "Central" });
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe("Hospital Central");
  });
});

describe("doctors loader", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = initDb(":memory:");
    seedAll(db);
  });
  afterEach(() => {
    db.close();
    (globalThis as any).__turnos_db = undefined;
  });

  it("returns all doctors", () => {
    expect(listDoctors(db)).toHaveLength(2);
  });

  it("filters by specialty", () => {
    const results = listDoctors(db, { specialty: "Cardio" });
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe("Dr. López");
  });
});

describe("patients loader", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = initDb(":memory:");
    seedAll(db);
  });
  afterEach(() => {
    db.close();
    (globalThis as any).__turnos_db = undefined;
  });

  it("returns all patients", () => {
    expect(listPatients(db)).toHaveLength(2);
  });

  it("searches by name", () => {
    expect(listPatients(db, "Juan")).toHaveLength(1);
  });
});

describe("appointments loader", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = initDb(":memory:");
    seedAll(db);
  });
  afterEach(() => {
    db.close();
    (globalThis as any).__turnos_db = undefined;
  });

  it("returns all scheduled appointments", () => {
    const all = listAppointments(db, {});
    expect(all).toHaveLength(2);
    expect(all[0].doctor_name).toBeTruthy();
    expect(all[0].patient_name).toBeTruthy();
    expect(all[0].hospital_name).toBeTruthy();
  });

  it("filters by date", () => {
    expect(listAppointments(db, { date: "2026-05-10" })).toHaveLength(1);
    expect(listAppointments(db, { date: "2026-05-12" })).toHaveLength(0);
  });

  it("filters by status", () => {
    expect(listAppointments(db, { status: "cancelled" })).toHaveLength(0);
  });
});
