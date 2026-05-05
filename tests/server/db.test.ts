import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { randomUUID } from "node:crypto";

// We'll import from the new server/db.ts module once it exists.
// For now, define the expected API shape and test against it.
import {
  initDb,
  getDb,
  listHospitals,
  insertHospital,
  insertDoctor,
  listDoctors,
  registerPatient,
  listPatients,
  createAppointment,
  listAppointments,
  cancelAppointment,
} from "../../server/db.js";

function seedTestDb(db: Database.Database) {
  const hospitalId = insertHospital(db, {
    name: "Hospital Central",
    address: "Asunción, Paraguay",
    lat: -25.28,
    lng: -57.63,
  });
  const hospital2Id = insertHospital(db, {
    name: "Hospital Regional",
    address: "Ciudad del Este, Paraguay",
    lat: -25.51,
    lng: -54.61,
  });
  const doctorId = insertDoctor(db, {
    name: "Dr. María López",
    specialty: "Cardiología",
    hospital_id: hospitalId,
  });
  const doctor2Id = insertDoctor(db, {
    name: "Dr. Carlos Ruiz",
    specialty: "Traumatología",
    hospital_id: hospital2Id,
  });
  const patient = registerPatient(db, {
    name: "Juan Pérez",
    email: "juan@test.com",
    phone: "+595 21 555-0001",
  });
  if (!patient.ok) throw new Error("Failed to seed patient");

  return { hospitalId, hospital2Id, doctorId, doctor2Id, patientId: patient.patient.id };
}

describe("initDb", () => {
  it("creates all 4 tables", () => {
    const db = initDb(":memory:");
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
      .all() as { name: string }[];
    const names = tables.map((t) => t.name);
    expect(names).toContain("hospitals");
    expect(names).toContain("patients");
    expect(names).toContain("doctors");
    expect(names).toContain("appointments");
    db.close();
  });
});

describe("getDb", () => {
  afterEach(() => {
    // Reset singleton between tests
    (globalThis as any).__turnos_db = undefined;
  });

  it("returns a Database instance", () => {
    const db = getDb(":memory:");
    expect(db).toBeInstanceOf(Database);
    db.close();
  });

  it("returns the same instance on repeated calls", () => {
    const db1 = getDb(":memory:");
    const db2 = getDb(":memory:");
    expect(db1).toBe(db2);
    db1.close();
  });
});

describe("hospitals", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = initDb(":memory:");
  });

  afterEach(() => {
    db.close();
    (globalThis as any).__turnos_db = undefined;
  });

  it("inserts and lists hospitals", () => {
    insertHospital(db, { name: "Test Hospital", address: "Test St", lat: -25.0, lng: -57.0 });
    const hospitals = listHospitals(db);
    expect(hospitals).toHaveLength(1);
    expect(hospitals[0]).toMatchObject({ name: "Test Hospital", address: "Test St" });
    expect(hospitals[0].id).toBeTruthy();
  });

  it("filters by name", () => {
    insertHospital(db, { name: "Hospital Central", address: "A", lat: -25.0, lng: -57.0 });
    insertHospital(db, { name: "Clinica Norte", address: "B", lat: -25.0, lng: -57.0 });
    const results = listHospitals(db, { name: "Central" });
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe("Hospital Central");
  });

  it("sorts by distance when lat/lng provided", () => {
    insertHospital(db, { name: "Far", address: "A", lat: -30.0, lng: -57.0 });
    insertHospital(db, { name: "Near", address: "B", lat: -25.28, lng: -57.63 });
    const results = listHospitals(db, { lat: -25.28, lng: -57.63 });
    expect(results[0].name).toBe("Near");
    expect(results[0].distance_km).toBeDefined();
  });
});

describe("doctors", () => {
  let db: Database.Database;
  let hospitalId: string;

  beforeEach(() => {
    db = initDb(":memory:");
    hospitalId = insertHospital(db, { name: "Hospital Central", address: "A", lat: -25.0, lng: -57.0 });
  });

  afterEach(() => {
    db.close();
    (globalThis as any).__turnos_db = undefined;
  });

  it("inserts and lists doctors with hospital name", () => {
    insertDoctor(db, { name: "Dr. Test", specialty: "Cardiología", hospital_id: hospitalId });
    const doctors = listDoctors(db);
    expect(doctors).toHaveLength(1);
    expect(doctors[0]).toMatchObject({
      name: "Dr. Test",
      specialty: "Cardiología",
      hospital_name: "Hospital Central",
    });
  });

  it("filters by specialty", () => {
    insertDoctor(db, { name: "Dr. A", specialty: "Cardiología", hospital_id: hospitalId });
    insertDoctor(db, { name: "Dr. B", specialty: "Pediatría", hospital_id: hospitalId });
    const results = listDoctors(db, { specialty: "Cardio" });
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe("Dr. A");
  });

  it("filters by hospital_id", () => {
    const h2 = insertHospital(db, { name: "Other", address: "B", lat: -25.0, lng: -57.0 });
    insertDoctor(db, { name: "Dr. A", specialty: "Cardiología", hospital_id: hospitalId });
    insertDoctor(db, { name: "Dr. B", specialty: "Cardiología", hospital_id: h2 });
    const results = listDoctors(db, { hospital_id: hospitalId });
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe("Dr. A");
  });
});

