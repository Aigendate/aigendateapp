import type { Route } from "./+types/_index";
import { getDb } from "../../server/db.server";
import { StatCard } from "~/components/stat-card";
import { BarChart } from "~/components/bar-chart";
import { Badge } from "~/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "~/components/ui/card";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "~/components/ui/table";

export function loader() {
  const db = getDb();
  const stats = {
    hospitals: (db.prepare("SELECT COUNT(*) as n FROM hospitals").get() as { n: number }).n,
    patients: (db.prepare("SELECT COUNT(*) as n FROM patients").get() as { n: number }).n,
    doctors: (db.prepare("SELECT COUNT(*) as n FROM doctors").get() as { n: number }).n,
    scheduled: (db.prepare("SELECT COUNT(*) as n FROM appointments WHERE status = 'scheduled'").get() as { n: number }).n,
    cancelled: (db.prepare("SELECT COUNT(*) as n FROM appointments WHERE status = 'cancelled'").get() as { n: number }).n,
  };

  const specialtyBreakdown = db
    .prepare(
      `SELECT d.specialty, COUNT(*) as count FROM appointments a JOIN doctors d ON a.doctor_id = d.id WHERE a.status = 'scheduled' GROUP BY d.specialty ORDER BY count DESC`
    )
    .all() as { specialty: string; count: number }[];

  const topHospitals = db
    .prepare(
      `SELECT h.name, COUNT(a.id) as count FROM hospitals h LEFT JOIN appointments a ON h.id = a.hospital_id AND a.status = 'scheduled' GROUP BY h.id HAVING count > 0 ORDER BY count DESC LIMIT 10`
    )
    .all() as { name: string; count: number }[];

  const appointments = db
    .prepare(
      `SELECT a.*, h.name as hospital_name, p.name as patient_name, d.name as doctor_name, d.specialty FROM appointments a JOIN hospitals h ON a.hospital_id = h.id JOIN patients p ON a.patient_id = p.id JOIN doctors d ON a.doctor_id = d.id ORDER BY a.date, a.time`
    )
    .all() as {
    id: string;
    date: string;
    time: string;
    patient_name: string;
    doctor_name: string;
    specialty: string;
    hospital_name: string;
    status: string;
  }[];

  return { stats, specialtyBreakdown, topHospitals, appointments };
}

export default function Index({ loaderData }: Route.ComponentProps) {
  const { stats, specialtyBreakdown, topHospitals, appointments } = loaderData;

  return (
    <>
      <div className="mb-10 grid grid-cols-2 gap-4 md:grid-cols-5">
        <StatCard label="Hospitales" value={stats.hospitals} color="primary" delay={0} />
        <StatCard label="Pacientes" value={stats.patients} color="accent" delay={0.06} />
        <StatCard label="Doctores" value={stats.doctors} color="purple" delay={0.12} />
        <StatCard label="Turnos Activos" value={stats.scheduled} color="foreground" delay={0.18} />
        <StatCard label="Cancelados" value={stats.cancelled} color="destructive" delay={0.24} />
      </div>

      <div className="mb-10 grid gap-6 md:grid-cols-2">
        <Card className="animate-slide-up" style={{ animationDelay: "0.25s" }}>
          <CardHeader className="flex-row items-baseline justify-between">
            <CardTitle>Especialidades</CardTitle>
            <Badge>{specialtyBreakdown.length} activas</Badge>
          </CardHeader>
          <CardContent>
            <BarChart
              items={specialtyBreakdown.map((s) => ({ label: s.specialty, value: s.count }))}
              color="accent"
            />
          </CardContent>
        </Card>

        <Card className="animate-slide-up" style={{ animationDelay: "0.3s" }}>
          <CardHeader className="flex-row items-baseline justify-between">
            <CardTitle>Hospitales con mas turnos</CardTitle>
            <Badge>Top 10</Badge>
          </CardHeader>
          <CardContent>
            <BarChart
              items={topHospitals.map((h) => ({ label: h.name, value: h.count }))}
              color="primary"
            />
          </CardContent>
        </Card>
      </div>

      <Card className="animate-slide-up mb-10" style={{ animationDelay: "0.35s" }}>
        <CardHeader>
          <CardTitle>Turnos</CardTitle>
        </CardHeader>
        <CardContent>
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
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
