import { getDb, listAppointments } from "../../server/db.server";
import { Card, CardHeader, CardTitle, CardContent } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { TurnosFilters } from "./filters";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "~/components/ui/table";

export default async function TurnosPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; status?: "scheduled" | "cancelled"; doctor_id?: string }>;
}) {
  const { date, status, doctor_id } = await searchParams;
  const db = getDb();
  const appointments = listAppointments(db, { date, status, doctor_id });

  return (
    <Card>
      <CardHeader className="flex-row items-baseline justify-between">
        <CardTitle>Turnos</CardTitle>
        <Badge>{appointments.length}</Badge>
      </CardHeader>
      <CardContent>
        <TurnosFilters defaultDate={date ?? ""} defaultStatus={status ?? ""} />
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
            </TableRow>
          </TableHeader>
          <TableBody>
            {appointments.map((a) => (
              <TableRow key={a.id}>
                <TableCell>{a.date}</TableCell>
                <TableCell>{a.time}</TableCell>
                <TableCell>{a.patient_name}</TableCell>
                <TableCell>{a.doctor_name}</TableCell>
                <TableCell>
                  <Badge variant="accent">{a.specialty}</Badge>
                </TableCell>
                <TableCell>{a.hospital_name}</TableCell>
                <TableCell>
                  <Badge variant={a.status === "scheduled" ? "default" : "destructive"}>
                    {a.status === "scheduled" ? "activo" : "cancelado"}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
            {appointments.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  No se encontraron turnos.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
