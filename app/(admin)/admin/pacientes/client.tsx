"use client";

import { useState } from "react";
import { Button } from "~/components/ui/button";
import { TableRow, TableCell } from "~/components/ui/table";
import { createPatient, updatePatient, deletePatient } from "../actions";

interface Patient {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  created_at: Date;
}

export function PacienteCreateForm() {
  const [open, setOpen] = useState(false);

  if (!open) {
    return <Button variant="default" onClick={() => setOpen(true)}>+ Nuevo Paciente</Button>;
  }

  return (
    <form
      action={async (fd) => {
        await createPatient(fd);
        setOpen(false);
      }}
      className="flex items-center gap-2"
    >
      <input name="name" placeholder="Nombre" required className="border border-border bg-card px-3 py-1.5 text-[0.75rem]" />
      <input name="email" placeholder="Email" type="email" className="border border-border bg-card px-3 py-1.5 text-[0.75rem]" />
      <input name="phone" placeholder="Telefono" className="border border-border bg-card px-3 py-1.5 text-[0.75rem]" />
      <Button type="submit" size="sm">Guardar</Button>
      <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>Cancelar</Button>
    </form>
  );
}

export function PacienteActions({ patient }: { patient: Patient }) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <TableRow>
        <TableCell colSpan={5}>
          <form
            action={async (fd) => {
              await updatePatient(fd);
              setEditing(false);
            }}
            className="flex items-center gap-2"
          >
            <input type="hidden" name="id" value={patient.id} />
            <input name="name" defaultValue={patient.name} required className="border border-border bg-card px-3 py-1.5 text-[0.75rem] flex-1" />
            <input name="email" defaultValue={patient.email ?? ""} type="email" className="border border-border bg-card px-3 py-1.5 text-[0.75rem] flex-1" />
            <input name="phone" defaultValue={patient.phone ?? ""} className="border border-border bg-card px-3 py-1.5 text-[0.75rem] flex-1" />
            <Button type="submit" size="sm">Guardar</Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(false)}>Cancelar</Button>
          </form>
        </TableCell>
      </TableRow>
    );
  }

  return (
    <TableRow>
      <TableCell className="font-medium">{patient.name}</TableCell>
      <TableCell>{patient.email}</TableCell>
      <TableCell>{patient.phone}</TableCell>
      <TableCell className="text-muted-foreground">
        {patient.created_at.toLocaleDateString("es-PY")}
      </TableCell>
      <TableCell className="text-right">
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>Editar</Button>
          <form action={deletePatient} className="inline">
            <input type="hidden" name="id" value={patient.id} />
            <Button type="submit" variant="ghost" size="sm" className="text-destructive hover:text-destructive">
              Eliminar
            </Button>
          </form>
        </div>
      </TableCell>
    </TableRow>
  );
}
