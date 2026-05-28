"use server";

import { revalidatePath } from "next/cache";
import { and, asc, desc, eq, gte, lte, or, sql } from "drizzle-orm";
import { db } from "../../../server/client";
import {
  hospitals,
  doctors,
  patients,
  appointments,
  doctor_schedules,
  waitlist_entries,
} from "../../../server/schema";
import {
  createAppointment as createAppointmentValidated,
  rescheduleAppointment as rescheduleAppointmentSafe,
  addToWaitlist,
  getAvailableSlots as getAvailableSlotsHelper,
  isUniqueViolation,
  SCHEDULED_SLOT_INDEX,
} from "../../../server/db";
import { requireAdmin } from "./auth";

// The slot-computation logic moved into server/db.ts; this thin wrapper keeps
// the existing admin server action so admin components don't need to change.
export async function getAvailableSlots(doctorId: string, date: string): Promise<string[]> {
  await requireAdmin();
  return getAvailableSlotsHelper(doctorId, date);
}

function revalidateAdmin() {
  revalidatePath("/admin", "layout");
}

// --- Pacientes ---

export async function createPatient(formData: FormData) {
  await requireAdmin();
  await db.insert(patients).values({
    name: formData.get("name") as string,
    email: (formData.get("email") as string) || null,
    phone: (formData.get("phone") as string) || null,
  });
  revalidateAdmin();
}

export async function updatePatient(formData: FormData) {
  await requireAdmin();
  const id = formData.get("id") as string;
  await db
    .update(patients)
    .set({
      name: formData.get("name") as string,
      email: (formData.get("email") as string) || null,
      phone: (formData.get("phone") as string) || null,
    })
    .where(eq(patients.id, id));
  revalidateAdmin();
}

export async function deletePatient(formData: FormData) {
  await requireAdmin();
  const id = formData.get("id") as string;
  await db.delete(patients).where(eq(patients.id, id));
  revalidateAdmin();
}

// --- Hospitales ---

export async function createHospital(formData: FormData) {
  await requireAdmin();
  await db.insert(hospitals).values({
    name: formData.get("name") as string,
    address: formData.get("address") as string,
    city: (formData.get("city") as string) || null,
    lat: parseFloat(formData.get("lat") as string) || 0,
    lng: parseFloat(formData.get("lng") as string) || 0,
  });
  revalidateAdmin();
}

export async function updateHospital(formData: FormData) {
  await requireAdmin();
  const id = formData.get("id") as string;
  await db
    .update(hospitals)
    .set({
      name: formData.get("name") as string,
      address: formData.get("address") as string,
      city: (formData.get("city") as string) || null,
      lat: parseFloat(formData.get("lat") as string) || 0,
      lng: parseFloat(formData.get("lng") as string) || 0,
    })
    .where(eq(hospitals.id, id));
  revalidateAdmin();
}

export async function deleteHospital(formData: FormData) {
  await requireAdmin();
  const id = formData.get("id") as string;
  await db.delete(hospitals).where(eq(hospitals.id, id));
  revalidateAdmin();
}

// --- Doctores ---

export async function createDoctor(formData: FormData) {
  await requireAdmin();
  await db.insert(doctors).values({
    name: formData.get("name") as string,
    specialty: formData.get("specialty") as string,
    hospital_id: formData.get("hospital_id") as string,
  });
  revalidateAdmin();
}

export async function updateDoctor(formData: FormData) {
  await requireAdmin();
  const id = formData.get("id") as string;
  await db
    .update(doctors)
    .set({
      name: formData.get("name") as string,
      specialty: formData.get("specialty") as string,
      hospital_id: formData.get("hospital_id") as string,
    })
    .where(eq(doctors.id, id));
  revalidateAdmin();
}

export async function deleteDoctor(formData: FormData) {
  await requireAdmin();
  const id = formData.get("id") as string;
  await db.delete(doctors).where(eq(doctors.id, id));
  revalidateAdmin();
}

// --- Turnos ---

