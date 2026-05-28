import { and, asc, eq } from "drizzle-orm";
import { db } from "../../../../server/client";
import { appointments, doctors, hospitals, patients } from "../../../../server/schema";
import { Badge } from "~/components/ui/badge";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "~/components/ui/table";
import { TurnoActions, TurnoCreateForm } from "./client";

export default async function AdminTurnosPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; status?: "scheduled" | "cancelled" }>;
}) {
  const { date, status } = await searchParams;
  const [appointmentRows, hospitalRows, patientRows, doctorRows] = await Promise.all([
    db
      .select({
        id: appointments.id,
        date: appointments.date,
        time: appointments.time,
        status: appointments.status,
        patient_name: patients.name,
        doctor_name: doctors.name,
        specialty: doctors.specialty,
        hospital_name: hospitals.name,
      })
      .from(appointments)
      .innerJoin(hospitals, eq(appointments.hospital_id, hospitals.id))
      .innerJoin(patients, eq(appointments.patient_id, patients.id))
      .innerJoin(doctors, eq(appointments.doctor_id, doctors.id))
      .where(
        and(
          date ? eq(appointments.date, date) : undefined,
          eq(appointments.status, status ?? "scheduled"),
        ),
      )
      .orderBy(asc(appointments.date), asc(appointments.time)),
    db
      .select({ id: hospitals.id, name: hospitals.name })
      .from(hospitals)
      .orderBy(asc(hospitals.name)),
    db
      .select({ id: patients.id, name: patients.name })
      .from(patients)
      .orderBy(asc(patients.name)),
    db
      .select({
        id: doctors.id,
        name: doctors.name,
        specialty: doctors.specialty,
        hospital_id: doctors.hospital_id,
      })
      .from(doctors)
      .orderBy(asc(doctors.name)),
  ]);

  return (
    <>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-baseline gap-3">
          <h1 className="font-display text-2xl font-extrabold tracking-tight">Turnos</h1>
          <Badge>{appointmentRows.length}</Badge>
        </div>
        <TurnoCreateForm hospitals={hospitalRows} patients={patientRows} doctors={doctorRows} />
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Fecha</TableHead>
            <TableHead>Hora</TableHead>
            <TableHead>Paciente</TableHead>
            <TableHead>Doctor</TableHead>
            <TableHead>Especialidad</TableHead>
            <TableHead>Hospital</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {appointmentRows.map((a) => (
            <TurnoActions key={a.id} turno={a} />
          ))}
          {appointmentRows.length === 0 && (
            <TableRow>
              <TableCell colSpan={8} className="text-center text-muted-foreground">
                No se encontraron turnos.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </>
  );
}
