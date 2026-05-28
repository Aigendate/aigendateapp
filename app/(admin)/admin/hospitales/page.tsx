import { asc, ilike } from "drizzle-orm";
import { db } from "../../../../server/client";
import { hospitals, doctors } from "../../../../server/schema";
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
import { HospitalActions, HospitalCreateForm, type HospitalDoctor } from "./client";

export default async function AdminHospitalesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const [rows, doctorRows] = await Promise.all([
    db
      .select()
      .from(hospitals)
      .where(q ? ilike(hospitals.name, `%${q}%`) : undefined)
      .orderBy(asc(hospitals.city), asc(hospitals.name)),
    db
      .select({
        id: doctors.id,
        name: doctors.name,
        specialty: doctors.specialty,
        hospital_id: doctors.hospital_id,
      })
      .from(doctors)
      .orderBy(asc(doctors.specialty), asc(doctors.name)),
  ]);

  // Bucket doctors by hospital so each row can expand to its roster without a
  // round-trip; rows are pre-sorted by specialty for grouping in the client.
  const doctorsByHospital = new Map<string, HospitalDoctor[]>();
  for (const d of doctorRows) {
    const bucket = doctorsByHospital.get(d.hospital_id) ?? [];
    bucket.push(d);
    doctorsByHospital.set(d.hospital_id, bucket);
  }

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
            <TableHead>Ciudad</TableHead>
            <TableHead>Direccion</TableHead>
            <TableHead>Lat</TableHead>
            <TableHead>Lng</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((h) => (
            <HospitalActions
              key={h.id}
              hospital={h}
              doctors={doctorsByHospital.get(h.id) ?? []}
            />
          ))}
          {rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-muted-foreground">
                No se encontraron hospitales.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </>
  );
}
