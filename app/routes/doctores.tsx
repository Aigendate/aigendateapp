import type { Route } from "./+types/doctores";
import { useSearchParams } from "react-router";
import { getDb, listDoctors } from "../../server/db.server";
import { Card, CardHeader, CardTitle, CardContent } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Input } from "~/components/ui/input";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "~/components/ui/table";

export function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const specialty = url.searchParams.get("specialty") || undefined;
  const name = url.searchParams.get("q") || undefined;
  const db = getDb();
  const doctors = listDoctors(db, { specialty, name });
  return { doctors, specialty: specialty ?? "", q: name ?? "" };
}

export default function Doctores({ loaderData }: Route.ComponentProps) {
  const { doctors, q } = loaderData;
  const [, setSearchParams] = useSearchParams();

  return (
    <Card>
      <CardHeader className="flex-row items-baseline justify-between">
        <CardTitle>Doctores</CardTitle>
        <Badge>{doctors.length}</Badge>
      </CardHeader>
      <CardContent>
        <Input
          placeholder="Buscar por nombre o especialidad..."
          defaultValue={q}
          className="mb-4"
          onChange={(e) => {
            const value = e.target.value;
            if (value) {
              setSearchParams({ q: value }, { replace: true });
            } else {
              setSearchParams({}, { replace: true });
            }
          }}
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
