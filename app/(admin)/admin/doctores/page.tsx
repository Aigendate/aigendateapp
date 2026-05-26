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
import { DoctorActions, DoctorCreateForm } from "./client";

export default async function AdminDoctoresPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const [doctors, hospitals] = await Promise.all([
    prisma.doctor.findMany({
      where: q
        ? { OR: [{ name: { contains: q } }, { specialty: { contains: q } }] }
        : undefined,
      include: { hospital: { select: { name: true } } },
      orderBy: { name: "asc" },
    }),
    prisma.hospital.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-baseline gap-3">
          <h1 className="font-display text-2xl font-extrabold tracking-tight">Doctores</h1>
          <Badge>{doctors.length}</Badge>
        </div>
        <DoctorCreateForm hospitals={hospitals} />
      </div>

      <SearchInput
        placeholder="Buscar por nombre o especialidad..."
        defaultValue={q ?? ""}
        className="mb-6"
      />

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nombre</TableHead>
            <TableHead>Especialidad</TableHead>
            <TableHead>Hospital</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {doctors.map((d) => (
            <DoctorActions
              key={d.id}
              doctor={{ ...d, hospital_name: d.hospital.name }}
              hospitals={hospitals}
            />
          ))}
          {doctors.length === 0 && (
            <TableRow>
              <TableCell colSpan={4} className="text-center text-muted-foreground">
                No se encontraron doctores.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </>
  );
}
