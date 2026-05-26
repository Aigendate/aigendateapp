"use client";

import { useState } from "react";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { TableRow, TableCell } from "~/components/ui/table";
import { createDoctor, updateDoctor, deleteDoctor } from "../actions";

interface Doctor {
  id: string;
  name: string;
  specialty: string;
  hospital_id: string;
  hospital_name: string;
}

interface HospitalOption {
  id: string;
  name: string;
}

export function DoctorCreateForm({ hospitals }: { hospitals: HospitalOption[] }) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return <Button variant="default" onClick={() => setOpen(true)}>+ Nuevo Doctor</Button>;
  }

  return (
    <form
      action={async (fd) => {
        await createDoctor(fd);
        setOpen(false);
      }}
      className="flex items-center gap-2"
    >
      <input name="name" placeholder="Nombre" required className="border border-border bg-card px-3 py-1.5 text-[0.75rem]" />
      <input name="specialty" placeholder="Especialidad" required className="border border-border bg-card px-3 py-1.5 text-[0.75rem]" />
      <select name="hospital_id" required className="border border-border bg-card px-3 py-1.5 text-[0.75rem]">
        <option value="">Hospital...</option>
        {hospitals.map((h) => (
          <option key={h.id} value={h.id}>{h.name}</option>
        ))}
      </select>
      <Button type="submit" size="sm">Guardar</Button>
      <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>Cancelar</Button>
    </form>
  );
}

export function DoctorActions({ doctor, hospitals }: { doctor: Doctor; hospitals: HospitalOption[] }) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <TableRow>
        <TableCell colSpan={4}>
          <form
            action={async (fd) => {
              await updateDoctor(fd);
              setEditing(false);
            }}
            className="flex items-center gap-2"
          >
            <input type="hidden" name="id" value={doctor.id} />
            <input name="name" defaultValue={doctor.name} required className="border border-border bg-card px-3 py-1.5 text-[0.75rem] flex-1" />
            <input name="specialty" defaultValue={doctor.specialty} required className="border border-border bg-card px-3 py-1.5 text-[0.75rem] flex-1" />
            <select name="hospital_id" defaultValue={doctor.hospital_id} required className="border border-border bg-card px-3 py-1.5 text-[0.75rem] flex-1">
              {hospitals.map((h) => (
                <option key={h.id} value={h.id}>{h.name}</option>
              ))}
            </select>
            <Button type="submit" size="sm">Guardar</Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(false)}>Cancelar</Button>
          </form>
        </TableCell>
      </TableRow>
    );
  }

  return (
    <TableRow>
      <TableCell className="font-medium">{doctor.name}</TableCell>
      <TableCell>
        <Badge variant="accent">{doctor.specialty}</Badge>
      </TableCell>
      <TableCell>{doctor.hospital_name}</TableCell>
      <TableCell className="text-right">
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>Editar</Button>
          <form action={deleteDoctor} className="inline">
            <input type="hidden" name="id" value={doctor.id} />
            <Button type="submit" variant="ghost" size="sm" className="text-destructive hover:text-destructive">
              Eliminar
            </Button>
          </form>
        </div>
      </TableCell>
    </TableRow>
  );
}
