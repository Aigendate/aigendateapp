import { listHospitals } from "../../../server/db.server";
import { Card, CardHeader, CardTitle, CardContent } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { SearchInput } from "~/components/search-input";

export default async function HospitalesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const hospitals = await listHospitals({ name: q });

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
        <div className="grid max-h-[600px] grid-cols-1 gap-0 overflow-y-auto md:grid-cols-2">
          {hospitals.map((h) => (
            <div
              key={h.id}
              className="border-b border-muted px-3 py-2 text-[0.75rem] transition-colors hover:bg-muted/50"
            >
              <div className="font-medium">{h.name}</div>
              <div className="text-[0.65rem] text-muted-foreground">{h.address}</div>
            </div>
          ))}
          {hospitals.length === 0 && (
            <div className="col-span-2 py-8 text-center text-muted-foreground">
              No se encontraron hospitales.
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
