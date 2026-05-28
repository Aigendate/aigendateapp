-- Cascade FKs + partial unique index on scheduled appointment slots.
-- IF EXISTS / IF NOT EXISTS guards make this work on both:
--   - the dev DB (originally migrated by Prisma, FK names like x_y_fkey)
--   - a fresh DB created via 0000_init (FK names like x_y_z_fk)
ALTER TABLE "appointments" DROP CONSTRAINT IF EXISTS "appointments_hospital_id_fkey";
--> statement-breakpoint
ALTER TABLE "appointments" DROP CONSTRAINT IF EXISTS "appointments_patient_id_fkey";
--> statement-breakpoint
ALTER TABLE "appointments" DROP CONSTRAINT IF EXISTS "appointments_doctor_id_fkey";
--> statement-breakpoint
ALTER TABLE "doctor_schedules" DROP CONSTRAINT IF EXISTS "doctor_schedules_doctor_id_fkey";
--> statement-breakpoint
ALTER TABLE "doctors" DROP CONSTRAINT IF EXISTS "doctors_hospital_id_fkey";
--> statement-breakpoint
ALTER TABLE "waitlist_entries" DROP CONSTRAINT IF EXISTS "waitlist_entries_patient_id_fkey";
--> statement-breakpoint
ALTER TABLE "waitlist_entries" DROP CONSTRAINT IF EXISTS "waitlist_entries_doctor_id_fkey";
--> statement-breakpoint
ALTER TABLE "appointments" DROP CONSTRAINT IF EXISTS "appointments_hospital_id_hospitals_id_fk";
--> statement-breakpoint
ALTER TABLE "appointments" DROP CONSTRAINT IF EXISTS "appointments_patient_id_patients_id_fk";
--> statement-breakpoint
ALTER TABLE "appointments" DROP CONSTRAINT IF EXISTS "appointments_doctor_id_doctors_id_fk";
--> statement-breakpoint
ALTER TABLE "doctor_schedules" DROP CONSTRAINT IF EXISTS "doctor_schedules_doctor_id_doctors_id_fk";
--> statement-breakpoint
ALTER TABLE "doctors" DROP CONSTRAINT IF EXISTS "doctors_hospital_id_hospitals_id_fk";
--> statement-breakpoint
ALTER TABLE "waitlist_entries" DROP CONSTRAINT IF EXISTS "waitlist_entries_patient_id_patients_id_fk";
--> statement-breakpoint
ALTER TABLE "waitlist_entries" DROP CONSTRAINT IF EXISTS "waitlist_entries_doctor_id_doctors_id_fk";
--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_hospital_id_hospitals_id_fk" FOREIGN KEY ("hospital_id") REFERENCES "public"."hospitals"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_doctor_id_doctors_id_fk" FOREIGN KEY ("doctor_id") REFERENCES "public"."doctors"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "doctor_schedules" ADD CONSTRAINT "doctor_schedules_doctor_id_doctors_id_fk" FOREIGN KEY ("doctor_id") REFERENCES "public"."doctors"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "doctors" ADD CONSTRAINT "doctors_hospital_id_hospitals_id_fk" FOREIGN KEY ("hospital_id") REFERENCES "public"."hospitals"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "waitlist_entries" ADD CONSTRAINT "waitlist_entries_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "waitlist_entries" ADD CONSTRAINT "waitlist_entries_doctor_id_doctors_id_fk" FOREIGN KEY ("doctor_id") REFERENCES "public"."doctors"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "appointments_scheduled_slot_key" ON "appointments" USING btree ("doctor_id","date","time") WHERE "appointments"."status" = 'scheduled';
