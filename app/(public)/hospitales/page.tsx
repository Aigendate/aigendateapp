import { listHospitals } from "../../../server/db.server";
import { Card, CardHeader, CardTitle, CardContent } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { SearchInput } from "~/components/search-input";
import { HospitalsView, type HospitalView } from "./view-toggle";

const NO_CITY = "Sin especificar";

export default async function HospitalesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const hospitals = await listHospitals({ name: q });

  // Bucket by city for the grouped list view; "Sin especificar" goes last.
  const byCity = new Map<string, HospitalView[]>();
  for (const h of hospitals) {
    const key = h.city?.trim() || NO_CITY;
    const bucket = byCity.get(key) ?? [];
    bucket.push({
      id: h.id,
      name: h.name,
      address: h.address,
      city: h.city,
      lat: h.lat,
      lng: h.lng,
    });
    byCity.set(key, bucket);
  }
  const groups = [...byCity.entries()]
    .map(([city, hs]) => ({ city, hospitals: hs }))
    .sort((a, b) => {
      if (a.city === NO_CITY) return 1;
      if (b.city === NO_CITY) return -1;
      return a.city.localeCompare(b.city);
    });

  return (
    <Card>
      <CardHeader className="flex-row items-baseline justify-between">
        <CardTitle>Hospitales</CardTitle>
        <Badge>{hospitals.length}</Badge>
      </CardHeader>
      <CardContent>
        <div className="mb-4">
          <SearchInput placeholder="Buscar hospital..." defaultValue={q ?? ""} />
        </div>
        {hospitals.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            No se encontraron hospitales.
          </div>
        ) : (
          <HospitalsView groups={groups} />
        )}
      </CardContent>
    </Card>
  );
}