export async function createAppointment(formData: FormData) {
  await requireAdmin();
  const result = await createAppointmentValidated({
    hospital_id: formData.get("hospital_id") as string,
    patient_id: formData.get("patient_id") as string,
    doctor_id: formData.get("doctor_id") as string,
    date: formData.get("date") as string,
    time: formData.get("time") as string,
  });
  if (!result.ok) throw new Error(result.error);
  revalidateAdmin();
}

export async function cancelAppointment(formData: FormData) {
  await requireAdmin();
  const id = formData.get("id") as string;
  await db.update(appointments).set({ status: "cancelled" }).where(eq(appointments.id, id));
  revalidateAdmin();
}

export async function deleteAppointment(formData: FormData) {
  await requireAdmin();
  const id = formData.get("id") as string;
  await db.delete(appointments).where(eq(appointments.id, id));
  revalidateAdmin();
}

export async function rescheduleAppointment(formData: FormData) {
  await requireAdmin();
  const id = formData.get("id") as string;
  const date = formData.get("date") as string;
  const time = formData.get("time") as string;
  const res = await rescheduleAppointmentSafe(id, date, time);
  if (!res.ok) throw new Error(res.error);
  revalidateAdmin();
}

export async function cancelAndOfferWaitlist(formData: FormData): Promise<{
  ok: boolean;
  message: string;
  candidates: { id: string; patient_name: string; patient_phone: string | null }[];
}> {
  await requireAdmin();
  const id = formData.get("id") as string;

  const [appointment] = await db
    .update(appointments)
    .set({ status: "cancelled" })
    .where(eq(appointments.id, id))
    .returning();

  const [doctor] = await db
    .select({ specialty: doctors.specialty })
    .from(doctors)
    .where(eq(doctors.id, appointment.doctor_id))
    .limit(1);

  const candidates = await db
    .select({
      id: waitlist_entries.id,
      patient_name: patients.name,
      patient_phone: patients.phone,
    })
    .from(waitlist_entries)
    .innerJoin(patients, eq(waitlist_entries.patient_id, patients.id))
    .where(
      and(
        eq(waitlist_entries.status, "waiting"),
        eq(waitlist_entries.specialty, doctor.specialty),
        or(
          eq(waitlist_entries.doctor_id, appointment.doctor_id),
          sql`${waitlist_entries.doctor_id} IS NULL`,
        ),
        lte(waitlist_entries.date_from, appointment.date),
        gte(waitlist_entries.date_to, appointment.date),
      ),
    )
    .orderBy(desc(waitlist_entries.priority), asc(waitlist_entries.created_at))
    .limit(5);

  revalidateAdmin();

  return {
    ok: true,
    message:
      candidates.length > 0
        ? `Turno cancelado. ${candidates.length} paciente(s) en lista de espera.`
        : "Turno cancelado. No hay pacientes en lista de espera para este horario.",
    candidates,
  };
}

export async function offerSlotToWaitlistEntry(formData: FormData) {
  await requireAdmin();
  const waitlistId = formData.get("waitlist_id") as string;
  const appointmentDate = formData.get("date") as string;
  const appointmentTime = formData.get("time") as string;
  const doctorId = formData.get("doctor_id") as string;
  const hospitalId = formData.get("hospital_id") as string;

  const [entry] = await db
    .update(waitlist_entries)
    .set({ status: "offered" })
    .where(eq(waitlist_entries.id, waitlistId))
    .returning();

  try {
    await db.insert(appointments).values({
      patient_id: entry.patient_id,
      doctor_id: doctorId,
      hospital_id: hospitalId,
      date: appointmentDate,
      time: appointmentTime,
    });
  } catch (err) {
    if (isUniqueViolation(err, SCHEDULED_SLOT_INDEX)) {
      // Roll back the waitlist offer if the slot got taken between cancel and offer.
      await db
        .update(waitlist_entries)
        .set({ status: "waiting" })
        .where(eq(waitlist_entries.id, waitlistId));
      throw new Error(`Slot ${appointmentDate} ${appointmentTime} is no longer available.`);
    }
    throw err;
  }

  revalidateAdmin();
}

