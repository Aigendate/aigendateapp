"use client";

import { useState, useMemo } from "react";
import { useNextCalendarApp, ScheduleXCalendar } from "@schedule-x/react";
import {
  createViewWeek,
  createViewDay,
  createViewMonthGrid,
  createViewMonthAgenda,
} from "@schedule-x/calendar";
import { createEventsServicePlugin } from "@schedule-x/events-service";
import { createCurrentTimePlugin } from "@schedule-x/current-time";
import "temporal-polyfill/global";
import "@schedule-x/theme-default/dist/index.css";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { ListboxSelect } from "~/components/ui/select";
import { Modal } from "~/components/ui/modal";
import { cancelAndOfferWaitlist, offerSlotToWaitlistEntry } from "../actions";
import { XMarkIcon, XCircleIcon, PhoneIcon, CheckCircleIcon, UserPlusIcon } from "@heroicons/react/16/solid";
import {
  CalendarDaysIcon,
  UserIcon,
  BuildingOfficeIcon,
  ClockIcon,
  TagIcon,
} from "@heroicons/react/16/solid";

interface AgendaEvent {
  id: string;
  title: string;
  date: string;
  timeStart: string;
  timeEnd: string;
  patient: string;
  patientPhone: string | null;
  doctor: string;
  specialty: string;
  hospital: string;
  status: string;
  doctorId: string;
  hospitalId: string;
}

interface DoctorOption {
  id: string;
  name: string;
  specialty: string;
}

interface SelectedInfo {
  appointmentId: string;
  patient: string;
  patientPhone: string | null;
  doctor: string;
  specialty: string;
  hospital: string;
  status: string;
  date: string;
  time: string;
  doctorId: string;
  hospitalId: string;
}

const STATUS_LABELS: Record<string, string> = {
  scheduled: "Programado",
  completed: "Completado",
  cancelled: "Cancelado",
  "no-show": "No asistio",
};

const STATUS_VARIANT: Record<string, "default" | "accent" | "destructive"> = {
  scheduled: "default",
  completed: "accent",
  cancelled: "destructive",
};

const TIMEZONE = "America/Asuncion";

function toZonedDate(date: string, time: string) {
  const pdt = Temporal.PlainDateTime.from(`${date}T${time}`);
  return pdt.toZonedDateTime(TIMEZONE);
}

