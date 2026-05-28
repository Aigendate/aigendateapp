import { asc, eq, ne } from "drizzle-orm";
import { db } from "../../../../server/client";
import { appointments, doctors, hospitals, patients } from "../../../../server/schema";
import { AgendaCalendar } from "./client";

export default async function AgendaPage() {
  const [appointmentRows, doctorRows] = await Promise.all([
    db
      .select({
        id: appointments.id,
        date: appointments.date,
        time: appointments.time,
        duration: appointments.duration,
        status: appointments.status,
        doctor_id: appointments.doctor_id,
        hospital_id: appointments.hospital_id,
        patient_name: patients.name,
        patient_phone: patients.phone,
        doctor_name: doctors.name,
        specialty: doctors.specialty,
        hospital_name: hospitals.name,
      })
      .from(appointments)
      .innerJoin(patients, eq(appointments.patient_id, patients.id))
      .innerJoin(doctors, eq(appointments.doctor_id, doctors.id))
      .innerJoin(hospitals, eq(appointments.hospital_id, hospitals.id))
      .where(ne(appointments.status, "cancelled")),
    db
      .select({ id: doctors.id, name: doctors.name, specialty: doctors.specialty })
      .from(doctors)
      .orderBy(asc(doctors.name)),
  ]);

  const events = appointmentRows.map((a) => {
    const [h, m] = a.time.split(":").map(Number);
    const totalMin = h * 60 + m + a.duration;
    const endH = Math.floor(totalMin / 60);
    const endM = totalMin % 60;

    return {
      id: a.id,
      title: `${a.patient_name} — ${a.doctor_name}`,
      date: a.date,
      timeStart: a.time,
      timeEnd: `${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}`,
      patient: a.patient_name,
      patientPhone: a.patient_phone,
      doctor: a.doctor_name,
      specialty: a.specialty,
      hospital: a.hospital_name,
      status: a.status,
      doctorId: a.doctor_id,
      hospitalId: a.hospital_id,
    };
  });

  return (
    <>
      <h1 className="mb-6 font-display text-2xl font-extrabold tracking-tight">Agenda</h1>
      <AgendaCalendar events={events} doctors={doctorRows} />
    </>
  );
}
