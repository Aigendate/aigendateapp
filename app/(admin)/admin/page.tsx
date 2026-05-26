import { prisma } from "../../../server/prisma";
import { StatCard } from "~/components/stat-card";
import { BarChart } from "~/components/bar-chart";
import { Badge } from "~/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "~/components/ui/card";
import { SeedButtons } from "./seed-buttons";

export default async function AdminPage() {
  const [hospitals, patients, doctors, scheduled, cancelled, scheduledAppointments] = await Promise.all([
    prisma.hospital.count(),
    prisma.patient.count(),
    prisma.doctor.count(),
    prisma.appointment.count({ where: { status: "scheduled" } }),
    prisma.appointment.count({ where: { status: "cancelled" } }),
    prisma.appointment.findMany({
      where: { status: "scheduled" },
      include: {
        doctor: { select: { specialty: true } },
        hospital: { select: { name: true } },
      },
    }),
  ]);

  // Group by specialty
  const specialtyMap = new Map<string, number>();
  for (const a of scheduledAppointments) {
    specialtyMap.set(a.doctor.specialty, (specialtyMap.get(a.doctor.specialty) ?? 0) + 1);
  }
  const specialtyBreakdown = [...specialtyMap.entries()]
    .map(([specialty, count]) => ({ specialty, count }))
    .sort((a, b) => b.count - a.count);

  // Group by hospital
  const hospitalMap = new Map<string, number>();
  for (const a of scheduledAppointments) {
    hospitalMap.set(a.hospital.name, (hospitalMap.get(a.hospital.name) ?? 0) + 1);
  }
  const topHospitals = [...hospitalMap.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return (
    <>
      <h1 className="mb-6 font-display text-2xl font-extrabold tracking-tight">Dashboard</h1>

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Hospitales" value={hospitals} color="primary" delay={0} />
        <StatCard label="Pacientes" value={patients} color="accent" delay={0.06} />
        <StatCard label="Doctores" value={doctors} color="purple" delay={0.12} />
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
