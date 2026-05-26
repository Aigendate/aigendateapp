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
import { WaitlistCreateForm, WaitlistActions } from "./client";

export default async function ListaEsperaPage() {
  const [entries, patients, doctors] = await Promise.all([
    prisma.waitlistEntry.findMany({
      where: { status: "waiting" },
      include: {
        patient: { select: { name: true, phone: true } },
        doctor: { select: { name: true } },
      },
      orderBy: [{ priority: "desc" }, { created_at: "asc" }],
    }),
    prisma.patient.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.doctor.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, specialty: true } }),
  ]);

  const specialties = [...new Set(doctors.map((d) => d.specialty))].sort();

  return (
    <>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-baseline gap-3">
          <h1 className="font-display text-2xl font-extrabold tracking-tight">Lista de Espera</h1>
          <Badge>{entries.length} esperando</Badge>
        </div>
        <WaitlistCreateForm patients={patients} doctors={doctors} specialties={specialties} />
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Paciente</TableHead>
            <TableHead>Teléfono</TableHead>
            <TableHead>Especialidad</TableHead>
            <TableHead>Doctor preferido</TableHead>
            <TableHead>Desde</TableHead>
            <TableHead>Hasta</TableHead>
            <TableHead>Preferencia</TableHead>
            <TableHead>Prioridad</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.map((e) => (
            <WaitlistActions
              key={e.id}
              entry={{
                id: e.id,
                patient_name: e.patient.name,
                patient_phone: e.patient.phone,
                specialty: e.specialty,
                doctor_name: e.doctor?.name ?? null,
                date_from: e.date_from,
                date_to: e.date_to,
                time_pref: e.time_pref,
                priority: e.priority,
              }}
            />
          ))}
          {entries.length === 0 && (
            <TableRow>
              <TableCell colSpan={9} className="text-center text-muted-foreground">
                No hay pacientes en lista de espera.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </>
  );
}
