import { asc, ilike, or } from "drizzle-orm";
import { db } from "../../../../server/client";
import { patients } from "../../../../server/schema";
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
import { PacienteActions, PacienteCreateForm } from "./client";

export default async function AdminPacientesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const rows = await db
    .select()
    .from(patients)
    .where(q ? or(ilike(patients.name, `%${q}%`), ilike(patients.email, `%${q}%`)) : undefined)
    .orderBy(asc(patients.name));

  return (
    <>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-baseline gap-3">
          <h1 className="font-display text-2xl font-extrabold tracking-tight">Pacientes</h1>
          <Badge>{rows.length}</Badge>
        </div>
        <PacienteCreateForm />
      </div>

      <SearchInput
        placeholder="Buscar por nombre o email..."
        defaultValue={q ?? ""}
        className="mb-6"
      />

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nombre</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Telefono</TableHead>
            <TableHead>Registrado</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((p) => (
            <PacienteActions key={p.id} patient={p} />
          ))}
          {rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-muted-foreground">
                No se encontraron pacientes.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </>
  );
}
