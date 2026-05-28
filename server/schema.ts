import { randomUUID } from "node:crypto";
import { relations, sql } from "drizzle-orm";
import {
  type AnyPgColumn,
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
  city: text("city"),
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
    .references(() => hospitals.id, { onDelete: "cascade" }),
});

export const doctor_schedules = pgTable(
  "doctor_schedules",
  {
    id: id(),
    doctor_id: text("doctor_id")
      .notNull()
      .references(() => doctors.id, { onDelete: "cascade" }),
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

export const appointments = pgTable(
  "appointments",
  {
    id: id(),
    hospital_id: text("hospital_id")
      .notNull()
      .references(() => hospitals.id, { onDelete: "cascade" }),
    patient_id: text("patient_id")
      .notNull()
      .references(() => patients.id, { onDelete: "cascade" }),
    doctor_id: text("doctor_id")
      .notNull()
      .references(() => doctors.id, { onDelete: "cascade" }),
    date: text("date").notNull(),
    time: text("time").notNull(),
    duration: integer("duration").notNull().default(30),
    status: text("status").notNull().default("scheduled"),
    is_recurring: boolean("is_recurring").notNull().default(false),
    recurrence_rule: text("recurrence_rule"),
    parent_appointment_id: text("parent_appointment_id").references(
      (): AnyPgColumn => appointments.id,
      { onDelete: "set null" },
    ),
    created_at: timestamp("created_at", { precision: 3, mode: "date" })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (t) => [
    uniqueIndex("appointments_scheduled_slot_key")
      .on(t.doctor_id, t.date, t.time)
      .where(sql`${t.status} = 'scheduled'`),
  ],
);

export const waitlist_entries = pgTable("waitlist_entries", {
  id: id(),
  patient_id: text("patient_id")
    .notNull()
    .references(() => patients.id, { onDelete: "cascade" }),
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

// --- Relations (for db.query.X.findMany({ with: {...} })) ---

export const hospitalsRelations = relations(hospitals, ({ many }) => ({
  doctors: many(doctors),
  appointments: many(appointments),
}));

export const patientsRelations = relations(patients, ({ many }) => ({
  appointments: many(appointments),
  waitlist_entries: many(waitlist_entries),
}));

export const doctorsRelations = relations(doctors, ({ one, many }) => ({
  hospital: one(hospitals, {
    fields: [doctors.hospital_id],
    references: [hospitals.id],
  }),
  appointments: many(appointments),
  schedules: many(doctor_schedules),
  waitlist_entries: many(waitlist_entries),
}));

export const doctorSchedulesRelations = relations(doctor_schedules, ({ one }) => ({
  doctor: one(doctors, {
    fields: [doctor_schedules.doctor_id],
    references: [doctors.id],
  }),
}));

export const appointmentsRelations = relations(appointments, ({ one }) => ({
  hospital: one(hospitals, {
    fields: [appointments.hospital_id],
    references: [hospitals.id],
  }),
  patient: one(patients, {
    fields: [appointments.patient_id],
    references: [patients.id],
  }),
  doctor: one(doctors, {
    fields: [appointments.doctor_id],
    references: [doctors.id],
  }),
}));

export const waitlistEntriesRelations = relations(waitlist_entries, ({ one }) => ({
  patient: one(patients, {
    fields: [waitlist_entries.patient_id],
    references: [patients.id],
  }),
  doctor: one(doctors, {
    fields: [waitlist_entries.doctor_id],
    references: [doctors.id],
  }),
}));

export type Hospital = typeof hospitals.$inferSelect;
export type Patient = typeof patients.$inferSelect;
export type Doctor = typeof doctors.$inferSelect;
export type DoctorSchedule = typeof doctor_schedules.$inferSelect;
export type Appointment = typeof appointments.$inferSelect;
export type WaitlistEntry = typeof waitlist_entries.$inferSelect;
