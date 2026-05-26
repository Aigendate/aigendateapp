"use client";

import { useState } from "react";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { TableRow, TableCell } from "~/components/ui/table";
import { createAppointment, cancelAppointment, deleteAppointment } from "../actions";

interface Turno {
  id: string;
  date: string;
  time: string;
  status: string;
  patient_name: string;
  doctor_name: string;
  specialty: string;
  hospital_name: string;
}

interface Option {
  id: string;
  name: string;
}

interface DoctorOption extends Option {
  specialty: string;
  hospital_id: string;
}

export function TurnoCreateForm({
  hospitals,
  patients,
  doctors,
}: {
  hospitals: Option[];
  patients: Option[];
  doctors: DoctorOption[];
}) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return <Button variant="default" onClick={() => setOpen(true)}>+ Nuevo Turno</Button>;
  }

  return (
    <form
      action={async (fd) => {
        await createAppointment(fd);
        setOpen(false);
      }}
      className="flex flex-wrap items-center gap-2"
    >
      <select name="hospital_id" required className="border border-border bg-card px-3 py-1.5 text-[0.75rem]">
        <option value="">Hospital...</option>
        {hospitals.map((h) => (
          <option key={h.id} value={h.id}>{h.name}</option>
        ))}
      </select>
      <select name="patient_id" required className="border border-border bg-card px-3 py-1.5 text-[0.75rem]">
        <option value="">Paciente...</option>
        {patients.map((p) => (
          <option key={p.id} value={p.id}>{p.name}</option>
        ))}
      </select>
      <select name="doctor_id" required className="border border-border bg-card px-3 py-1.5 text-[0.75rem]">
        <option value="">Doctor...</option>
        {doctors.map((d) => (
          <option key={d.id} value={d.id}>{d.name} ({d.specialty})</option>
        ))}
      </select>
      <input name="date" type="date" required className="border border-border bg-card px-3 py-1.5 text-[0.75rem]" />
      <input name="time" type="time" required className="border border-border bg-card px-3 py-1.5 text-[0.75rem]" />
      <Button type="submit" size="sm">Guardar</Button>
      <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>Cancelar</Button>
    </form>
  );
}

export function TurnoActions({ turno }: { turno: Turno }) {
  return (
    <TableRow>
      <TableCell>{turno.date}</TableCell>
      <TableCell>{turno.time}</TableCell>
      <TableCell>{turno.patient_name}</TableCell>
      <TableCell>{turno.doctor_name}</TableCell>
      <TableCell>
        <Badge variant="accent">{turno.specialty}</Badge>
      </TableCell>
      <TableCell>{turno.hospital_name}</TableCell>
      <TableCell>
        <Badge variant={turno.status === "scheduled" ? "default" : "destructive"}>
          {turno.status === "scheduled" ? "activo" : "cancelado"}
        </Badge>
      </TableCell>
      <TableCell className="text-right">
        <div className="flex justify-end gap-1">
          {turno.status === "scheduled" && (
            <form action={cancelAppointment} className="inline">
              <input type="hidden" name="id" value={turno.id} />
              <Button type="submit" variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                Cancelar
              </Button>
            </form>
          )}
          <form action={deleteAppointment} className="inline">
            <input type="hidden" name="id" value={turno.id} />
            <Button type="submit" variant="ghost" size="sm" className="text-destructive hover:text-destructive">
              Eliminar
            </Button>
          </form>
        </div>
      </TableCell>
    </TableRow>
  );
}
