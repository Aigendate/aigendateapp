"use client";

import { useState } from "react";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Input } from "~/components/ui/input";
import { TableRow, TableCell } from "~/components/ui/table";
import { ListboxSelect } from "~/components/ui/select";
import { Modal } from "~/components/ui/modal";
import { createWaitlistEntry, deleteWaitlistEntry } from "../actions";
import { PlusIcon, TrashIcon } from "@heroicons/react/16/solid";

interface WaitlistEntryView {
  id: string;
  patient_name: string;
  patient_phone: string | null;
  specialty: string;
  doctor_name: string | null;
  date_from: string;
  date_to: string;
  time_pref: string | null;
  priority: number;
}

interface Option {
  id: string;
  name: string;
}

interface DoctorOption extends Option {
  specialty: string;
}

const TIME_PREF_LABELS: Record<string, string> = {
  morning: "Mañana",
  afternoon: "Tarde",
};

const PRIORITY_COLORS: Record<number, string> = {
  0: "bg-muted",
  1: "bg-primary-light",
  2: "bg-primary-light",
  3: "bg-accent-light",
  4: "bg-accent-light",
  5: "bg-accent-light",
};

function priorityBarColor(priority: number): string {
  if (priority >= 8) return "bg-destructive";
  if (priority >= 5) return "bg-accent";
  if (priority >= 3) return "bg-primary";
  if (priority >= 1) return "bg-primary-light";
  return "bg-muted";
}

export function WaitlistCreateForm({
  patients,
  doctors,
  specialties,
}: {
  patients: Option[];
  doctors: DoctorOption[];
  specialties: string[];
}) {
  const [open, setOpen] = useState(false);
  const [patientId, setPatientId] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [doctorId, setDoctorId] = useState("");
  const [timePref, setTimePref] = useState("");

  const patientOptions = patients.map((p) => ({ value: p.id, label: p.name }));
  const specialtyOptions = specialties.map((s) => ({ value: s, label: s }));
  const doctorOptions = [
    { value: "", label: "Cualquier doctor" },
    ...doctors.map((d) => ({ value: d.id, label: d.name, description: d.specialty })),
  ];
  const timeOptions = [
    { value: "", label: "Cualquier horario" },
    { value: "morning", label: "Mañana" },
    { value: "afternoon", label: "Tarde" },
  ];

  const filteredDoctors = specialty
    ? doctorOptions.filter(
        (d) => d.value === "" || doctors.find((doc) => doc.id === d.value && doc.specialty === specialty)
      )
    : doctorOptions;

  async function handleSubmit(fd: FormData) {
    if (patientId) fd.set("patient_id", patientId);
    if (specialty) fd.set("specialty", specialty);
    if (doctorId) fd.set("doctor_id", doctorId);
    if (timePref) fd.set("time_pref", timePref);
    await createWaitlistEntry(fd);
    setOpen(false);
    setPatientId("");
    setSpecialty("");
    setDoctorId("");
    setTimePref("");
  }

  return (
    <>
      <Button variant="default" onClick={() => setOpen(true)}>
        <PlusIcon className="size-3" />
        Agregar a lista
      </Button>

      <Modal open={open} onClose={() => setOpen(false)} title="Agregar a lista de espera">
        <form
          action={handleSubmit}
          className="space-y-4"
        >
          <div>
            <label className="mb-1 block text-[0.65rem] uppercase tracking-wider text-muted-foreground">Paciente</label>
            <ListboxSelect
              value={patientId}
              onChange={setPatientId}
              options={patientOptions}
              placeholder="Seleccionar paciente..."
            />
          </div>
          <div>
            <label className="mb-1 block text-[0.65rem] uppercase tracking-wider text-muted-foreground">Especialidad</label>
            <ListboxSelect
              value={specialty}
              onChange={(v) => {
                setSpecialty(v);
                setDoctorId("");
              }}
              options={specialtyOptions}
              placeholder="Seleccionar especialidad..."
            />
          </div>
          <div>
            <label className="mb-1 block text-[0.65rem] uppercase tracking-wider text-muted-foreground">Doctor preferido</label>
            <ListboxSelect
              value={doctorId}
              onChange={setDoctorId}
              options={filteredDoctors}
              placeholder="Cualquier doctor"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-[0.65rem] uppercase tracking-wider text-muted-foreground">Desde</label>
              <Input name="date_from" type="date" required />
            </div>
            <div>
              <label className="mb-1 block text-[0.65rem] uppercase tracking-wider text-muted-foreground">Hasta</label>
              <Input name="date_to" type="date" required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-[0.65rem] uppercase tracking-wider text-muted-foreground">Horario preferido</label>
              <ListboxSelect
                value={timePref}
                onChange={setTimePref}
                options={timeOptions}
                placeholder="Cualquier horario"
              />
            </div>
            <div>
              <label className="mb-1 block text-[0.65rem] uppercase tracking-wider text-muted-foreground">Prioridad</label>
              <Input name="priority" type="number" defaultValue="0" min="0" max="10" className="w-20" />
            </div>
          </div>
          <div className="flex justify-end gap-2 border-t border-border pt-4">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit">Guardar</Button>
          </div>
        </form>
      </Modal>
    </>
  );
}

export function WaitlistActions({ entry }: { entry: WaitlistEntryView }) {
  return (
    <TableRow>
      <TableCell>
        <div className="flex items-center gap-2">
          <span className={`inline-block h-5 w-1 ${priorityBarColor(entry.priority)}`} />
          <span className="font-medium">{entry.patient_name}</span>
        </div>
      </TableCell>
      <TableCell className="text-muted-foreground">{entry.patient_phone ?? "—"}</TableCell>
      <TableCell>
        <Badge variant="accent">{entry.specialty}</Badge>
      </TableCell>
      <TableCell>{entry.doctor_name ?? "Cualquiera"}</TableCell>
      <TableCell>{entry.date_from}</TableCell>
      <TableCell>{entry.date_to}</TableCell>
      <TableCell>
        {entry.time_pref ? TIME_PREF_LABELS[entry.time_pref] ?? entry.time_pref : "Cualquiera"}
      </TableCell>
      <TableCell>
        <Badge
          variant={
            entry.priority >= 8
              ? "destructive"
              : entry.priority >= 5
                ? "accent"
                : entry.priority >= 1
                  ? "default"
                  : "outline"
          }
        >
          {entry.priority}
        </Badge>
      </TableCell>
      <TableCell className="text-right">
        <form action={deleteWaitlistEntry} className="inline">
          <input type="hidden" name="id" value={entry.id} />
          <Button
            type="submit"
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive"
          >
            <TrashIcon className="size-3" />
            Eliminar
          </Button>
        </form>
      </TableCell>
    </TableRow>
  );
}