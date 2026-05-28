import { and, asc, eq, ilike, or, sql } from "drizzle-orm";
import { db } from "./client";
import {
  hospitals,
  doctors,
  patients,
  appointments,
  doctor_schedules,
  waitlist_entries,
} from "./schema";

export interface Hospital {
  id: string;
  name: string;
  address: string;
  city: string | null;
  lat: number;
  lng: number;
}

export interface Patient {
  id: string;
  name: string;
  email: string;
  phone: string;
  created_at: string;
}

export interface Doctor {
  id: string;
  name: string;
  specialty: string;
  hospital_id: string;
  hospital_name?: string;
}

export interface Appointment {
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

export function isUniqueViolation(err: unknown, constraint: string): boolean {
  const cause = (err as { cause?: { code?: string; constraint?: string } })?.cause;
  return cause?.code === "23505" && cause.constraint === constraint;
}

export const SCHEDULED_SLOT_INDEX = "appointments_scheduled_slot_key";

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function insertHospital(
  params: { name: string; address: string; city?: string | null; lat: number; lng: number }
): Promise<string> {
  const [row] = await db.insert(hospitals).values(params).returning({ id: hospitals.id });
  return row.id;
}

export async function listHospitals(
  opts: { name?: string; city?: string; lat?: number; lng?: number } = {}
): Promise<(Hospital & { distance_km?: number })[]> {
  const conditions = [
    opts.name
      ? or(ilike(hospitals.name, `%${opts.name}%`), ilike(hospitals.address, `%${opts.name}%`))
      : undefined,
    opts.city ? ilike(hospitals.city, `%${opts.city}%`) : undefined,
  ].filter((c): c is NonNullable<typeof c> => c !== undefined);

  const rows = await db
    .select()
    .from(hospitals)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(asc(hospitals.city), asc(hospitals.name));

  if (opts.lat !== undefined && opts.lng !== undefined) {
    return rows
      .map((h) => ({
        ...h,
        distance_km: Math.round(haversineKm(opts.lat!, opts.lng!, h.lat, h.lng) * 10) / 10,
      }))
      .sort((a, b) => a.distance_km - b.distance_km);
  }
  return rows;
}

export async function getHospital(id: string): Promise<Hospital | null> {
  const [row] = await db.select().from(hospitals).where(eq(hospitals.id, id)).limit(1);
  return row ?? null;
}

// Distinct cities with hospital counts, busiest first. NULL city ("Sin
// especificar") sorts last so the UI can render it as a trailing group.
export async function listCities(): Promise<{ city: string | null; count: number }[]> {
  return db
    .select({ city: hospitals.city, count: sql<number>`count(*)::int` })
    .from(hospitals)
    .groupBy(hospitals.city)
    .orderBy(sql`${hospitals.city} is null`, asc(hospitals.city));
}

// Distinct specialties with doctor counts, most doctors first.
export async function listSpecialties(): Promise<{ specialty: string; count: number }[]> {
  return db
    .select({ specialty: doctors.specialty, count: sql<number>`count(*)::int` })
    .from(doctors)
    .groupBy(doctors.specialty)
    .orderBy(asc(doctors.specialty));
}

export async function insertDoctor(
  params: { name: string; specialty: string; hospital_id: string }
): Promise<string> {
  const [row] = await db.insert(doctors).values(params).returning({ id: doctors.id });
  return row.id;
}

export async function listDoctors(
  filters: { hospital_id?: string; specialty?: string; name?: string; city?: string } = {}
): Promise<Doctor[]> {
  const conditions = [
    filters.hospital_id ? eq(doctors.hospital_id, filters.hospital_id) : undefined,
    filters.specialty ? ilike(doctors.specialty, `%${filters.specialty}%`) : undefined,
    filters.name ? ilike(doctors.name, `%${filters.name}%`) : undefined,
    filters.city
      ? or(ilike(hospitals.address, `%${filters.city}%`), ilike(hospitals.name, `%${filters.city}%`))
      : undefined,
  ].filter((c): c is NonNullable<typeof c> => c !== undefined);

  const rows = await db
    .select({
      id: doctors.id,
      name: doctors.name,
      specialty: doctors.specialty,
      hospital_id: doctors.hospital_id,
      hospital_name: hospitals.name,
    })
    .from(doctors)
    .innerJoin(hospitals, eq(doctors.hospital_id, hospitals.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(asc(doctors.specialty), asc(doctors.name));

  return rows;
}

export async function registerPatient(
  params: { name: string; email?: string; phone?: string }
): Promise<{ ok: true; patient: Patient } | { ok: false; error: string }> {
  if (params.email) {
    const existing = await db
      .select({ id: patients.id })
      .from(patients)
      .where(eq(patients.email, params.email))
      .limit(1);
    if (existing.length > 0) {
      return { ok: false, error: `A patient with email ${params.email} is already registered.` };
    }
  }
  const [row] = await db
    .insert(patients)
    .values({ name: params.name, email: params.email ?? null, phone: params.phone ?? null })
    .returning();
  return {
    ok: true,
    patient: {
      id: row.id,
      name: row.name,
      email: row.email ?? "",
      phone: row.phone ?? "",
      created_at: row.created_at.toISOString(),
    },
  };
}

export async function listPatients(search?: string): Promise<Patient[]> {
  const rows = await db
    .select()
    .from(patients)
    .where(
      search
        ? or(ilike(patients.name, `%${search}%`), ilike(patients.email, `%${search}%`))
        : undefined,
    )
    .orderBy(asc(patients.name));
  return rows.map((p) => ({
    id: p.id,
    name: p.name,
    email: p.email ?? "",
    phone: p.phone ?? "",
    created_at: p.created_at.toISOString(),
  }));
}

export async function createAppointment(
  params: { hospital_id: string; patient_id: string; doctor_id: string; date: string; time: string }
): Promise<{ ok: true; appointment: Appointment } | { ok: false; error: string }> {
  const [hospital] = await db.select().from(hospitals).where(eq(hospitals.id, params.hospital_id)).limit(1);
  if (!hospital) return { ok: false, error: `Hospital not found: ${params.hospital_id}` };

  const [patient] = await db.select().from(patients).where(eq(patients.id, params.patient_id)).limit(1);
  if (!patient) return { ok: false, error: `Patient not found: ${params.patient_id}. Register them first with register_patient.` };

  const [doctor] = await db.select().from(doctors).where(eq(doctors.id, params.doctor_id)).limit(1);
  if (!doctor) return { ok: false, error: `Doctor not found: ${params.doctor_id}. Use list_doctors to find one.` };

  if (doctor.hospital_id !== params.hospital_id)
    return { ok: false, error: `Dr. ${doctor.name} does not practice at this hospital.` };

  let row;
  try {
    [row] = await db.insert(appointments).values(params).returning();
  } catch (err) {
    if (isUniqueViolation(err, SCHEDULED_SLOT_INDEX)) {
      return { ok: false, error: `Dr. ${doctor.name} already has an appointment at ${params.date} ${params.time}.` };
    }
    throw err;
  }
  return {
    ok: true,
    appointment: {
      id: row.id,
      hospital_id: row.hospital_id,
      patient_id: row.patient_id,
      doctor_id: row.doctor_id,
      date: row.date,
      time: row.time,
      status: row.status,
      created_at: row.created_at.toISOString(),
    },
  };
}

export async function listAppointments(
  filters: { hospital_id?: string; date?: string; doctor_id?: string; patient_id?: string; status?: string }
): Promise<Appointment[]> {
  const conditions = [
    filters.hospital_id ? eq(appointments.hospital_id, filters.hospital_id) : undefined,
    filters.date ? eq(appointments.date, filters.date) : undefined,
    filters.doctor_id ? eq(appointments.doctor_id, filters.doctor_id) : undefined,
    filters.patient_id ? eq(appointments.patient_id, filters.patient_id) : undefined,
    eq(appointments.status, filters.status ?? "scheduled"),
  ].filter((c): c is NonNullable<typeof c> => c !== undefined);

  const rows = await db
    .select({
      id: appointments.id,
      hospital_id: appointments.hospital_id,
      hospital_name: hospitals.name,
      patient_id: appointments.patient_id,
      patient_name: patients.name,
      doctor_id: appointments.doctor_id,
      doctor_name: doctors.name,
      specialty: doctors.specialty,
      date: appointments.date,
      time: appointments.time,
      status: appointments.status,
      created_at: appointments.created_at,
    })
    .from(appointments)
    .innerJoin(hospitals, eq(appointments.hospital_id, hospitals.id))
    .innerJoin(patients, eq(appointments.patient_id, patients.id))
    .innerJoin(doctors, eq(appointments.doctor_id, doctors.id))
    .where(and(...conditions))
    .orderBy(asc(appointments.date), asc(appointments.time));

  return rows.map((r) => ({ ...r, created_at: r.created_at.toISOString() }));
}

export async function updatePatient(
  id: string,
  params: { name?: string; email?: string; phone?: string }
): Promise<void> {
  const data: Record<string, unknown> = {};
  if (params.name !== undefined) data.name = params.name;
  if (params.email !== undefined) data.email = params.email;
  if (params.phone !== undefined) data.phone = params.phone;
  if (Object.keys(data).length === 0) return;
  await db.update(patients).set(data).where(eq(patients.id, id));
}

export async function deletePatient(id: string): Promise<void> {
  await db.delete(patients).where(eq(patients.id, id));
}

export async function updateHospital(
  id: string,
  params: { name?: string; address?: string; city?: string | null; lat?: number; lng?: number }
): Promise<void> {
  const data: Record<string, unknown> = {};
  if (params.name !== undefined) data.name = params.name;
  if (params.address !== undefined) data.address = params.address;
  if (params.city !== undefined) data.city = params.city;
  if (params.lat !== undefined) data.lat = params.lat;
  if (params.lng !== undefined) data.lng = params.lng;
  if (Object.keys(data).length === 0) return;
  await db.update(hospitals).set(data).where(eq(hospitals.id, id));
}

export async function deleteHospital(id: string): Promise<void> {
  await db.delete(hospitals).where(eq(hospitals.id, id));
}

export async function updateDoctor(
  id: string,
  params: { name?: string; specialty?: string; hospital_id?: string }
): Promise<void> {
  const data: Record<string, unknown> = {};
  if (params.name !== undefined) data.name = params.name;
  if (params.specialty !== undefined) data.specialty = params.specialty;
  if (params.hospital_id !== undefined) data.hospital_id = params.hospital_id;
  if (Object.keys(data).length === 0) return;
  await db.update(doctors).set(data).where(eq(doctors.id, id));
}

export async function deleteDoctor(id: string): Promise<void> {
  await db.delete(doctors).where(eq(doctors.id, id));
}

export async function cancelAppointment(
  id: string
): Promise<{ ok: true; appointment: Appointment } | { ok: false; error: string }> {
  const [row] = await db
    .select({
      id: appointments.id,
      hospital_id: appointments.hospital_id,
      hospital_name: hospitals.name,
      patient_id: appointments.patient_id,
      patient_name: patients.name,
      doctor_id: appointments.doctor_id,
      doctor_name: doctors.name,
      specialty: doctors.specialty,
      date: appointments.date,
      time: appointments.time,
      status: appointments.status,
      created_at: appointments.created_at,
    })
    .from(appointments)
    .innerJoin(hospitals, eq(appointments.hospital_id, hospitals.id))
    .innerJoin(patients, eq(appointments.patient_id, patients.id))
    .innerJoin(doctors, eq(appointments.doctor_id, doctors.id))
    .where(eq(appointments.id, id))
    .limit(1);

  if (!row) return { ok: false, error: "Appointment not found." };
  if (row.status === "cancelled") return { ok: false, error: "Appointment is already cancelled." };

  await db.update(appointments).set({ status: "cancelled" }).where(eq(appointments.id, id));
  return {
    ok: true,
    appointment: { ...row, status: "cancelled", created_at: row.created_at.toISOString() },
  };
}

// Free time slots for a doctor on a date: the doctor's working hours for that
// weekday (doctor_schedules) minus already-booked scheduled appointments.
// day_of_week follows JS getDay(): 0=Sunday … 6=Saturday.
export async function getAvailableSlots(doctorId: string, date: string): Promise<string[]> {
  const dayOfWeek = new Date(date + "T12:00:00").getDay();

  const [schedule] = await db
    .select()
    .from(doctor_schedules)
    .where(
      and(eq(doctor_schedules.doctor_id, doctorId), eq(doctor_schedules.day_of_week, dayOfWeek)),
    )
    .limit(1);
  if (!schedule) return [];

  const existing = await db
    .select({ time: appointments.time })
    .from(appointments)
    .where(
      and(
        eq(appointments.doctor_id, doctorId),
        eq(appointments.date, date),
        eq(appointments.status, "scheduled"),
      ),
    );
  const bookedTimes = new Set(existing.map((a) => a.time));

  const slots: string[] = [];
  const [startH, startM] = schedule.start_time.split(":").map(Number);
  const [endH, endM] = schedule.end_time.split(":").map(Number);
  let current = startH * 60 + startM;
  const end = endH * 60 + endM;

  while (current + schedule.slot_duration <= end) {
    const h = String(Math.floor(current / 60)).padStart(2, "0");
    const m = String(current % 60).padStart(2, "0");
    const timeStr = `${h}:${m}`;
    if (!bookedTimes.has(timeStr)) slots.push(timeStr);
    current += schedule.slot_duration;
  }

  return slots;
}

// Move an existing appointment to a new date/time. Surfaces the slot-collision
// (23505 on the scheduled-slot partial unique index) as a friendly error.
export async function rescheduleAppointment(
  id: string,
  date: string,
  time: string,
): Promise<{ ok: true; appointment: Appointment } | { ok: false; error: string }> {
  let row;
  try {
    [row] = await db
      .update(appointments)
      .set({ date, time })
      .where(eq(appointments.id, id))
      .returning();
  } catch (err) {
    if (isUniqueViolation(err, SCHEDULED_SLOT_INDEX)) {
      return { ok: false, error: `Ese horario (${date} ${time}) ya está ocupado.` };
    }
    throw err;
  }
  if (!row) return { ok: false, error: "Appointment not found." };
  return { ok: true, appointment: { ...row, created_at: row.created_at.toISOString() } };
}

// Add a patient to the waitlist for a specialty (optionally a specific doctor)
// within a date range.
export async function addToWaitlist(params: {
  patient_id: string;
  doctor_id?: string;
  specialty: string;
  date_from: string;
  date_to: string;
  time_pref?: string;
  priority?: number;
}): Promise<{ id: string }> {
  const [row] = await db
    .insert(waitlist_entries)
    .values({
      patient_id: params.patient_id,
      doctor_id: params.doctor_id ?? null,
      specialty: params.specialty,
      date_from: params.date_from,
      date_to: params.date_to,
      time_pref: params.time_pref ?? null,
      priority: params.priority ?? 0,
    })
    .returning({ id: waitlist_entries.id });
  return { id: row.id };
}

export { sql };
