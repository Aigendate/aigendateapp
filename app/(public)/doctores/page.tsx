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
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Especialidad</TableHead>
              <TableHead>Hospital</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {doctors.map((d) => (
              <TableRow key={d.id}>
                <TableCell className="font-medium">{d.name}</TableCell>
                <TableCell>
                  <Badge variant="accent">{d.specialty}</Badge>
                </TableCell>
                <TableCell>{d.hospital_name}</TableCell>
              </TableRow>
            ))}
            {doctors.length === 0 && (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-muted-foreground">
                  No se encontraron doctores.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
