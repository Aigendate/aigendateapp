import { asc, desc, eq } from "drizzle-orm";
import { db } from "../../../../server/client";
import { doctors, patients, waitlist_entries } from "../../../../server/schema";
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
  const [entries, patientRows, doctorRows] = await Promise.all([
    db
      .select({
        id: waitlist_entries.id,
        specialty: waitlist_entries.specialty,
        date_from: waitlist_entries.date_from,
        date_to: waitlist_entries.date_to,
        time_pref: waitlist_entries.time_pref,
        priority: waitlist_entries.priority,
        patient_name: patients.name,
        patient_phone: patients.phone,
        doctor_name: doctors.name,
      })
      .from(waitlist_entries)
      .innerJoin(patients, eq(waitlist_entries.patient_id, patients.id))
      .leftJoin(doctors, eq(waitlist_entries.doctor_id, doctors.id))
      .where(eq(waitlist_entries.status, "waiting"))
      .orderBy(desc(waitlist_entries.priority), asc(waitlist_entries.created_at)),
    db
      .select({ id: patients.id, name: patients.name })
      .from(patients)
      .orderBy(asc(patients.name)),
    db
      .select({ id: doctors.id, name: doctors.name, specialty: doctors.specialty })
      .from(doctors)
      .orderBy(asc(doctors.name)),
  ]);

  const specialties = [...new Set(doctorRows.map((d) => d.specialty))].sort();

  return (
    <>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-baseline gap-3">
          <h1 className="font-display text-2xl font-extrabold tracking-tight">Lista de Espera</h1>
          <Badge>{entries.length} esperando</Badge>
        </div>
        <WaitlistCreateForm patients={patientRows} doctors={doctorRows} specialties={specialties} />
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
            <WaitlistActions key={e.id} entry={e} />
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
