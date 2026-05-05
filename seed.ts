#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { getDb, insertHospital, insertDoctor, registerPatient, createAppointment } from "./server/db.js";

const db = getDb();

const FALLBACK_HOSPITALS = [
  { name: "Hospital Nacional de Itauguá", address: "Ruta 2, Itauguá, Paraguay", lat: -25.39, lng: -57.35 },
  { name: "Hospital de Clínicas", address: "Av. Mariscal López, Asunción, Paraguay", lat: -25.29, lng: -57.60 },
  { name: "Hospital Central del IPS", address: "Av. Sacramento, Asunción, Paraguay", lat: -25.27, lng: -57.62 },
  { name: "Hospital Regional de Ciudad del Este", address: "Ciudad del Este, Paraguay", lat: -25.51, lng: -54.61 },
  { name: "Hospital Regional de Encarnación", address: "Encarnación, Paraguay", lat: -27.33, lng: -55.87 },
  { name: "Hospital Regional de Coronel Oviedo", address: "Coronel Oviedo, Paraguay", lat: -25.45, lng: -56.44 },
  { name: "Hospital Regional de Concepción", address: "Concepción, Paraguay", lat: -23.40, lng: -57.43 },
  { name: "Hospital Regional de Pedro Juan Caballero", address: "Pedro Juan Caballero, Paraguay", lat: -22.55, lng: -55.73 },
  { name: "Hospital Materno Infantil San Pablo", address: "San Pablo, Asunción, Paraguay", lat: -25.30, lng: -57.59 },
  { name: "Centro Médico Bautista", address: "Av. Rep. Argentina, Asunción, Paraguay", lat: -25.28, lng: -57.58 },
];

const existingCount = (db.prepare("SELECT COUNT(*) as n FROM hospitals").get() as { n: number }).n;
if (existingCount > 0) {
  console.log(`Hospitals already seeded (${existingCount}). Skipping hospital import.`);
} else {
  const csvPath = path.join(process.cwd(), "data", "osm_facilities.csv");

  if (existsSync(csvPath)) {
    const csvContent = readFileSync(csvPath, "utf-8");
    const lines = csvContent.split("\n").slice(1).filter((l) => l.trim());
    let hospitalCount = 0;
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
      const address = parts.join(", ");
      insertHospital(db, { name, address, lat, lng: lon });
      hospitalCount++;
    }
    console.log(`Seeded ${hospitalCount} hospitals from ${csvPath}`);
  } else {
    console.log("No CSV data found, using fallback hospitals.");
    for (const h of FALLBACK_HOSPITALS) {
      insertHospital(db, h);
    }
    console.log(`Seeded ${FALLBACK_HOSPITALS.length} fallback hospitals`);
  }
}

const hospitals = db.prepare("SELECT id, name FROM hospitals").all() as { id: string; name: string }[];

const doctorData = [
  { name: "Dr. María López", specialty: "Cardiología" },
  { name: "Dr. Carlos Ruiz", specialty: "Traumatología" },
  { name: "Dr. Sofía Chen", specialty: "Pediatría" },
  { name: "Dr. Diego Morales", specialty: "Dermatología" },
  { name: "Dr. Laura Vega", specialty: "Neurología" },
  { name: "Dr. Alejandro Benítez", specialty: "Cardiología" },
  { name: "Dr. Gabriela Paredes", specialty: "Ginecología" },
  { name: "Dr. Fernando Acosta", specialty: "Traumatología" },
  { name: "Dr. Patricia Núñez", specialty: "Pediatría" },
  { name: "Dr. Ricardo Villalba", specialty: "Medicina General" },
  { name: "Dr. Claudia Giménez", specialty: "Dermatología" },
  { name: "Dr. Hugo Espínola", specialty: "Neurología" },
  { name: "Dr. Lorena Ayala", specialty: "Oftalmología" },
  { name: "Dr. Miguel Ángel Rojas", specialty: "Urología" },
  { name: "Dr. Sandra Cabrera", specialty: "Ginecología" },
  { name: "Dr. Ramón Lezcano", specialty: "Medicina General" },
  { name: "Dr. Verónica Duarte", specialty: "Cardiología" },
  { name: "Dr. José Luis Arce", specialty: "Traumatología" },
  { name: "Dr. Andrea Fleitas", specialty: "Pediatría" },
  { name: "Dr. Óscar Domínguez", specialty: "Oftalmología" },
];

