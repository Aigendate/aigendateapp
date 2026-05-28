import { db } from "./client";
import { doctor_schedules } from "./schema";

// Synthetic Mon–Fri working hours per doctor (day_of_week 1–5, JS getDay
// convention: 0=Sunday). Hours vary slightly by index for a bit of realism.
// Idempotent: skips any (doctor_id, day_of_week) that already exists, so it's
// safe to re-run and to backfill doctors that already have some schedules.
export async function seedDoctorSchedules(doctorIds: string[]): Promise<number> {
  let inserted = 0;
  for (let i = 0; i < doctorIds.length; i++) {
    const start = i % 2 === 0 ? "08:00" : "09:00";
    const end = i % 2 === 0 ? "16:00" : "17:00";
    const rows = [1, 2, 3, 4, 5].map((day_of_week) => ({
      doctor_id: doctorIds[i],
      day_of_week,
      start_time: start,
      end_time: end,
      slot_duration: 30,
    }));
    const res = await db
      .insert(doctor_schedules)
      .values(rows)
      .onConflictDoNothing({
        target: [doctor_schedules.doctor_id, doctor_schedules.day_of_week],
      })
      .returning({ id: doctor_schedules.id });
    inserted += res.length;
  }
  return inserted;
}
