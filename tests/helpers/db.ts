import { sql } from "drizzle-orm";
import { db } from "../../server/client";

export async function resetDb(): Promise<void> {
  await db.execute(
    sql`TRUNCATE TABLE "waitlist_entries", "appointments", "doctor_schedules", "doctors", "patients", "hospitals" RESTART IDENTITY CASCADE`,
  );
}