describe("patients", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = initDb(":memory:");
  });

  afterEach(() => {
    db.close();
    (globalThis as any).__turnos_db = undefined;
  });

  it("registers a patient with only name", () => {
    const result = registerPatient(db, { name: "Test Patient" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.patient.name).toBe("Test Patient");
      expect(result.patient.id).toBeTruthy();
    }
  });

  it("rejects duplicate email", () => {
    registerPatient(db, { name: "A", email: "dup@test.com" });
    const result = registerPatient(db, { name: "B", email: "dup@test.com" });
    expect(result.ok).toBe(false);
  });

  it("lists and searches patients", () => {
    registerPatient(db, { name: "Juan Pérez", email: "juan@test.com" });
    registerPatient(db, { name: "Ana García", email: "ana@test.com" });
    expect(listPatients(db)).toHaveLength(2);
    expect(listPatients(db, "Juan")).toHaveLength(1);
    expect(listPatients(db, "ana@test")).toHaveLength(1);
  });
});

describe("appointments", () => {
  let db: Database.Database;
  let seed: ReturnType<typeof seedTestDb>;

  beforeEach(() => {
    db = initDb(":memory:");
    seed = seedTestDb(db);
  });

  afterEach(() => {
    db.close();
    (globalThis as any).__turnos_db = undefined;
  });

  it("creates an appointment", () => {
    const result = createAppointment(db, {
      hospital_id: seed.hospitalId,
      patient_id: seed.patientId,
      doctor_id: seed.doctorId,
      date: "2026-05-10",
      time: "09:00",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.appointment.status).toBe("scheduled");
    }
  });

  it("rejects double-booking same doctor/date/time", () => {
    createAppointment(db, {
      hospital_id: seed.hospitalId,
      patient_id: seed.patientId,
      doctor_id: seed.doctorId,
      date: "2026-05-10",
      time: "09:00",
    });
    const result = createAppointment(db, {
      hospital_id: seed.hospitalId,
      patient_id: seed.patientId,
      doctor_id: seed.doctorId,
      date: "2026-05-10",
      time: "09:00",
    });
    expect(result.ok).toBe(false);
  });

  it("rejects unknown doctor", () => {
    const result = createAppointment(db, {
      hospital_id: seed.hospitalId,
      patient_id: seed.patientId,
      doctor_id: randomUUID(),
      date: "2026-05-10",
      time: "09:00",
    });
    expect(result.ok).toBe(false);
  });

  it("rejects doctor at wrong hospital", () => {
    const result = createAppointment(db, {
      hospital_id: seed.hospital2Id,
      patient_id: seed.patientId,
      doctor_id: seed.doctorId, // belongs to hospitalId, not hospital2Id
      date: "2026-05-10",
      time: "09:00",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("does not practice");
    }
  });

  it("lists appointments with filters", () => {
    createAppointment(db, {
      hospital_id: seed.hospitalId,
      patient_id: seed.patientId,
      doctor_id: seed.doctorId,
      date: "2026-05-10",
      time: "09:00",
    });
    const all = listAppointments(db, {});
    expect(all).toHaveLength(1);
    expect(all[0].doctor_name).toBe("Dr. María López");
    expect(all[0].patient_name).toBe("Juan Pérez");
    expect(all[0].hospital_name).toBe("Hospital Central");

    const byDate = listAppointments(db, { date: "2026-05-11" });
    expect(byDate).toHaveLength(0);
  });

  it("cancels an appointment", () => {
    const created = createAppointment(db, {
      hospital_id: seed.hospitalId,
      patient_id: seed.patientId,
      doctor_id: seed.doctorId,
      date: "2026-05-10",
      time: "09:00",
    });
    if (!created.ok) throw new Error("Setup failed");

    const result = cancelAppointment(db, created.appointment.id);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.appointment.status).toBe("cancelled");
    }

    // double-cancel should fail
    const again = cancelAppointment(db, created.appointment.id);
    expect(again.ok).toBe(false);
  });
});
