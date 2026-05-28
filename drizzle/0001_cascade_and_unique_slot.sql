ALTER TABLE "appointments" DROP CONSTRAINT "appointments_hospital_id_fkey";
--> statement-breakpoint
ALTER TABLE "appointments" DROP CONSTRAINT "appointments_patient_id_fkey";
--> statement-breakpoint
ALTER TABLE "appointments" DROP CONSTRAINT "appointments_doctor_id_fkey";
--> statement-breakpoint
ALTER TABLE "doctor_schedules" DROP CONSTRAINT "doctor_schedules_doctor_id_fkey";
--> statement-breakpoint
ALTER TABLE "doctors" DROP CONSTRAINT "doctors_hospital_id_fkey";
--> statement-breakpoint
ALTER TABLE "waitlist_entries" DROP CONSTRAINT "waitlist_entries_patient_id_fkey";
--> statement-breakpoint
ALTER TABLE "waitlist_entries" DROP CONSTRAINT "waitlist_entries_doctor_id_fkey";
--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_hospital_id_hospitals_id_fk" FOREIGN KEY ("hospital_id") REFERENCES "public"."hospitals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_doctor_id_doctors_id_fk" FOREIGN KEY ("doctor_id") REFERENCES "public"."doctors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "doctor_schedules" ADD CONSTRAINT "doctor_schedules_doctor_id_doctors_id_fk" FOREIGN KEY ("doctor_id") REFERENCES "public"."doctors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "doctors" ADD CONSTRAINT "doctors_hospital_id_hospitals_id_fk" FOREIGN KEY ("hospital_id") REFERENCES "public"."hospitals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "waitlist_entries" ADD CONSTRAINT "waitlist_entries_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "waitlist_entries" ADD CONSTRAINT "waitlist_entries_doctor_id_doctors_id_fk" FOREIGN KEY ("doctor_id") REFERENCES "public"."doctors"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "appointments_scheduled_slot_key" ON "appointments" USING btree ("doctor_id","date","time") WHERE "appointments"."status" = 'scheduled';
