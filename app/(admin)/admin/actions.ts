"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "../../../server/prisma";

function revalidateAdmin() {
  revalidatePath("/admin", "layout");
}

// --- Pacientes ---

export async function createPatient(formData: FormData) {
  await prisma.patient.create({
    data: {
      name: formData.get("name") as string,
      email: (formData.get("email") as string) || null,
      phone: (formData.get("phone") as string) || null,
    },
  });
  revalidateAdmin();
}

export async function updatePatient(formData: FormData) {
  const id = formData.get("id") as string;
  await prisma.patient.update({
    where: { id },
    data: {
      name: formData.get("name") as string,
      email: (formData.get("email") as string) || null,
      phone: (formData.get("phone") as string) || null,
    },
  });
  revalidateAdmin();
}

export async function deletePatient(formData: FormData) {
  const id = formData.get("id") as string;
  await prisma.appointment.deleteMany({ where: { patient_id: id } });
  await prisma.patient.delete({ where: { id } });
  revalidateAdmin();
}

// --- Hospitales ---

export async function createHospital(formData: FormData) {
  await prisma.hospital.create({
    data: {
      name: formData.get("name") as string,
      address: formData.get("address") as string,
      lat: parseFloat(formData.get("lat") as string) || 0,
      lng: parseFloat(formData.get("lng") as string) || 0,
    },
  });
  revalidateAdmin();
}

export async function updateHospital(formData: FormData) {
  const id = formData.get("id") as string;
  await prisma.hospital.update({
    where: { id },
    data: {
      name: formData.get("name") as string,
      address: formData.get("address") as string,
      lat: parseFloat(formData.get("lat") as string) || 0,
      lng: parseFloat(formData.get("lng") as string) || 0,
    },
  });
  revalidateAdmin();
}

export async function deleteHospital(formData: FormData) {
  const id = formData.get("id") as string;
  await prisma.appointment.deleteMany({ where: { hospital_id: id } });
  await prisma.doctor.deleteMany({ where: { hospital_id: id } });
  await prisma.hospital.delete({ where: { id } });
  revalidateAdmin();
}

// --- Doctores ---

export async function createDoctor(formData: FormData) {
  await prisma.doctor.create({
    data: {
      name: formData.get("name") as string,
      specialty: formData.get("specialty") as string,
      hospital_id: formData.get("hospital_id") as string,
    },
  });
  revalidateAdmin();
}

export async function updateDoctor(formData: FormData) {
  const id = formData.get("id") as string;
  await prisma.doctor.update({
    where: { id },
    data: {
      name: formData.get("name") as string,
      specialty: formData.get("specialty") as string,
      hospital_id: formData.get("hospital_id") as string,
    },
  });
  revalidateAdmin();
}

export async function deleteDoctor(formData: FormData) {
  const id = formData.get("id") as string;
  await prisma.appointment.deleteMany({ where: { doctor_id: id } });
  await prisma.doctor.delete({ where: { id } });
  revalidateAdmin();
}

// --- Turnos ---

export async function createAppointment(formData: FormData) {
  await prisma.appointment.create({
    data: {
      hospital_id: formData.get("hospital_id") as string,
      patient_id: formData.get("patient_id") as string,
      doctor_id: formData.get("doctor_id") as string,
      date: formData.get("date") as string,
      time: formData.get("time") as string,
    },
  });
  revalidateAdmin();
}

export async function cancelAppointment(formData: FormData) {
  const id = formData.get("id") as string;
  await prisma.appointment.update({
    where: { id },
    data: { status: "cancelled" },
  });
  revalidateAdmin();
}

export async function deleteAppointment(formData: FormData) {
  const id = formData.get("id") as string;
  await prisma.appointment.delete({ where: { id } });
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
  await prisma.appointment.deleteMany();
  await prisma.doctor.deleteMany();
  await prisma.patient.deleteMany();
  await prisma.hospital.deleteMany();
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
  { name: "Catalina Espínola", email: "catalina.espinola@email.com", phone: "+595 21 555-0015" },
];

const TIMES = ["08:00", "08:30", "09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "14:00", "14:30", "15:00", "15:30", "16:00"];

export async function scrapeAndSeed(): Promise<{ ok: boolean; message: string }> {
  try {
    await runPythonScraper();

    const hospitalData = parseCsvHospitals();
    if (hospitalData.length === 0) {
      return { ok: false, message: "El scraper no genero datos de hospitales." };
    }

    await clearAllData();

    await prisma.hospital.createMany({ data: hospitalData });
    const hospitals = await prisma.hospital.findMany({ select: { id: true } });

    await prisma.doctor.createMany({
      data: DOCTOR_NAMES.map((name) => ({
        name,
        specialty: pick(SPECIALTIES),
        hospital_id: pick(hospitals).id,
      })),
    });

    await prisma.patient.createMany({ data: PATIENT_NAMES });

    const doctors = await prisma.doctor.findMany({ select: { id: true, hospital_id: true } });
    const patients = await prisma.patient.findMany({ select: { id: true } });
    const patientIds = patients.map((p) => p.id);

    let scheduledCount = 0;
    let cancelledCount = 0;
    const today = new Date();
    const appointmentData = [];
    for (let i = 0; i < 30; i++) {
      const doc = pick(doctors);
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
    await prisma.appointment.createMany({ data: appointmentData });

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
  try {
    const appts = await prisma.appointment.deleteMany();
    const docs = await prisma.doctor.deleteMany();
    const patients = await prisma.patient.deleteMany();
    const hospitals = await prisma.hospital.deleteMany();

    revalidateAdmin();
    return {
      ok: true,
      message: `Eliminados: ${hospitals.count} hospitales, ${docs.count} doctores, ${patients.count} pacientes, ${appts.count} turnos.`,
    };
  } catch (err) {
    return {
      ok: false,
      message: `Error: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}
