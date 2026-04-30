#!/usr/bin/env node
import { initDb, createAppointment } from "./db.js";

const db = initDb();

const hospitals = db.prepare("SELECT id, name FROM hospitals").all() as { id: string; name: string }[];
console.log(`Found ${hospitals.length} hospitals`);

const appointments = [
  { doctor: "Dr. María López", patient: "Juan Pérez", specialty: "Cardiología", date: "2026-05-05", time: "09:00" },
  { doctor: "Dr. María López", patient: "Ana García", specialty: "Cardiología", date: "2026-05-05", time: "10:30" },
  { doctor: "Dr. Carlos Ruiz", patient: "Pedro Martínez", specialty: "Traumatología", date: "2026-05-05", time: "09:00" },
  { doctor: "Dr. Carlos Ruiz", patient: "Lucía Fernández", specialty: "Traumatología", date: "2026-05-06", time: "11:00" },
  { doctor: "Dr. Sofía Chen", patient: "Martín Rodríguez", specialty: "Pediatría", date: "2026-05-06", time: "08:30" },
  { doctor: "Dr. Sofía Chen", patient: "Valentina Díaz", specialty: "Pediatría", date: "2026-05-06", time: "14:00" },
  { doctor: "Dr. Diego Morales", patient: "Camila Torres", specialty: "Dermatología", date: "2026-05-07", time: "10:00" },
  { doctor: "Dr. Diego Morales", patient: "Tomás Herrera", specialty: "Dermatología", date: "2026-05-07", time: "15:30" },
  { doctor: "Dr. Laura Vega", patient: "Isabella Romero", specialty: "Neurología", date: "2026-05-08", time: "09:00" },
  { doctor: "Dr. Laura Vega", patient: "Mateo Silva", specialty: "Neurología", date: "2026-05-08", time: "11:30" },
];

let created = 0;
for (const appt of appointments) {
  const hospital = hospitals[created % hospitals.length];
  const result = createAppointment(db, { hospital_id: hospital.id, ...appt });
  if (result.ok) {
    console.log(`  ✓ ${appt.patient} → ${appt.doctor} at ${hospital.name} (${appt.date} ${appt.time})`);
    created++;
  } else {
    console.log(`  ✗ ${appt.patient}: ${result.error}`);
  }
}

console.log(`\nSeeded ${created} appointments across ${hospitals.length} hospitals`);
