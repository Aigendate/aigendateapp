import Link from "next/link";
import { listDoctors } from "../../../../server/db.server";
import { Card, CardHeader, CardTitle, CardContent } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";

export default async function EspecialidadDetailPage({
  params,
}: {
  params: Promise<{ name: string }>;
}) {
  const { name } = await params;
  const specialty = decodeURIComponent(name);
  // listDoctors does an ILIKE match on specialty; group the results by hospital
  // so a patient can see which hospitals offer this specialty.
  const doctors = (await listDoctors({ specialty })).filter(
    (d) => d.specialty.toLowerCase() === specialty.toLowerCase(),
  );

  const byHospital = new Map<string, { name: string; doctors: typeof doctors }>();
  for (const d of doctors) {
    const entry = byHospital.get(d.hospital_id) ?? {
      name: d.hospital_name ?? "—",
      doctors: [],
    };
    entry.doctors.push(d);
    byHospital.set(d.hospital_id, entry);
  }
  const hospitals = [...byHospital.entries()].sort((a, b) =>
    a[1].name.localeCompare(b[1].name),
  );

  return (
    <div className="space-y-6">
      <Link
        href="/especialidades"
        className="text-[0.7rem] uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground"
      >
        ← Especialidades
      </Link>

      <Card>
        <CardHeader className="flex-row items-baseline justify-between">
          <CardTitle>{specialty}</CardTitle>
          <Badge variant="accent">
            {doctors.length} {doctors.length === 1 ? "doctor" : "doctores"}
          </Badge>
        </CardHeader>
        <CardContent>
          {doctors.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              No hay doctores en esta especialidad.
            </div>
          ) : (
            <div className="space-y-5">
              {hospitals.map(([hospitalId, entry]) => (
                <div key={hospitalId}>
                  <div className="mb-2 flex items-baseline gap-2 border-b border-muted pb-1">
                    <Link
                      href={`/hospitales/${hospitalId}`}
                      className="text-[0.7rem] font-medium uppercase tracking-wider underline-offset-2 hover:underline"
                    >
                      {entry.name}
                    </Link>
                    <Badge variant="outline">{entry.doctors.length}</Badge>
                  </div>
                  <ul>
                    {entry.doctors.map((d) => (
                      <li
                        key={d.id}
                        className="border-b border-muted px-1 py-1.5 text-[0.75rem] last:border-0"
                      >
                        {d.name}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
