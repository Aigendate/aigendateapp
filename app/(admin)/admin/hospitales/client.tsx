"use client";

import { useState } from "react";
import { ChevronRightIcon } from "@heroicons/react/16/solid";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { TableRow, TableCell } from "~/components/ui/table";
import { cn } from "~/lib/utils";
import { createHospital, updateHospital, deleteHospital } from "../actions";

interface Hospital {
  id: string;
  name: string;
  address: string;
  city: string | null;
  lat: number;
  lng: number;
}

export interface HospitalDoctor {
  id: string;
  name: string;
  specialty: string;
  hospital_id: string;
}

export function HospitalCreateForm() {
  const [open, setOpen] = useState(false);

  if (!open) {
    return <Button variant="default" onClick={() => setOpen(true)}>+ Nuevo Hospital</Button>;
  }

  return (
    <form
      action={async (fd) => {
        await createHospital(fd);
        setOpen(false);
      }}
      className="flex flex-wrap items-center gap-2"
    >
      <input name="name" placeholder="Nombre" required className="border border-border bg-card px-3 py-1.5 text-[0.75rem]" />
      <input name="city" placeholder="Ciudad" className="border border-border bg-card px-3 py-1.5 text-[0.75rem] w-32" />
      <input name="address" placeholder="Direccion" required className="border border-border bg-card px-3 py-1.5 text-[0.75rem]" />
      <input name="lat" placeholder="Lat" type="number" step="any" className="border border-border bg-card px-3 py-1.5 text-[0.75rem] w-20" />
      <input name="lng" placeholder="Lng" type="number" step="any" className="border border-border bg-card px-3 py-1.5 text-[0.75rem] w-20" />
      <Button type="submit" size="sm">Guardar</Button>
      <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>Cancelar</Button>
    </form>
  );
}

export function HospitalActions({
  hospital,
  doctors,
}: {
  hospital: Hospital;
  doctors: HospitalDoctor[];
}) {
  const [editing, setEditing] = useState(false);
  const [expanded, setExpanded] = useState(false);

  if (editing) {
    return (
      <TableRow>
        <TableCell colSpan={6}>
          <form
            action={async (fd) => {
              await updateHospital(fd);
              setEditing(false);
            }}
            className="flex flex-wrap items-center gap-2"
          >
            <input type="hidden" name="id" value={hospital.id} />
            <input name="name" defaultValue={hospital.name} required className="border border-border bg-card px-3 py-1.5 text-[0.75rem] flex-1" />
            <input name="city" defaultValue={hospital.city ?? ""} placeholder="Ciudad" className="border border-border bg-card px-3 py-1.5 text-[0.75rem] w-32" />
            <input name="address" defaultValue={hospital.address} required className="border border-border bg-card px-3 py-1.5 text-[0.75rem] flex-1" />
            <input name="lat" defaultValue={hospital.lat} type="number" step="any" className="border border-border bg-card px-3 py-1.5 text-[0.75rem] w-20" />
            <input name="lng" defaultValue={hospital.lng} type="number" step="any" className="border border-border bg-card px-3 py-1.5 text-[0.75rem] w-20" />
            <Button type="submit" size="sm">Guardar</Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(false)}>Cancelar</Button>
          </form>
        </TableCell>
      </TableRow>
    );
  }

  // Specialties present at this hospital, in the order doctors arrived (sorted).
  const specialties: string[] = [];
  for (const d of doctors) if (!specialties.includes(d.specialty)) specialties.push(d.specialty);

  return (
    <>
      <TableRow>
        <TableCell className="font-medium">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="flex items-center gap-1.5 text-left"
            aria-expanded={expanded}
          >
            <ChevronRightIcon
              className={cn("size-3.5 shrink-0 text-muted-foreground transition-transform", expanded && "rotate-90")}
            />
            {hospital.name}
            <span className="text-[0.6rem] text-muted-foreground">({doctors.length})</span>
          </button>
        </TableCell>
        <TableCell className="text-muted-foreground">{hospital.city ?? "—"}</TableCell>
        <TableCell>{hospital.address}</TableCell>
        <TableCell className="text-muted-foreground">{hospital.lat}</TableCell>
        <TableCell className="text-muted-foreground">{hospital.lng}</TableCell>
        <TableCell className="text-right">
          <div className="flex justify-end gap-1">
            <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>Editar</Button>
            <form action={deleteHospital} className="inline">
              <input type="hidden" name="id" value={hospital.id} />
              <Button type="submit" variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                Eliminar
              </Button>
            </form>
          </div>
        </TableCell>
      </TableRow>
      {expanded && (
        <TableRow>
          <TableCell colSpan={6} className="bg-muted/30">
            {doctors.length === 0 ? (
              <div className="py-2 text-[0.7rem] text-muted-foreground">
                Sin doctores registrados.
              </div>
            ) : (
              <div className="flex flex-wrap gap-x-8 gap-y-3 py-1">
                {specialties.map((spec) => (
                  <div key={spec} className="min-w-[140px]">
                    <div className="mb-1">
                      <Badge variant="accent">{spec}</Badge>
                    </div>
                    <ul className="space-y-0.5 text-[0.72rem]">
                      {doctors
                        .filter((d) => d.specialty === spec)
                        .map((d) => (
                          <li key={d.id}>{d.name}</li>
                        ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </TableCell>
        </TableRow>
      )}
    </>
  );
}