// --- Lista de Espera ---

export async function createWaitlistEntry(formData: FormData) {
  await requireAdmin();
  await addToWaitlist({
    patient_id: formData.get("patient_id") as string,
    doctor_id: (formData.get("doctor_id") as string) || undefined,
    specialty: formData.get("specialty") as string,
    date_from: formData.get("date_from") as string,
    date_to: formData.get("date_to") as string,
    time_pref: (formData.get("time_pref") as string) || undefined,
    priority: parseInt(formData.get("priority") as string) || 0,
  });
  revalidateAdmin();
}

export async function deleteWaitlistEntry(formData: FormData) {
  await requireAdmin();
  const id = formData.get("id") as string;
  await db.delete(waitlist_entries).where(eq(waitlist_entries.id, id));
  revalidateAdmin();
}

// --- Horarios de Doctor ---

export async function saveDoctorSchedule(formData: FormData) {
  await requireAdmin();
  const doctorId = formData.get("doctor_id") as string;
  const dayOfWeek = parseInt(formData.get("day_of_week") as string);
  const startTime = formData.get("start_time") as string;
  const endTime = formData.get("end_time") as string;
  const slotDuration = parseInt(formData.get("slot_duration") as string) || 30;

  await db
    .insert(doctor_schedules)
    .values({
      doctor_id: doctorId,
      day_of_week: dayOfWeek,
      start_time: startTime,
      end_time: endTime,
      slot_duration: slotDuration,
    })
    .onConflictDoUpdate({
      target: [doctor_schedules.doctor_id, doctor_schedules.day_of_week],
      set: { start_time: startTime, end_time: endTime, slot_duration: slotDuration },
    });
  revalidateAdmin();
}

// --- Turnos Recurrentes ---

export async function createRecurringAppointment(formData: FormData) {
  await requireAdmin();
  const hospitalId = formData.get("hospital_id") as string;
  const patientId = formData.get("patient_id") as string;
  const doctorId = formData.get("doctor_id") as string;
  const startDate = formData.get("date") as string;
  const time = formData.get("time") as string;
  const weeksInterval = parseInt(formData.get("weeks_interval") as string) || 1;
  const occurrences = parseInt(formData.get("occurrences") as string) || 4;

  try {
    await db.transaction(async (tx) => {
      const [parent] = await tx
        .insert(appointments)
        .values({
          hospital_id: hospitalId,
          patient_id: patientId,
          doctor_id: doctorId,
          date: startDate,
          time,
          is_recurring: true,
          recurrence_rule: `weekly:${weeksInterval}`,
        })
        .returning();

      const childData = [];
      for (let i = 1; i < occurrences; i++) {
        const d = new Date(startDate + "T12:00:00");
        d.setDate(d.getDate() + 7 * weeksInterval * i);
        childData.push({
          hospital_id: hospitalId,
          patient_id: patientId,
          doctor_id: doctorId,
          date: d.toISOString().split("T")[0],
          time,
          is_recurring: true,
          recurrence_rule: `weekly:${weeksInterval}`,
          parent_appointment_id: parent.id,
        });
      }
      if (childData.length > 0) {
        await tx.insert(appointments).values(childData);
      }
    });
  } catch (err) {
    if (isUniqueViolation(err, SCHEDULED_SLOT_INDEX)) {
      throw new Error("One of the recurring slots is already booked at that time.");
    }
    throw err;
  }

  revalidateAdmin();
}

// --- Scrape & Seed ---

import { execFile } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";

function runPythonScraper(): Promise<string> {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(process.cwd(), "scraper", "paraguay_hospitals.py");
    execFile("python3", [scriptPath], { timeout: 120_000 }, (err, stdout, stderr) => {
      if (err) reject(new Error(stderr || err.message));
      else resolve(stdout);
    });
  });
}

