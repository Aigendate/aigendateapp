import { Fragment } from "react";
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
      .orderBy(asc(hospitals.name), asc(doctors.specialty), asc(doctors.name)),
    db
      .select({ id: hospitals.id, name: hospitals.name })
      .from(hospitals)
      .orderBy(asc(hospitals.name)),
  ]);

  // Bucket doctors under their hospital for grouped section rendering.
  const byHospital = new Map<string, { name: string; doctors: typeof doctorRows }>();
  for (const d of doctorRows) {
    const entry = byHospital.get(d.hospital_id) ?? { name: d.hospital_name, doctors: [] };
    entry.doctors.push(d);
    byHospital.set(d.hospital_id, entry);
  }
  const grouped = [...byHospital.entries()];

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
          {grouped.map(([hospitalId, entry]) => (
            <Fragment key={hospitalId}>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableCell colSpan={4} className="py-1.5">
                  <span className="text-[0.7rem] font-medium uppercase tracking-wider">
                    {entry.name}
                  </span>
                  <span className="ml-2 text-[0.6rem] text-muted-foreground">
                    {entry.doctors.length}
                  </span>
                </TableCell>
              </TableRow>
              {entry.doctors.map((d) => (
                <DoctorActions key={d.id} doctor={d} hospitals={hospitalRows} />
              ))}
            </Fragment>
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
