import { asc, eq, sql } from "drizzle-orm";
import { db } from "../../server/client";
import { appointments, doctors, hospitals, patients } from "../../server/schema";
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

async function count(table: typeof hospitals | typeof patients | typeof doctors): Promise<number> {
  const [row] = await db.select({ c: sql<number>`count(*)::int` }).from(table);
  return row.c;
}

async function countAppointments(status: string): Promise<number> {
  const [row] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(appointments)
    .where(eq(appointments.status, status));
  return row.c;
}

export default async function IndexPage() {
  const [hospitalsCount, patientsCount, doctorsCount, scheduled, cancelled] = await Promise.all([
    count(hospitals),
    count(patients),
    count(doctors),
    countAppointments("scheduled"),
    countAppointments("cancelled"),
  ]);
  const stats = { hospitals: hospitalsCount, patients: patientsCount, doctors: doctorsCount, scheduled, cancelled };

  const specialtyRows = await db
    .select({
      specialty: doctors.specialty,
      count: sql<number>`count(*)::int`,
    })
    .from(appointments)
    .innerJoin(doctors, eq(appointments.doctor_id, doctors.id))
    .where(eq(appointments.status, "scheduled"))
    .groupBy(doctors.specialty);

  const specialtyBreakdown = [...specialtyRows].sort((a, b) => b.count - a.count);

  const topHospitals = (
    await db
      .select({
        name: hospitals.name,
        count: sql<number>`count(*)::int`,
      })
      .from(appointments)
      .innerJoin(hospitals, eq(appointments.hospital_id, hospitals.id))
      .where(eq(appointments.status, "scheduled"))
      .groupBy(hospitals.name)
  )
    .filter((h) => h.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const apptRows = await db
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
    .orderBy(asc(appointments.date), asc(appointments.time));

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
              {apptRows.map((a) => (
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
