import Link from "next/link";
import { listSpecialties } from "../../../server/db.server";
import { Card, CardHeader, CardTitle, CardContent } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";

export default async function EspecialidadesPage() {
  const specialties = await listSpecialties();

  return (
    <Card>
      <CardHeader className="flex-row items-baseline justify-between">
        <CardTitle>Especialidades</CardTitle>
        <Badge>{specialties.length}</Badge>
      </CardHeader>
      <CardContent>
        {specialties.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            No hay especialidades registradas.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-0 sm:grid-cols-2 lg:grid-cols-3">
            {specialties.map((s) => (
              <Link
                key={s.specialty}
                href={`/especialidades/${encodeURIComponent(s.specialty)}`}
                className="flex items-center justify-between border-b border-muted px-3 py-3 text-[0.8rem] transition-colors hover:bg-muted/50"
              >
                <span className="font-medium">{s.specialty}</span>
                <Badge variant="accent">{s.count}</Badge>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
