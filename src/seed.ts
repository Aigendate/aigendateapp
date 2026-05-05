#!/usr/bin/env node
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { initDb, insertHospital, insertDoctor, registerPatient, createAppointment } from "./db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const db = initDb();

// --- Load hospitals from osm_facilities.csv (has street + city data) ---
const csvPath = path.join(__dirname, "..", "..", "data", "osm_facilities.csv");
const csvContent = readFileSync(csvPath, "utf-8");
const lines = csvContent.split("\n").slice(1).filter((l) => l.trim());

// CSV columns: osm_id,osm_type,name,name_es,facility_type,healthcare,operator,operator_type,beds,emergency,phone,website,addr_city,addr_street,lat,lon,source
const existingCount = (db.prepare("SELECT COUNT(*) as n FROM hospitals").get() as { n: number }).n;
if (existingCount > 0) {
  console.log(`Hospitals already seeded (${existingCount}). Skipping hospital import.`);
} else {
  let hospitalCount = 0;
  for (const line of lines) {
    const cols = line.split(",");
    const name = (cols[2]?.trim() || cols[3]?.trim());
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
}

// --- Seed doctors across first 10 hospitals ---
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
    console.log(`  ✓ Doctor: ${d.name} (${d.specialty}) at ${hospital.name}`);
    doctorIds.push(id);
  }
  console.log(`Seeded ${doctorIds.length} doctors`);
}

// --- Seed patients ---
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
    console.log(`  ✓ Patient: ${p.name} (${p.email})`);
    patientIds.push(result.patient.id);
  } else {
    console.log(`  ✗ ${p.name}: ${result.error}`);
  }
}

// --- Seed appointments (each doctor gets one appointment with a patient) ---
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

// Look up doctor records to get their hospital_id
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
    console.log(`  ✓ ${patients[appt.patientIdx].name} → ${doctor.name} at ${hospitalName} (${appt.date} ${appt.time})`);
    created++;
  } else {
    console.log(`  ✗ ${patients[appt.patientIdx].name}: ${result.error}`);
  }
}

console.log(`\nSeeded ${doctorIds.length} doctors, ${patientIds.length} patients, and ${created} appointments across ${hospitals.length} hospitals`);
