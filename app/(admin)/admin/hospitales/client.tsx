"use client";

import { useState } from "react";
import { Button } from "~/components/ui/button";
import { TableRow, TableCell } from "~/components/ui/table";
import { createHospital, updateHospital, deleteHospital } from "../actions";

interface Hospital {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
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
      className="flex items-center gap-2"
    >
      <input name="name" placeholder="Nombre" required className="border border-border bg-card px-3 py-1.5 text-[0.75rem]" />
      <input name="address" placeholder="Direccion" required className="border border-border bg-card px-3 py-1.5 text-[0.75rem]" />
      <input name="lat" placeholder="Lat" type="number" step="any" className="border border-border bg-card px-3 py-1.5 text-[0.75rem] w-20" />
      <input name="lng" placeholder="Lng" type="number" step="any" className="border border-border bg-card px-3 py-1.5 text-[0.75rem] w-20" />
      <Button type="submit" size="sm">Guardar</Button>
      <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>Cancelar</Button>
    </form>
  );
}

export function HospitalActions({ hospital }: { hospital: Hospital }) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <TableRow>
        <TableCell colSpan={5}>
          <form
            action={async (fd) => {
              await updateHospital(fd);
              setEditing(false);
            }}
            className="flex items-center gap-2"
          >
            <input type="hidden" name="id" value={hospital.id} />
            <input name="name" defaultValue={hospital.name} required className="border border-border bg-card px-3 py-1.5 text-[0.75rem] flex-1" />
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

  return (
    <TableRow>
      <TableCell className="font-medium">{hospital.name}</TableCell>
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
  );
}