function parseCsvHospitals(): { name: string; address: string; lat: number; lng: number }[] {
  const csvPath = path.join(process.cwd(), "scraper", "data", "osm_facilities.csv");
  let content: string;
  try {
    content = readFileSync(csvPath, "utf-8");
  } catch {
    return [];
  }

  const lines = content.split("\n").slice(1).filter((l) => l.trim());
  const results: { name: string; address: string; lat: number; lng: number }[] = [];

  for (const line of lines) {
    const cols = line.split(",");
    const name = cols[2]?.trim() || cols[3]?.trim();
    const facilityType = cols[4]?.trim();
    const city = cols[12]?.trim().replace(/^"|"$/g, "");
    const street = cols[13]?.trim().replace(/^"|"$/g, "");
    const lat = parseFloat(cols[14]);
    const lon = parseFloat(cols[15]);

    if (facilityType !== "hospital" || !name) continue;
    if (isNaN(lat) || isNaN(lon)) continue;

    const parts = [street, city, "Paraguay"].filter(Boolean);
    results.push({ name, address: parts.join(", "), lat, lng: lon });
  }
  return results;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function clearAllData() {
  await db.delete(appointments);
  await db.delete(doctors);
  await db.delete(patients);
  await db.delete(hospitals);
}

const SPECIALTIES = [
  "Cardiología", "Traumatología", "Pediatría", "Dermatología", "Neurología",
  "Ginecología", "Medicina General", "Oftalmología", "Urología", "Oncología",
];

const DOCTOR_NAMES = [
  "Dr. María López", "Dr. Carlos Ruiz", "Dr. Sofía Chen", "Dr. Diego Morales",
  "Dr. Laura Vega", "Dr. Alejandro Benítez", "Dr. Gabriela Paredes",
  "Dr. Fernando Acosta", "Dr. Patricia Núñez", "Dr. Ricardo Villalba",
  "Dr. Claudia Giménez", "Dr. Hugo Espínola", "Dr. Lorena Ayala",
  "Dr. Miguel Ángel Rojas", "Dr. Sandra Cabrera", "Dr. Ramón Lezcano",
  "Dr. Verónica Duarte", "Dr. José Luis Arce", "Dr. Andrea Fleitas",
  "Dr. Óscar Domínguez",
];

const PATIENT_NAMES = [
  { name: "Juan Pérez", email: "juan.perez@email.com", phone: "+595 21 555-0001" },
  { name: "Ana García", email: "ana.garcia@email.com", phone: "+595 21 555-0002" },
  { name: "Pedro Martínez", email: "pedro.martinez@email.com", phone: "+595 21 555-0003" },
  { name: "Lucía Fernández", email: "lucia.fernandez@email.com", phone: "+595 21 555-0004" },
  { name: "Martín Rodríguez", email: "martin.rodriguez@email.com", phone: "+595 21 555-0005" },
  { name: "Valentina Díaz", email: "valentina.diaz@email.com", phone: "+595 21 555-0006" },
  { name: "Camila Torres", email: "camila.torres@email.com", phone: "+595 21 555-0007" },
  { name: "Tomás Herrera", email: "tomas.herrera@email.com", phone: "+595 21 555-0008" },
  { name: "Isabella Romero", email: "isabella.romero@email.com", phone: "+595 21 555-0009" },
  { name: "Mateo Silva", email: "mateo.silva@email.com", phone: "+595 21 555-0010" },
  { name: "Sofía Benítez", email: "sofia.benitez@email.com", phone: "+595 21 555-0011" },
  { name: "Santiago Acosta", email: "santiago.acosta@email.com", phone: "+595 21 555-0012" },
  { name: "Mía Villalba", email: "mia.villalba@email.com", phone: "+595 21 555-0013" },
  { name: "Nicolás Giménez", email: "nicolas.gimenez@email.com", phone: "+595 21 555-0014" },
  { name: "Catalina Espínola", email: "catalina.espinola@email.com", phone: "0983451455" },
  { name: "Silvio Sisa", email: "silvio.sisa@email.com", phone: "0983451455" },
];

const TIMES = ["08:00", "08:30", "09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "14:00", "14:30", "15:00", "15:30", "16:00"];

export async function scrapeAndSeed(): Promise<{ ok: boolean; message: string }> {
  await requireAdmin();
  try {
    await runPythonScraper();

    const hospitalData = parseCsvHospitals();
    if (hospitalData.length === 0) {
      return { ok: false, message: "El scraper no genero datos de hospitales." };
    }

    await clearAllData();

    await db.insert(hospitals).values(hospitalData);
    const hospitalRows = await db.select({ id: hospitals.id }).from(hospitals);

    await db.insert(doctors).values(
      DOCTOR_NAMES.map((name) => ({
        name,
        specialty: name === "Dr. Andrea Fleitas" ? "Cardiología" : pick(SPECIALTIES),
        hospital_id: pick(hospitalRows).id,
      })),
    );

    await db.insert(patients).values(PATIENT_NAMES);

    const doctorRows = await db.select({ id: doctors.id, hospital_id: doctors.hospital_id }).from(doctors);
    const patientRows = await db.select({ id: patients.id }).from(patients);
    const patientIds = patientRows.map((p) => p.id);

    let scheduledCount = 0;
    let cancelledCount = 0;
    const today = new Date();
    const appointmentData = [];
    for (let i = 0; i < 30; i++) {
      const doc = pick(doctorRows);
      const daysOffset = Math.floor(Math.random() * 14) + 1;
      const date = new Date(today);
      date.setDate(date.getDate() + daysOffset);
      const dateStr = date.toISOString().split("T")[0];
      const isCancelled = Math.random() < 0.2;

      appointmentData.push({
        hospital_id: doc.hospital_id,
        patient_id: pick(patientIds),
        doctor_id: doc.id,
        date: dateStr,
        time: pick(TIMES),
        status: isCancelled ? "cancelled" : "scheduled",
      });
      if (isCancelled) cancelledCount++;
      else scheduledCount++;
    }
    await db.insert(appointments).values(appointmentData);

    // Turno fijo: Catalina Espínola con Dr. Andrea Fleitas, viernes 2026-05-29
    const [catalina] = await db.select().from(patients).where(eq(patients.name, "Catalina Espínola")).limit(1);
    const [silvio] = await db.select().from(patients).where(eq(patients.name, "Silvio Sisa")).limit(1);
    const [fleitas] = await db.select().from(doctors).where(eq(doctors.name, "Dr. Andrea Fleitas")).limit(1);
    if (catalina && fleitas) {
      await db.insert(appointments).values({
        patient_id: catalina.id,
        doctor_id: fleitas.id,
        hospital_id: fleitas.hospital_id,
        date: "2026-05-29",
        time: "09:30",
        status: "scheduled",
      });
      scheduledCount++;
    }

    // Silvio Sisa en lista de espera para Cardiología con Dr. Andrea Fleitas
    if (silvio && fleitas) {
      await db.insert(waitlist_entries).values({
        patient_id: silvio.id,
        doctor_id: fleitas.id,
        specialty: "Cardiología",
        date_from: "2026-05-26",
        date_to: "2026-06-30",
        time_pref: "morning",
        priority: 5,
        status: "waiting",
      });
    }

    revalidateAdmin();
    return {
      ok: true,
      message: `Listo: ${hospitalData.length} hospitales, ${DOCTOR_NAMES.length} doctores, ${PATIENT_NAMES.length} pacientes, ${scheduledCount} turnos activos, ${cancelledCount} cancelados.`,
    };
  } catch (err) {
    return {
      ok: false,
      message: `Error: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

export async function deleteAllData(): Promise<{ ok: boolean; message: string }> {
  await requireAdmin();
  try {
    const apptResult = await db.delete(appointments);
    const docResult = await db.delete(doctors);
    const patientResult = await db.delete(patients);
    const hospitalResult = await db.delete(hospitals);

    revalidateAdmin();
    return {
      ok: true,
      message: `Eliminados: ${hospitalResult.rowCount ?? 0} hospitales, ${docResult.rowCount ?? 0} doctores, ${patientResult.rowCount ?? 0} pacientes, ${apptResult.rowCount ?? 0} turnos.`,
    };
  } catch (err) {
    return {
      ok: false,
      message: `Error: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}