export function AgendaCalendar({
  events,
  doctors,
}: {
  events: AgendaEvent[];
  doctors: DoctorOption[];
}) {
  const [selected, setSelected] = useState<SelectedInfo | null>(null);
  const [filterDoctor, setFilterDoctor] = useState<string>("");
  const [waitlistCandidates, setWaitlistCandidates] = useState<
    { id: string; patient_name: string; patient_phone: string | null }[]
  >([]);
  const [cancelledSlot, setCancelledSlot] = useState<{
    date: string; time: string; doctorId: string; hospitalId: string;
  } | null>(null);

  const filtered = useMemo(
    () =>
      filterDoctor
        ? events.filter((e) => e.doctorId === filterDoctor)
        : events,
    [events, filterDoctor]
  );

  const sxEvents = useMemo(
    () =>
      filtered.map((e) => ({
        id: e.id,
        title: e.title,
        start: toZonedDate(e.date, e.timeStart),
        end: toZonedDate(e.date, e.timeEnd),
        calendarId: e.status === "completed" ? "completed" : "scheduled",
      })),
    [filtered]
  );

  const eventsService = useMemo(() => createEventsServicePlugin(), []);

  const calendar = useNextCalendarApp({
    views: [createViewDay(), createViewWeek(), createViewMonthGrid(), createViewMonthAgenda()],
    events: sxEvents,
    plugins: [eventsService, createCurrentTimePlugin()],
    locale: "es-ES",
    dayBoundaries: {
      start: "07:00",
      end: "20:00",
    },
    weekOptions: {
      gridHeight: 2000,
      gridStep: 30,
      timeAxisFormatOptions: { hour: "2-digit", minute: "2-digit" },
    },
    calendars: {
      scheduled: {
        colorName: "scheduled",
        lightColors: {
          main: "#1A6B5A",
          container: "#D2EDE6",
          onContainer: "#0d3d31",
        },
      },
      completed: {
        colorName: "completed",
        lightColors: {
          main: "#C4510A",
          container: "#F4DFC8",
          onContainer: "#7a3206",
        },
      },
    },
    callbacks: {
      onEventClick(calendarEvent) {
        const match = events.find((e) => e.id === calendarEvent.id);
        if (!match) return;
        setSelected({
          appointmentId: match.id,
          patient: match.patient,
          patientPhone: match.patientPhone,
          doctor: match.doctor,
          specialty: match.specialty,
          hospital: match.hospital,
          status: match.status,
          date: match.date,
          time: match.timeStart,
          doctorId: match.doctorId,
          hospitalId: match.hospitalId,
        });
      },
    },
  });

  const doctorOptions = [
    { value: "", label: "Todos los doctores" },
    ...doctors.map((d) => ({
      value: d.id,
      label: d.name,
      description: d.specialty,
    })),
  ];

  return (
    <div>
      <div className="relative z-50 mb-4 flex items-center gap-3">
        <ListboxSelect
          value={filterDoctor}
          onChange={setFilterDoctor}
          options={doctorOptions}
          placeholder="Todos los doctores"
          className="w-56"
        />
        {filterDoctor && (
          <Button variant="ghost" size="sm" onClick={() => setFilterDoctor("")}>
            <XMarkIcon className="size-3" />
            Limpiar
          </Button>
        )}
      </div>

      <div className="sx-react-calendar-wrapper border border-border bg-card">
        <ScheduleXCalendar calendarApp={calendar} />
      </div>

      <Modal
        open={!!selected}
        onClose={() => {
          setSelected(null);
          setCancelledSlot(null);
          setWaitlistCandidates([]);
        }}
        title="Detalle del turno"
      >
        {selected && (
          <div className="space-y-3 text-[0.8rem]">
            <div className="flex items-start gap-2">
              <UserIcon className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
              <div>
                <div className="text-[0.65rem] uppercase tracking-wider text-muted-foreground">Paciente</div>
                <div className="font-medium">{selected.patient}</div>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <TagIcon className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
              <div>
                <div className="text-[0.65rem] uppercase tracking-wider text-muted-foreground">Doctor / Especialidad</div>
                <div className="font-medium">{selected.doctor}</div>
                <Badge variant="accent" className="mt-0.5">{selected.specialty}</Badge>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <BuildingOfficeIcon className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
              <div>
                <div className="text-[0.65rem] uppercase tracking-wider text-muted-foreground">Hospital</div>
                <div>{selected.hospital}</div>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <CalendarDaysIcon className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
              <div>
                <div className="text-[0.65rem] uppercase tracking-wider text-muted-foreground">Fecha</div>
                <div>{selected.date}</div>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <ClockIcon className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
              <div>
                <div className="text-[0.65rem] uppercase tracking-wider text-muted-foreground">Hora</div>
                <div>{selected.time}</div>
              </div>
            </div>
            <div className="border-t border-border pt-3">
              <div className="text-[0.65rem] uppercase tracking-wider text-muted-foreground">Estado</div>
              <Badge
                variant={STATUS_VARIANT[selected.status] ?? "default"}
                className="mt-1"
              >
                {STATUS_LABELS[selected.status] ?? selected.status}
              </Badge>
            </div>
            {selected.status === "scheduled" && !cancelledSlot && (
              <div className="flex flex-col gap-2 border-t border-border pt-3">
                {selected.patientPhone ? (
                  <a
                    href={`tel:${selected.patientPhone}`}
                    className="inline-flex w-full items-center justify-center gap-2 border border-primary bg-primary px-3 py-1.5 text-[0.75rem] font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                  >
                    <PhoneIcon className="size-3.5" />
                    Llamar para confirmar
                  </a>
                ) : (
                  <span className="text-[0.7rem] text-muted-foreground">Sin teléfono registrado</span>
                )}
                <form
                  action={async (fd) => {
                    const result = await cancelAndOfferWaitlist(fd);
                    if (result.candidates.length > 0) {
                      setWaitlistCandidates(result.candidates);
                      setCancelledSlot({
                        date: selected.date,
                        time: selected.time,
                        doctorId: selected.doctorId,
                        hospitalId: selected.hospitalId,
                      });
                    } else {
                      setSelected(null);
                    }
                  }}
                >
                  <input type="hidden" name="id" value={selected.appointmentId} />
                  <Button
                    type="submit"
                    variant="ghost"
                    size="sm"
                    className="w-full text-destructive hover:text-destructive"
                  >
                    <XCircleIcon className="size-3.5" />
                    Cancelar turno
                  </Button>
                </form>
              </div>
            )}
            {cancelledSlot && waitlistCandidates.length > 0 && (
              <div className="space-y-3 border-t border-border pt-3">
                <div className="flex items-center gap-2 text-[0.75rem] font-medium text-primary">
                  <CheckCircleIcon className="size-4" />
                  Turno cancelado
                </div>
                <div className="text-[0.7rem] text-muted-foreground">
                  {waitlistCandidates.length} paciente(s) en lista de espera para esta especialidad:
                </div>
                <div className="space-y-2">
                  {waitlistCandidates.map((c) => (
                    <div key={c.id} className="flex items-center justify-between gap-2 border border-border p-2">
                      <div>
                        <div className="text-[0.75rem] font-medium">{c.patient_name}</div>
                        {c.patient_phone && (
                          <div className="text-[0.65rem] text-muted-foreground">{c.patient_phone}</div>
                        )}
                      </div>
                      <form
                        action={async (fd) => {
                          await offerSlotToWaitlistEntry(fd);
                          setSelected(null);
                          setCancelledSlot(null);
                          setWaitlistCandidates([]);
                        }}
                      >
                        <input type="hidden" name="waitlist_id" value={c.id} />
                        <input type="hidden" name="date" value={cancelledSlot.date} />
                        <input type="hidden" name="time" value={cancelledSlot.time} />
                        <input type="hidden" name="doctor_id" value={cancelledSlot.doctorId} />
                        <input type="hidden" name="hospital_id" value={cancelledSlot.hospitalId} />
                        <Button type="submit" size="sm" className="gap-1">
                          <UserPlusIcon className="size-3" />
                          Asignar
                        </Button>
                      </form>
                    </div>
                  ))}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full"
                  onClick={() => {
                    setSelected(null);
                    setCancelledSlot(null);
                    setWaitlistCandidates([]);
                  }}
                >
                  Cerrar sin asignar
                </Button>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}