import { prisma } from "../../../../server/prisma";
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
  const [appointments, hospitals, patients, doctors] = await Promise.all([
    prisma.appointment.findMany({
      where: {
        ...(date ? { date } : {}),
        status: status ?? "scheduled",
      },
      include: {
        hospital: { select: { name: true } },
        patient: { select: { name: true } },
        doctor: { select: { name: true, specialty: true } },
      },
      orderBy: [{ date: "asc" }, { time: "asc" }],
    }),
    prisma.hospital.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.patient.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.doctor.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, specialty: true, hospital_id: true } }),
  ]);

  return (
    <>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-baseline gap-3">
          <h1 className="font-display text-2xl font-extrabold tracking-tight">Turnos</h1>
          <Badge>{appointments.length}</Badge>
        </div>
        <TurnoCreateForm hospitals={hospitals} patients={patients} doctors={doctors} />
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
          {appointments.map((a) => (
            <TurnoActions
              key={a.id}
              turno={{
                id: a.id,
                date: a.date,
                time: a.time,
                status: a.status,
                patient_name: a.patient.name,
                doctor_name: a.doctor.name,
                specialty: a.doctor.specialty,
                hospital_name: a.hospital.name,
              }}
            />
          ))}
          {appointments.length === 0 && (
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
