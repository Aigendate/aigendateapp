import { eq, sql } from "drizzle-orm";
import { db } from "../../../server/client";
import { hospitals, doctors, patients, appointments } from "../../../server/schema";
import { StatCard } from "~/components/stat-card";
import { BarChart } from "~/components/bar-chart";
import { Badge } from "~/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "~/components/ui/card";
import { SeedButtons } from "./seed-buttons";

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

export default async function AdminPage() {
  const [hospitalsCount, patientsCount, doctorsCount, scheduled, cancelled, scheduledAppointments] = await Promise.all([
    count(hospitals),
    count(patients),
    count(doctors),
    countAppointments("scheduled"),
    countAppointments("cancelled"),
    db
      .select({
        specialty: doctors.specialty,
        hospital_name: hospitals.name,
      })
      .from(appointments)
      .innerJoin(doctors, eq(appointments.doctor_id, doctors.id))
      .innerJoin(hospitals, eq(appointments.hospital_id, hospitals.id))
      .where(eq(appointments.status, "scheduled")),
  ]);

  // Group by specialty
  const specialtyMap = new Map<string, number>();
  for (const a of scheduledAppointments) {
    specialtyMap.set(a.specialty, (specialtyMap.get(a.specialty) ?? 0) + 1);
  }
  const specialtyBreakdown = [...specialtyMap.entries()]
    .map(([specialty, count]) => ({ specialty, count }))
    .sort((a, b) => b.count - a.count);

  // Group by hospital
  const hospitalMap = new Map<string, number>();
  for (const a of scheduledAppointments) {
    hospitalMap.set(a.hospital_name, (hospitalMap.get(a.hospital_name) ?? 0) + 1);
  }
  const topHospitals = [...hospitalMap.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return (
    <>
      <h1 className="mb-6 font-display text-2xl font-extrabold tracking-tight">Dashboard</h1>

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Hospitales" value={hospitalsCount} color="primary" delay={0} />
        <StatCard label="Pacientes" value={patientsCount} color="accent" delay={0.06} />
        <StatCard label="Doctores" value={doctorsCount} color="purple" delay={0.12} />
        <StatCard label="Turnos Activos" value={scheduled} color="foreground" delay={0.18} />
        <StatCard label="Cancelados" value={cancelled} color="destructive" delay={0.24} />
      </div>

      <Card className="mb-8 animate-slide-up" style={{ animationDelay: "0.25s" }}>
        <CardHeader>
          <CardTitle>Datos</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-[0.7rem] text-muted-foreground">
            Importar hospitales desde OpenStreetMap (scraper Python) o desde el CSV existente en data/.
          </p>
          <SeedButtons />
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="animate-slide-up" style={{ animationDelay: "0.3s" }}>
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

        <Card className="animate-slide-up" style={{ animationDelay: "0.35s" }}>
          <CardHeader className="flex-row items-baseline justify-between">
            <CardTitle>Top Hospitales</CardTitle>
            <Badge>Top 5</Badge>
          </CardHeader>
          <CardContent>
            <BarChart
              items={topHospitals.map((h) => ({ label: h.name, value: h.count }))}
              color="primary"
            />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
