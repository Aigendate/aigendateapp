import { describe, it, expect, beforeEach } from "vitest";
import { eq, sql } from "drizzle-orm";
import {
  insertHospital,
  insertDoctor,
  registerPatient,
  createAppointment,
  listHospitals,
  listDoctors,
  listPatients,
  listAppointments,
} from "../../server/db";
import { db } from "../../server/client";
import { appointments, doctors, hospitals, patients } from "../../server/schema";
import { resetDb } from "../helpers/db";

async function tableCount(
  table: typeof hospitals | typeof patients | typeof doctors,
): Promise<number> {
  const [row] = await db.select({ c: sql<number>`count(*)::int` }).from(table);
  return row.c;
}

async function seedAll() {
  const h1 = await insertHospital({ name: "Hospital Central", address: "Asunción", lat: -25.28, lng: -57.63 });
  const h2 = await insertHospital({ name: "Clinica Norte", address: "CDE", lat: -25.51, lng: -54.61 });
  const d1 = await insertDoctor({ name: "Dr. López", specialty: "Cardiología", hospital_id: h1 });
  const d2 = await insertDoctor({ name: "Dr. Ruiz", specialty: "Pediatría", hospital_id: h2 });
  const p1 = await registerPatient({ name: "Juan Pérez", email: "juan@test.com" });
  const p2 = await registerPatient({ name: "Ana García" });
  if (!p1.ok || !p2.ok) throw new Error("seed failed");

  await createAppointment({ hospital_id: h1, patient_id: p1.patient.id, doctor_id: d1, date: "2026-05-10", time: "09:00" });
  await createAppointment({ hospital_id: h2, patient_id: p2.patient.id, doctor_id: d2, date: "2026-05-11", time: "10:00" });

  return { h1, h2, d1, d2, p1: p1.patient.id, p2: p2.patient.id };
}

describe("dashboard loader data", () => {
  beforeEach(async () => {
    await resetDb();
    await seedAll();
  });

  it("returns correct stats", async () => {
    const [hospitalCount, patientCount, doctorCount, scheduledRow] = await Promise.all([
      tableCount(hospitals),
      tableCount(patients),
      tableCount(doctors),
      db
        .select({ c: sql<number>`count(*)::int` })
        .from(appointments)
        .where(eq(appointments.status, "scheduled")),
    ]);

    expect(hospitalCount).toBe(2);
    expect(patientCount).toBe(2);
    expect(doctorCount).toBe(2);
    expect(scheduledRow[0].c).toBe(2);
  });

  it("returns specialty breakdown", async () => {
    const rows = await db
      .select({ specialty: doctors.specialty })
      .from(appointments)
      .innerJoin(doctors, eq(appointments.doctor_id, doctors.id))
      .where(eq(appointments.status, "scheduled"));
    const counts = new Map<string, number>();
    for (const r of rows) {
      counts.set(r.specialty, (counts.get(r.specialty) ?? 0) + 1);
    }
    const breakdown = [...counts.entries()].map(([specialty, count]) => ({ specialty, count }));
    expect(breakdown).toHaveLength(2);
    expect(breakdown[0].count).toBe(1);
  });
});

describe("hospital loader", () => {
  beforeEach(async () => {
    await resetDb();
    await seedAll();
  });

  it("returns all hospitals when no search", async () => {
    expect(await listHospitals()).toHaveLength(2);
  });

  it("filters by name via search param", async () => {
    const results = await listHospitals({ name: "Central" });
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe("Hospital Central");
  });
});

describe("doctors loader", () => {
  beforeEach(async () => {
    await resetDb();
    await seedAll();
  });

  it("returns all doctors", async () => {
    expect(await listDoctors()).toHaveLength(2);
  });

  it("filters by specialty", async () => {
    const results = await listDoctors({ specialty: "Cardio" });
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe("Dr. López");
  });
});

describe("patients loader", () => {
  beforeEach(async () => {
    await resetDb();
    await seedAll();
  });

  it("returns all patients", async () => {
    expect(await listPatients()).toHaveLength(2);
  });

  it("searches by name", async () => {
    expect(await listPatients("Juan")).toHaveLength(1);
  });
});

describe("appointments loader", () => {
  beforeEach(async () => {
    await resetDb();
    await seedAll();
  });

  it("returns all scheduled appointments", async () => {
    const all = await listAppointments({});
    expect(all).toHaveLength(2);
    expect(all[0].doctor_name).toBeTruthy();
    expect(all[0].patient_name).toBeTruthy();
    expect(all[0].hospital_name).toBeTruthy();
  });

  it("filters by date", async () => {
    expect(await listAppointments({ date: "2026-05-10" })).toHaveLength(1);
    expect(await listAppointments({ date: "2026-05-12" })).toHaveLength(0);
  });

  it("filters by status", async () => {
    expect(await listAppointments({ status: "cancelled" })).toHaveLength(0);
  });
});
