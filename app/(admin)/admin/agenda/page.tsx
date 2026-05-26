import { prisma } from "../../../../server/prisma";
import { AgendaCalendar } from "./client";

export default async function AgendaPage() {
  const [appointments, doctors] = await Promise.all([
    prisma.appointment.findMany({
      where: { status: { not: "cancelled" } },
      include: {
        patient: { select: { name: true, phone: true } },
        doctor: { select: { name: true, specialty: true } },
        hospital: { select: { id: true, name: true } },
      },
    }),
    prisma.doctor.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, specialty: true },
    }),
  ]);

  const events = appointments.map((a) => {
    const [h, m] = a.time.split(":").map(Number);
    const totalMin = h * 60 + m + a.duration;
    const endH = Math.floor(totalMin / 60);
    const endM = totalMin % 60;

    return {
      id: a.id,
      title: `${a.patient.name} — ${a.doctor.name}`,
      date: a.date,
      timeStart: a.time,
      timeEnd: `${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}`,
      patient: a.patient.name,
      patientPhone: a.patient.phone,
      doctor: a.doctor.name,
      specialty: a.doctor.specialty,
      hospital: a.hospital.name,
      status: a.status,
      doctorId: a.doctor_id,
      hospitalId: a.hospital_id,
    };
  });

  const doctorOptions = doctors.map((d) => ({
    id: d.id,
    name: d.name,
    specialty: d.specialty,
  }));

  return (
    <>
      <h1 className="mb-6 font-display text-2xl font-extrabold tracking-tight">Agenda</h1>
      <AgendaCalendar events={events} doctors={doctorOptions} />
    </>
  );
}