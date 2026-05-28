import { asc, ilike } from "drizzle-orm";
import { db } from "../../../../server/client";
import { hospitals } from "../../../../server/schema";
import { Badge } from "~/components/ui/badge";
import { SearchInput } from "~/components/search-input";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "~/components/ui/table";
import { HospitalActions, HospitalCreateForm } from "./client";

export default async function AdminHospitalesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const rows = await db
    .select()
    .from(hospitals)
    .where(q ? ilike(hospitals.name, `%${q}%`) : undefined)
    .orderBy(asc(hospitals.name));

  return (
    <>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-baseline gap-3">
          <h1 className="font-display text-2xl font-extrabold tracking-tight">Hospitales</h1>
          <Badge>{rows.length}</Badge>
        </div>
        <HospitalCreateForm />
      </div>

      <SearchInput
        placeholder="Buscar hospital..."
        defaultValue={q ?? ""}
        className="mb-6"
      />

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nombre</TableHead>
            <TableHead>Direccion</TableHead>
            <TableHead>Lat</TableHead>
            <TableHead>Lng</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((h) => (
            <HospitalActions key={h.id} hospital={h} />
          ))}
          {rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-muted-foreground">
                No se encontraron hospitales.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </>
  );
}
