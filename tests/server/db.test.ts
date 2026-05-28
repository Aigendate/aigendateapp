import { describe, it, expect, beforeEach } from "vitest";
import { randomUUID } from "node:crypto";
import {
  listHospitals,
  insertHospital,
  insertDoctor,
  listDoctors,
  registerPatient,
  listPatients,
  createAppointment,
  listAppointments,
  cancelAppointment,
} from "../../server/db";
import { resetDb } from "../helpers/db";

async function seedTestDb() {
  const hospitalId = await insertHospital({
    name: "Hospital Central",
    address: "Asunción, Paraguay",
    lat: -25.28,
    lng: -57.63,
  });
  const hospital2Id = await insertHospital({
    name: "Hospital Regional",
    address: "Ciudad del Este, Paraguay",
    lat: -25.51,
    lng: -54.61,
  });
  const doctorId = await insertDoctor({
    name: "Dr. María López",
    specialty: "Cardiología",
    hospital_id: hospitalId,
  });
  const doctor2Id = await insertDoctor({
    name: "Dr. Carlos Ruiz",
    specialty: "Traumatología",
    hospital_id: hospital2Id,
  });
  const patient = await registerPatient({
    name: "Juan Pérez",
    email: "juan@test.com",
    phone: "+595 21 555-0001",
  });
  if (!patient.ok) throw new Error("Failed to seed patient");

  return { hospitalId, hospital2Id, doctorId, doctor2Id, patientId: patient.patient.id };
}

describe("hospitals", () => {
  beforeEach(resetDb);

  it("inserts and lists hospitals", async () => {
    await insertHospital({ name: "Test Hospital", address: "Test St", lat: -25.0, lng: -57.0 });
    const hospitals = await listHospitals();
    expect(hospitals).toHaveLength(1);
    expect(hospitals[0]).toMatchObject({ name: "Test Hospital", address: "Test St" });
    expect(hospitals[0].id).toBeTruthy();
  });

  it("filters by name", async () => {
    await insertHospital({ name: "Hospital Central", address: "A", lat: -25.0, lng: -57.0 });
    await insertHospital({ name: "Clinica Norte", address: "B", lat: -25.0, lng: -57.0 });
    const results = await listHospitals({ name: "Central" });
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe("Hospital Central");
  });

  it("sorts by distance when lat/lng provided", async () => {
    await insertHospital({ name: "Far", address: "A", lat: -30.0, lng: -57.0 });
    await insertHospital({ name: "Near", address: "B", lat: -25.28, lng: -57.63 });
    const results = await listHospitals({ lat: -25.28, lng: -57.63 });
    expect(results[0].name).toBe("Near");
    expect(results[0].distance_km).toBeDefined();
  });
});

describe("doctors", () => {
  let hospitalId: string;

  beforeEach(async () => {
    await resetDb();
    hospitalId = await insertHospital({ name: "Hospital Central", address: "A", lat: -25.0, lng: -57.0 });
  });

  it("inserts and lists doctors with hospital name", async () => {
    await insertDoctor({ name: "Dr. Test", specialty: "Cardiología", hospital_id: hospitalId });
    const doctors = await listDoctors();
    expect(doctors).toHaveLength(1);
    expect(doctors[0]).toMatchObject({
      name: "Dr. Test",
      specialty: "Cardiología",
      hospital_name: "Hospital Central",
    });
  });

  it("filters by specialty", async () => {
    await insertDoctor({ name: "Dr. A", specialty: "Cardiología", hospital_id: hospitalId });
    await insertDoctor({ name: "Dr. B", specialty: "Pediatría", hospital_id: hospitalId });
    const results = await listDoctors({ specialty: "Cardio" });
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe("Dr. A");
  });

  it("filters by hospital_id", async () => {
    const h2 = await insertHospital({ name: "Other", address: "B", lat: -25.0, lng: -57.0 });
    await insertDoctor({ name: "Dr. A", specialty: "Cardiología", hospital_id: hospitalId });
    await insertDoctor({ name: "Dr. B", specialty: "Cardiología", hospital_id: h2 });
    const results = await listDoctors({ hospital_id: hospitalId });
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe("Dr. A");
  });
});

describe("patients", () => {
  beforeEach(resetDb);

  it("registers a patient with only name", async () => {
    const result = await registerPatient({ name: "Test Patient" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.patient.name).toBe("Test Patient");
      expect(result.patient.id).toBeTruthy();
    }
  });

  it("rejects duplicate email", async () => {
    await registerPatient({ name: "A", email: "dup@test.com" });
    const result = await registerPatient({ name: "B", email: "dup@test.com" });
    expect(result.ok).toBe(false);
  });

  it("lists and searches patients", async () => {
    await registerPatient({ name: "Juan Pérez", email: "juan@test.com" });
    await registerPatient({ name: "Ana García", email: "ana@test.com" });
    expect(await listPatients()).toHaveLength(2);
    expect(await listPatients("Juan")).toHaveLength(1);
    expect(await listPatients("ana@test")).toHaveLength(1);
  });
});

describe("appointments", () => {
  let seed: Awaited<ReturnType<typeof seedTestDb>>;

  beforeEach(async () => {
    await resetDb();
    seed = await seedTestDb();
  });

  it("creates an appointment", async () => {
    const result = await createAppointment({
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

  it("rejects double-booking same doctor/date/time", async () => {
    await createAppointment({
      hospital_id: seed.hospitalId,
      patient_id: seed.patientId,
      doctor_id: seed.doctorId,
      date: "2026-05-10",
      time: "09:00",
    });
    const result = await createAppointment({
      hospital_id: seed.hospitalId,
      patient_id: seed.patientId,
      doctor_id: seed.doctorId,
      date: "2026-05-10",
      time: "09:00",
    });
    expect(result.ok).toBe(false);
  });

  it("rejects unknown doctor", async () => {
    const result = await createAppointment({
      hospital_id: seed.hospitalId,
      patient_id: seed.patientId,
      doctor_id: randomUUID(),
      date: "2026-05-10",
      time: "09:00",
    });
    expect(result.ok).toBe(false);
  });

  it("rejects doctor at wrong hospital", async () => {
    const result = await createAppointment({
      hospital_id: seed.hospital2Id,
      patient_id: seed.patientId,
      doctor_id: seed.doctorId,
      date: "2026-05-10",
      time: "09:00",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("does not practice");
    }
  });

  it("lists appointments with filters", async () => {
    await createAppointment({
      hospital_id: seed.hospitalId,
      patient_id: seed.patientId,
      doctor_id: seed.doctorId,
      date: "2026-05-10",
      time: "09:00",
    });
    const all = await listAppointments({});
    expect(all).toHaveLength(1);
    expect(all[0].doctor_name).toBe("Dr. María López");
    expect(all[0].patient_name).toBe("Juan Pérez");
    expect(all[0].hospital_name).toBe("Hospital Central");

    const byDate = await listAppointments({ date: "2026-05-11" });
    expect(byDate).toHaveLength(0);
  });

  it("cancels an appointment", async () => {
    const created = await createAppointment({
      hospital_id: seed.hospitalId,
      patient_id: seed.patientId,
      doctor_id: seed.doctorId,
      date: "2026-05-10",
      time: "09:00",
    });
    if (!created.ok) throw new Error("Setup failed");

    const result = await cancelAppointment(created.appointment.id);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.appointment.status).toBe("cancelled");
    }

    const again = await cancelAppointment(created.appointment.id);
    expect(again.ok).toBe(false);
  });
});
