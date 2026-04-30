#!/usr/bin/env node
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { initDb, insertHospital, registerPatient, createAppointment } from "./db.js";

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

// --- Seed patients ---
const hospitals = db.prepare("SELECT id, name FROM hospitals").all() as { id: string; name: string }[];

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

// --- Seed appointments (spread across first 10 hospitals) ---
const appointments = [
  { doctor: "Dr. María López", patientIdx: 0, specialty: "Cardiología", date: "2026-05-05", time: "09:00" },
  { doctor: "Dr. María López", patientIdx: 1, specialty: "Cardiología", date: "2026-05-05", time: "10:30" },
  { doctor: "Dr. Carlos Ruiz", patientIdx: 2, specialty: "Traumatología", date: "2026-05-05", time: "09:00" },
  { doctor: "Dr. Carlos Ruiz", patientIdx: 3, specialty: "Traumatología", date: "2026-05-06", time: "11:00" },
  { doctor: "Dr. Sofía Chen", patientIdx: 4, specialty: "Pediatría", date: "2026-05-06", time: "08:30" },
  { doctor: "Dr. Sofía Chen", patientIdx: 5, specialty: "Pediatría", date: "2026-05-06", time: "14:00" },
  { doctor: "Dr. Diego Morales", patientIdx: 6, specialty: "Dermatología", date: "2026-05-07", time: "10:00" },
  { doctor: "Dr. Diego Morales", patientIdx: 7, specialty: "Dermatología", date: "2026-05-07", time: "15:30" },
  { doctor: "Dr. Laura Vega", patientIdx: 8, specialty: "Neurología", date: "2026-05-08", time: "09:00" },
  { doctor: "Dr. Laura Vega", patientIdx: 9, specialty: "Neurología", date: "2026-05-08", time: "11:30" },
];

let created = 0;
for (const appt of appointments) {
  const hospital = hospitals[created % Math.min(hospitals.length, 10)];
  const patientId = patientIds[appt.patientIdx];
  if (!patientId) continue;
  const result = createAppointment(db, { hospital_id: hospital.id, patient_id: patientId, doctor: appt.doctor, date: appt.date, time: appt.time, specialty: appt.specialty });
  if (result.ok) {
    console.log(`  ✓ ${patients[appt.patientIdx].name} → ${appt.doctor} at ${hospital.name} (${appt.date} ${appt.time})`);
    created++;
  } else {
    console.log(`  ✗ ${patients[appt.patientIdx].name}: ${result.error}`);
  }
}

console.log(`\nSeeded ${patientIds.length} patients and ${created} appointments across ${hospitals.length} hospitals`);
