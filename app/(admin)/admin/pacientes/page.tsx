import { prisma } from "../../../../server/prisma";
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
  const patients = await prisma.patient.findMany({
    where: q
      ? { OR: [{ name: { contains: q } }, { email: { contains: q } }] }
      : undefined,
    orderBy: { name: "asc" },
  });

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-baseline gap-3">
          <h1 className="font-display text-2xl font-extrabold tracking-tight">Pacientes</h1>
          <Badge>{patients.length}</Badge>
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
          {patients.map((p) => (
            <PacienteActions key={p.id} patient={p} />
          ))}
          {patients.length === 0 && (
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
