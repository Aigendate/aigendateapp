import { asc, eq, ilike, or } from "drizzle-orm";
import { db } from "../../../../server/client";
import { doctors, hospitals } from "../../../../server/schema";
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
  const [doctorRows, hospitalRows] = await Promise.all([
    db
      .select({
        id: doctors.id,
        name: doctors.name,
        specialty: doctors.specialty,
        hospital_id: doctors.hospital_id,
        hospital_name: hospitals.name,
      })
      .from(doctors)
      .innerJoin(hospitals, eq(doctors.hospital_id, hospitals.id))
      .where(q ? or(ilike(doctors.name, `%${q}%`), ilike(doctors.specialty, `%${q}%`)) : undefined)
      .orderBy(asc(doctors.name)),
    db
      .select({ id: hospitals.id, name: hospitals.name })
      .from(hospitals)
      .orderBy(asc(hospitals.name)),
  ]);

  return (
    <>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-baseline gap-3">
          <h1 className="font-display text-2xl font-extrabold tracking-tight">Doctores</h1>
          <Badge>{doctorRows.length}</Badge>
        </div>
        <DoctorCreateForm hospitals={hospitalRows} />
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
          {doctorRows.map((d) => (
            <DoctorActions key={d.id} doctor={d} hospitals={hospitalRows} />
          ))}
          {doctorRows.length === 0 && (
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