const doctorIds: string[] = [];
const existingDoctors = (db.prepare("SELECT COUNT(*) as n FROM doctors").get() as { n: number }).n;
if (existingDoctors > 0) {
  console.log(`Doctors already seeded (${existingDoctors}). Skipping.`);
  const rows = db.prepare("SELECT id FROM doctors").all() as { id: string }[];
  doctorIds.push(...rows.map((r) => r.id));
} else {
  for (let i = 0; i < doctorData.length; i++) {
    const d = doctorData[i];
    const hospital = hospitals[i % Math.min(hospitals.length, 10)];
    const id = insertDoctor(db, { name: d.name, specialty: d.specialty, hospital_id: hospital.id });
    console.log(`  Doctor: ${d.name} (${d.specialty}) at ${hospital.name}`);
    doctorIds.push(id);
  }
  console.log(`Seeded ${doctorIds.length} doctors`);
}

const patients = [
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
];

const patientIds: string[] = [];
for (const p of patients) {
  const result = registerPatient(db, p);
  if (result.ok) {
    console.log(`  Patient: ${p.name} (${p.email})`);
    patientIds.push(result.patient.id);
  } else {
    console.log(`  ${p.name}: ${result.error}`);
  }
}

const appointments = [
  { doctorIdx: 0, patientIdx: 0, date: "2026-05-05", time: "09:00" },
  { doctorIdx: 0, patientIdx: 1, date: "2026-05-05", time: "10:30" },
  { doctorIdx: 1, patientIdx: 2, date: "2026-05-05", time: "09:00" },
  { doctorIdx: 1, patientIdx: 3, date: "2026-05-06", time: "11:00" },
  { doctorIdx: 2, patientIdx: 4, date: "2026-05-06", time: "08:30" },
  { doctorIdx: 2, patientIdx: 5, date: "2026-05-06", time: "14:00" },
  { doctorIdx: 3, patientIdx: 6, date: "2026-05-07", time: "10:00" },
  { doctorIdx: 3, patientIdx: 7, date: "2026-05-07", time: "15:30" },
  { doctorIdx: 4, patientIdx: 8, date: "2026-05-08", time: "09:00" },
  { doctorIdx: 4, patientIdx: 9, date: "2026-05-08", time: "11:30" },
];

const doctorRecords = db.prepare("SELECT id, name, hospital_id FROM doctors").all() as { id: string; name: string; hospital_id: string }[];

let created = 0;
for (const appt of appointments) {
  const doctor = doctorRecords[appt.doctorIdx];
  const patientId = patientIds[appt.patientIdx];
  if (!doctor || !patientId) continue;
  const result = createAppointment(db, {
    hospital_id: doctor.hospital_id,
    patient_id: patientId,
    doctor_id: doctor.id,
    date: appt.date,
    time: appt.time,
  });
  const hospitalName = hospitals.find((h) => h.id === doctor.hospital_id)?.name ?? "?";
  if (result.ok) {
    console.log(`  ${patients[appt.patientIdx].name} -> ${doctor.name} at ${hospitalName} (${appt.date} ${appt.time})`);
    created++;
  } else {
    console.log(`  ${patients[appt.patientIdx].name}: ${result.error}`);
  }
}

console.log(`\nSeeded ${doctorIds.length} doctors, ${patientIds.length} patients, and ${created} appointments across ${hospitals.length} hospitals`);
