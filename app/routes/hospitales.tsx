import type { Route } from "./+types/hospitales";
import { useSearchParams } from "react-router";
import { getDb, listHospitals } from "../../server/db.server";
import { Card, CardHeader, CardTitle, CardContent } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Input } from "~/components/ui/input";

export function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const q = url.searchParams.get("q") || undefined;
  const db = getDb();
  const hospitals = listHospitals(db, { name: q });
  return { hospitals, q: q ?? "" };
}

export default function Hospitales({ loaderData }: Route.ComponentProps) {
  const { hospitals, q } = loaderData;
  const [, setSearchParams] = useSearchParams();

  return (
    <Card>
      <CardHeader className="flex-row items-baseline justify-between">
        <CardTitle>Hospitales</CardTitle>
        <Badge>{hospitals.length}</Badge>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={(e) => e.preventDefault()}
          className="mb-4"
        >
          <Input
            placeholder="Buscar hospital..."
            defaultValue={q}
            onChange={(e) => {
              const value = e.target.value;
              if (value) {
                setSearchParams({ q: value }, { replace: true });
              } else {
                setSearchParams({}, { replace: true });
              }
            }}
          />
        </form>
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
