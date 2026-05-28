import Link from "next/link";
import { notFound } from "next/navigation";
import { getHospital, listDoctors } from "../../../../server/db.server";
import { Card, CardHeader, CardTitle, CardContent } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { HospitalMapDynamic } from "~/components/hospital-map-dynamic";

export default async function HospitalDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const hospital = await getHospital(id);
  if (!hospital) notFound();

  const doctors = await listDoctors({ hospital_id: id });

  // listDoctors returns rows pre-sorted by specialty then name, so a single
  // pass groups them into specialty buckets in order.
  const bySpecialty = new Map<string, typeof doctors>();
  for (const d of doctors) {
    const bucket = bySpecialty.get(d.specialty) ?? [];
    bucket.push(d);
    bySpecialty.set(d.specialty, bucket);
  }

  return (
    <div className="space-y-6">
      <Link
        href="/hospitales"
        className="text-[0.7rem] uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground"
      >
        ← Hospitales
      </Link>

      <Card>
        <CardHeader className="flex-row items-start justify-between gap-4">
          <div className="space-y-1">
            <CardTitle>{hospital.name}</CardTitle>
            <div className="text-[0.75rem] text-muted-foreground">{hospital.address}</div>
          </div>
          {hospital.city && <Badge variant="outline">{hospital.city}</Badge>}
        </CardHeader>
        <CardContent>
          <HospitalMapDynamic
            hospitals={[
              {
                id: hospital.id,
                name: hospital.name,
                address: hospital.address,
                city: hospital.city,
                lat: hospital.lat,
                lng: hospital.lng,
              },
            ]}
            zoom={14}
            height={280}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-baseline justify-between">
          <CardTitle>Especialidades y doctores</CardTitle>
          <Badge>{doctors.length}</Badge>
        </CardHeader>
        <CardContent>
          {doctors.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              Este hospital no tiene doctores registrados.
            </div>
          ) : (
            <div className="space-y-5">
              {[...bySpecialty.entries()].map(([specialty, docs]) => (
                <div key={specialty}>
                  <div className="mb-2 flex items-baseline gap-2 border-b border-muted pb-1">
                    <Badge variant="accent">{specialty}</Badge>
                    <span className="text-[0.65rem] text-muted-foreground">
                      {docs.length} {docs.length === 1 ? "doctor" : "doctores"}
                    </span>
                  </div>
                  <ul className="space-y-0">
                    {docs.map((d) => (
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
