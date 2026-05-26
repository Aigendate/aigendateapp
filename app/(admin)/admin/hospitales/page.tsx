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
import { HospitalActions, HospitalCreateForm } from "./client";

export default async function AdminHospitalesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const hospitals = await prisma.hospital.findMany({
    where: q ? { name: { contains: q } } : undefined,
    orderBy: { name: "asc" },
  });

  return (
    <>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-baseline gap-3">
          <h1 className="font-display text-2xl font-extrabold tracking-tight">Hospitales</h1>
          <Badge>{hospitals.length}</Badge>
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
          {hospitals.map((h) => (
            <HospitalActions key={h.id} hospital={h} />
          ))}
          {hospitals.length === 0 && (
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
