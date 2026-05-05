import type { Route } from "./+types/turnos";
import { useSearchParams } from "react-router";
import { getDb, listAppointments } from "../../server/db.server";
import { Card, CardHeader, CardTitle, CardContent } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Input } from "~/components/ui/input";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "~/components/ui/table";

export function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const date = url.searchParams.get("date") || undefined;
  const status = (url.searchParams.get("status") as "scheduled" | "cancelled") || undefined;
  const doctor_id = url.searchParams.get("doctor_id") || undefined;

  const db = getDb();
  const appointments = listAppointments(db, { date, status, doctor_id });
  return { appointments, date: date ?? "", status: status ?? "" };
}

export default function Turnos({ loaderData }: Route.ComponentProps) {
  const { appointments, date } = loaderData;
  const [searchParams, setSearchParams] = useSearchParams();

  return (
    <Card>
      <CardHeader className="flex-row items-baseline justify-between">
        <CardTitle>Turnos</CardTitle>
        <Badge>{appointments.length}</Badge>
      </CardHeader>
      <CardContent>
        <div className="mb-4 flex gap-3">
          <Input
            type="date"
            defaultValue={date}
            className="w-auto"
            onChange={(e) => {
              const params = new URLSearchParams(searchParams);
              if (e.target.value) {
                params.set("date", e.target.value);
              } else {
                params.delete("date");
              }
              setSearchParams(params, { replace: true });
            }}
          />
          <select
            className="border border-border bg-background px-3 py-2 font-mono text-[0.8rem] outline-none focus:border-primary"
            defaultValue={searchParams.get("status") ?? ""}
            onChange={(e) => {
              const params = new URLSearchParams(searchParams);
              if (e.target.value) {
                params.set("status", e.target.value);
              } else {
                params.delete("status");
              }
              setSearchParams(params, { replace: true });
            }}
          >
            <option value="">Todos</option>
            <option value="scheduled">Activos</option>
            <option value="cancelled">Cancelados</option>
          </select>
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
