import { getDb, listPatients } from "../../server/db.server";
import { Card, CardHeader, CardTitle, CardContent } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { SearchInput } from "~/components/search-input";

export default async function PacientesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const db = getDb();
  const patients = listPatients(db, q);

  return (
    <Card>
      <CardHeader className="flex-row items-baseline justify-between">
        <CardTitle>Pacientes</CardTitle>
        <Badge>{patients.length}</Badge>
      </CardHeader>
      <CardContent>
        <SearchInput
          placeholder="Buscar por nombre o email..."
          defaultValue={q ?? ""}
          className="mb-4"
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
