import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  integer,
  boolean,
  doublePrecision,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => randomUUID());

export const hospitals = pgTable("hospitals", {
  id: id(),
  name: text("name").notNull(),
  address: text("address").notNull(),
  lat: doublePrecision("lat").notNull(),
  lng: doublePrecision("lng").notNull(),
});

export const patients = pgTable(
  "patients",
  {
    id: id(),
    name: text("name").notNull(),
    email: text("email"),
    phone: text("phone"),
    created_at: timestamp("created_at", { precision: 3, mode: "date" })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (t) => [uniqueIndex("patients_email_key").on(t.email)],
);

export const doctors = pgTable("doctors", {
  id: id(),
  name: text("name").notNull(),
  specialty: text("specialty").notNull(),
  hospital_id: text("hospital_id")
    .notNull()
    .references(() => hospitals.id),
});

export const doctor_schedules = pgTable(
  "doctor_schedules",
  {
    id: id(),
    doctor_id: text("doctor_id")
      .notNull()
      .references(() => doctors.id),
    day_of_week: integer("day_of_week").notNull(),
    start_time: text("start_time").notNull(),
    end_time: text("end_time").notNull(),
    slot_duration: integer("slot_duration").notNull().default(30),
  },
  (t) => [
    uniqueIndex("doctor_schedules_doctor_id_day_of_week_key").on(
      t.doctor_id,
      t.day_of_week,
    ),
  ],
);

export const appointments = pgTable("appointments", {
  id: id(),
  hospital_id: text("hospital_id")
    .notNull()
    .references(() => hospitals.id),
  patient_id: text("patient_id")
    .notNull()
    .references(() => patients.id),
  doctor_id: text("doctor_id")
    .notNull()
    .references(() => doctors.id),
  date: text("date").notNull(),
  time: text("time").notNull(),
  duration: integer("duration").notNull().default(30),
  status: text("status").notNull().default("scheduled"),
  is_recurring: boolean("is_recurring").notNull().default(false),
  recurrence_rule: text("recurrence_rule"),
  parent_appointment_id: text("parent_appointment_id"),
  created_at: timestamp("created_at", { precision: 3, mode: "date" })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

export const waitlist_entries = pgTable("waitlist_entries", {
  id: id(),
  patient_id: text("patient_id")
    .notNull()
    .references(() => patients.id),
  doctor_id: text("doctor_id").references(() => doctors.id, {
    onDelete: "set null",
  }),
  specialty: text("specialty").notNull(),
  date_from: text("date_from").notNull(),
  date_to: text("date_to").notNull(),
  time_pref: text("time_pref"),
  priority: integer("priority").notNull().default(0),
  status: text("status").notNull().default("waiting"),
  created_at: timestamp("created_at", { precision: 3, mode: "date" })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

export type Hospital = typeof hospitals.$inferSelect;
export type Patient = typeof patients.$inferSelect;
export type Doctor = typeof doctors.$inferSelect;
export type DoctorSchedule = typeof doctor_schedules.$inferSelect;
export type Appointment = typeof appointments.$inferSelect;
export type WaitlistEntry = typeof waitlist_entries.$inferSelect;
