import {
  listHospitals,
  listDoctors,
  listPatients,
  listAppointments,
  registerPatient,
  createAppointment,
  cancelAppointment,
  rescheduleAppointment,
  getAvailableSlots,
  addToWaitlist,
} from "../../../server/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Vapi POSTs tool calls here. We dispatch to the shared DB helpers and return
// short, voice-friendly strings. IDs are included so the model can chain calls
// (e.g. buscar_doctores -> agendar_turno). Tailored for the voice flow rather
// than reusing the MCP surface directly.

type ToolCall = {
  id: string;
  name?: string;
  arguments?: Record<string, unknown>;
  // Some Vapi payloads nest under `function`.
  function?: { name?: string; arguments?: Record<string, unknown> | string };
};

function getName(tc: ToolCall): string {
  return tc.name ?? tc.function?.name ?? "";
}

function getArgs(tc: ToolCall): Record<string, unknown> {
  const raw = tc.arguments ?? tc.function?.arguments ?? {};
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  return raw as Record<string, unknown>;
}

const str = (v: unknown): string | undefined =>
  typeof v === "string" && v.trim() ? v.trim() : undefined;

const MAX_RESULTS = 5;

async function dispatch(name: string, args: Record<string, unknown>): Promise<string> {
  switch (name) {
    case "buscar_hospitales": {
      const rows = await listHospitals({ name: str(args.nombre) });
      if (rows.length === 0) return "No encontré hospitales con ese nombre.";
      return rows
        .slice(0, MAX_RESULTS)
        .map((h) => `${h.name} (${h.address}) [id: ${h.id}]`)
        .join("; ");
    }

    case "buscar_doctores": {
      const rows = await listDoctors({
        name: str(args.nombre),
        specialty: str(args.especialidad),
        hospital_id: str(args.hospital_id),
        city: str(args.ciudad),
      });
      if (rows.length === 0)
        return "No encontré doctores con esos criterios.";
      return rows
        .slice(0, MAX_RESULTS)
        .map((d) => `${d.name} — ${d.specialty} en ${d.hospital_name} [doctor_id: ${d.id}, hospital_id: ${d.hospital_id}]`)
        .join("; ");
    }

    case "buscar_paciente": {
      const rows = await listPatients(str(args.nombre));
      if (rows.length === 0)
        return "No encontré ningún paciente registrado con ese nombre. Hay que registrarlo primero.";
      return rows
        .slice(0, MAX_RESULTS)
        .map((p) => `${p.name}${p.phone ? ` (${p.phone})` : ""} [patient_id: ${p.id}]`)
        .join("; ");
    }

    case "registrar_paciente": {
      const nombre = str(args.nombre);
      if (!nombre) return "Necesito el nombre del paciente para registrarlo.";
      const res = await registerPatient({
        name: nombre,
        phone: str(args.telefono),
        email: str(args.email),
      });
      if (!res.ok) return res.error;
      return `Paciente registrado: ${res.patient.name} [patient_id: ${res.patient.id}]`;
    }

    case "agendar_turno": {
      const hospital_id = str(args.hospital_id);
      const patient_id = str(args.patient_id);
      const doctor_id = str(args.doctor_id);
      const date = str(args.fecha);
      const time = str(args.hora);
      if (!hospital_id || !patient_id || !doctor_id || !date || !time)
        return "Faltan datos para agendar (hospital, paciente, doctor, fecha y hora).";
      const res = await createAppointment({ hospital_id, patient_id, doctor_id, date, time });
      if (!res.ok) return res.error;
      return `Turno agendado para el ${res.appointment.date} a las ${res.appointment.time}. [turno_id: ${res.appointment.id}]`;
    }

    case "cancelar_turno": {
      const id = str(args.turno_id);
      if (!id) return "Necesito el identificador del turno para cancelarlo.";
      const res = await cancelAppointment(id);
      if (!res.ok) return res.error;
      return `Turno cancelado: ${res.appointment.date} ${res.appointment.time} con ${res.appointment.doctor_name}.`;
    }

    case "consultar_disponibilidad": {
      const doctor_id = str(args.doctor_id);
      const fecha = str(args.fecha);
      if (!doctor_id || !fecha) return "Necesito el doctor y la fecha para ver la disponibilidad.";
      const slots = await getAvailableSlots(doctor_id, fecha);
      if (slots.length === 0)
        return `Ese día no tiene horarios libres (o no atiende). Probá con otra fecha.`;
      const shown = slots.slice(0, 8);
      return `Horarios libres el ${fecha}: ${shown.join(", ")}${
        slots.length > shown.length ? " (y algunos más)" : ""
      }.`;
    }

    case "reagendar_turno": {
      const nueva_fecha = str(args.nueva_fecha);
      const nueva_hora = str(args.nueva_hora);
      if (!nueva_fecha || !nueva_hora)
        return "Necesito la nueva fecha y hora para reprogramar el turno.";

      let turno_id = str(args.turno_id);
      // If no explicit turno_id, locate the patient's scheduled appointment(s).
      if (!turno_id) {
        const patient_id = str(args.patient_id);
        if (!patient_id)
          return "Necesito el turno a reprogramar (turno_id) o el paciente (patient_id).";
        const turnos = await listAppointments({ patient_id, status: "scheduled" });
        if (turnos.length === 0) return "No encontré turnos agendados para ese paciente.";
        if (turnos.length > 1) {
          const list = turnos
            .slice(0, 5)
            .map((t) => `${t.date} ${t.time} con ${t.doctor_name} [turno_id: ${t.id}]`)
            .join("; ");
          return `Esa persona tiene varios turnos; preguntá cuál quiere mover: ${list}`;
        }
        turno_id = turnos[0].id;
      }

      const res = await rescheduleAppointment(turno_id, nueva_fecha, nueva_hora);
      if (!res.ok) return res.error;
      return `Turno reprogramado para el ${res.appointment.date} a las ${res.appointment.time}. [turno_id: ${res.appointment.id}]`;
    }

    case "anotar_lista_espera": {
      const patient_id = str(args.patient_id);
      const especialidad = str(args.especialidad);
      const fecha_desde = str(args.fecha_desde);
      const fecha_hasta = str(args.fecha_hasta);
      if (!patient_id || !especialidad || !fecha_desde || !fecha_hasta)
        return "Para la lista de espera necesito el paciente, la especialidad y el rango de fechas.";
      await addToWaitlist({
        patient_id,
        doctor_id: str(args.doctor_id),
        specialty: especialidad,
        date_from: fecha_desde,
        date_to: fecha_hasta,
        time_pref: str(args.preferencia_horaria),
      });
      return `Listo, lo anoté en la lista de espera para ${especialidad} entre el ${fecha_desde} y el ${fecha_hasta}. Le avisamos cuando se libere un lugar.`;
    }

    default:
      return `Herramienta desconocida: ${name}`;
  }
}

export async function POST(request: Request): Promise<Response> {
  // Optional shared-secret check. Set VAPI_SERVER_SECRET here and as the tool's
  // server.secret in Vapi; if unset, the check is skipped.
  const expected = process.env.VAPI_SERVER_SECRET;
  if (expected && request.headers.get("x-vapi-secret") !== expected) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { message?: { type?: string; toolCallList?: ToolCall[] } };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }

  const message = body.message;
  // Vapi sends many message types (status-update, end-of-call-report, …).
  // We only act on tool-calls; everything else gets a benign 200.
  if (message?.type !== "tool-calls" || !Array.isArray(message.toolCallList)) {
    return Response.json({ results: [] });
  }

  const results = await Promise.all(
    message.toolCallList.map(async (tc) => {
      try {
        const result = await dispatch(getName(tc), getArgs(tc));
        return { toolCallId: tc.id, result };
      } catch (err) {
        return {
          toolCallId: tc.id,
          result: `Ocurrió un error procesando la solicitud. (${
            err instanceof Error ? err.message : "unknown"
          })`,
        };
      }
    }),
  );

  return Response.json({ results });
}
