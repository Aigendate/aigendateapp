#!/usr/bin/env node
// Idempotent backfill of doctor_schedules for existing doctors (e.g. prod,
// which was seeded before schedules existed). Inserts Mon–Fri working hours
// only for (doctor, day) combinations that don't already have a schedule.
//
//   node --env-file=.env --import tsx backfill-schedules.ts
//
import { db } from "./server/client";
import { doctors } from "./server/schema";
import { seedDoctorSchedules } from "./server/schedules-seed";

async function main() {
  const rows = await db.select({ id: doctors.id }).from(doctors);
  const inserted = await seedDoctorSchedules(rows.map((r) => r.id));
  console.log(`Backfilled ${inserted} schedule rows across ${rows.length} doctors.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$pool.end();
  });
