import type { Route } from "./+types/pacientes";
import { useSearchParams } from "react-router";
import { getDb, listPatients } from "../../server/db.server";
import { Card, CardHeader, CardTitle, CardContent } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Input } from "~/components/ui/input";

export function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const search = url.searchParams.get("q") || undefined;
  const db = getDb();
  const patients = listPatients(db, search);
  return { patients, q: search ?? "" };
}

export default function Pacientes({ loaderData }: Route.ComponentProps) {
  const { patients, q } = loaderData;
  const [, setSearchParams] = useSearchParams();

  return (
    <Card>
      <CardHeader className="flex-row items-baseline justify-between">
        <CardTitle>Pacientes</CardTitle>
        <Badge>{patients.length}</Badge>
      </CardHeader>
      <CardContent>
        <Input
          placeholder="Buscar por nombre o email..."
          defaultValue={q}
          className="mb-4"
          onChange={(e) => {
            const value = e.target.value;
            if (value) {
              setSearchParams({ q: value }, { replace: true });
            } else {
              setSearchParams({}, { replace: true });
            }
          }}
        />
        <div className="space-y-0">
          {patients.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between border-b border-muted px-1 py-3 text-[0.8rem]"
            >
              <div>
                <div className="font-medium">{p.name}</div>
                <div className="text-[0.7rem] text-muted-foreground">{p.email}</div>
              </div>
              <div className="text-[0.7rem] text-muted-foreground">{p.phone}</div>
            </div>
          ))}
          {patients.length === 0 && (
            <div className="py-8 text-center text-muted-foreground">
              No se encontraron pacientes.
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
