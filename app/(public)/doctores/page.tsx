import Link from "next/link";
import { listDoctors } from "../../../server/db.server";
import { Card, CardHeader, CardTitle, CardContent } from "~/components/ui/card";
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

export default async function DoctoresPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; specialty?: string }>;
}) {
  const { q, specialty } = await searchParams;
  const doctors = await listDoctors({ specialty, name: q });

  // Rows arrive pre-sorted by specialty then name → group in a single pass.
  const groups = new Map<string, typeof doctors>();
  for (const d of doctors) {
    const bucket = groups.get(d.specialty) ?? [];
    bucket.push(d);
    groups.set(d.specialty, bucket);
  }

  return (
    <Card>
      <CardHeader className="flex-row items-baseline justify-between">
        <CardTitle>Doctores</CardTitle>
        <Badge>{doctors.length}</Badge>
      </CardHeader>
      <CardContent>
        <SearchInput
          placeholder="Buscar por nombre o especialidad..."
          defaultValue={q ?? ""}
          className="mb-4"
        />
        {doctors.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            No se encontraron doctores.
          </div>
        ) : (
          <div className="space-y-6">
            {[...groups.entries()].map(([spec, docs]) => (
              <div key={spec}>
                <div className="mb-2 flex items-baseline gap-2 border-b border-muted pb-1">
                  <Badge variant="accent">{spec}</Badge>
                  <span className="text-[0.65rem] text-muted-foreground">
                    {docs.length} {docs.length === 1 ? "doctor" : "doctores"}
                  </span>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Hospital</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {docs.map((d) => (
                      <TableRow key={d.id}>
                        <TableCell className="font-medium">{d.name}</TableCell>
                        <TableCell>
                          <Link
                            href={`/hospitales/${d.hospital_id}`}
                            className="text-muted-foreground underline-offset-2 transition-colors hover:text-foreground hover:underline"
                          >
                            {d.hospital_name}
                          </Link>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
