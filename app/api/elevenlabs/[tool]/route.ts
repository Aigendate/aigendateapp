import { eq } from "drizzle-orm";
import { db } from "../../../../server/client";
import { doctors, hospitals, patients } from "../../../../server/schema";
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
} from "../../../../server/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ElevenLabs Agents server (webhook) tools POST here. Each tool is configured
// with url `${base}/api/elevenlabs/<tool_name>`, so the tool name comes from the
// path segment and the body is the flat JSON of the tool's parameters.
//
// Unlike Vapi, the browser SDK never sees tool *arguments* — only the result
// string (onAgentToolResponse.full_tool_result). So we return BOTH a
// voice-friendly `message` (what the agent speaks from) AND a structured `card`
// for the /asistente-eleven page to render live. The agent is told to base its
// reply on `message`.
//
// This route is intentionally self-contained (it duplicates the dispatch + card
// logic of app/api/vapi/route.ts + app/api/agent-ui/route.ts) so the working
// Vapi assistant is untouched.

const str = (v: unknown): string | undefined =>
  typeof v === "string" && v.trim() ? v.trim() : undefined;

const MAX_RESULTS = 5;

// ---- Voice-friendly result strings (what the agent reads) ------------------

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
      if (rows.length === 0) return "No encontré doctores con esos criterios.";
      return rows
        .slice(0, MAX_RESULTS)
        .map(
          (d) =>
            `${d.name} — ${d.specialty} en ${d.hospital_name} [doctor_id: ${d.id}, hospital_id: ${d.hospital_id}]`,
        )
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

// ---- Structured card data (for the browser UI feed) ------------------------

async function lookupDoctor(id: string) {
  const [row] = await db
    .select({
      id: doctors.id,
      name: doctors.name,
      specialty: doctors.specialty,
      hospital_id: doctors.hospital_id,
      hospital_name: hospitals.name,
      hospital_address: hospitals.address,
    })
    .from(doctors)
    .innerJoin(hospitals, eq(doctors.hospital_id, hospitals.id))
    .where(eq(doctors.id, id))
    .limit(1);
  return row;
}

async function lookupPatient(id: string) {
  const [row] = await db
    .select({ id: patients.id, name: patients.name, phone: patients.phone })
    .from(patients)
    .where(eq(patients.id, id))
    .limit(1);
  return row;
}

async function preview(
  name: string,
  args: Record<string, unknown>,
): Promise<Record<string, unknown> | null> {
  switch (name) {
    case "buscar_doctores": {
      const rows = await listDoctors({
        name: str(args.nombre),
        specialty: str(args.especialidad),
        hospital_id: str(args.hospital_id),
        city: str(args.ciudad),
      });
      return {
        kind: "doctores",
        query: {
          especialidad: str(args.especialidad) ?? null,
          ciudad: str(args.ciudad) ?? null,
          nombre: str(args.nombre) ?? null,
        },
        doctores: rows.slice(0, 6),
      };
    }

    case "buscar_hospitales": {
      const rows = await listHospitals({ name: str(args.nombre) });
      return {
        kind: "hospitales",
        query: { nombre: str(args.nombre) ?? null },
        hospitales: rows.slice(0, 6).map((h) => ({ id: h.id, name: h.name, address: h.address })),
      };
    }

    case "consultar_disponibilidad": {
      const doctor_id = str(args.doctor_id);
      const fecha = str(args.fecha);
      if (!doctor_id || !fecha) return null;
      const [slots, doctor] = await Promise.all([
        getAvailableSlots(doctor_id, fecha),
        lookupDoctor(doctor_id),
      ]);
      return { kind: "disponibilidad", fecha, doctor: doctor ?? null, slots };
    }

    case "agendar_turno":
    case "reagendar_turno": {
      const doctor_id = str(args.doctor_id);
      const patient_id = str(args.patient_id);
      const [doctor, patient] = await Promise.all([
        doctor_id ? lookupDoctor(doctor_id) : Promise.resolve(undefined),
        patient_id ? lookupPatient(patient_id) : Promise.resolve(undefined),
      ]);
      return {
        kind: "turno",
        accion: name === "reagendar_turno" ? "reprogramado" : "agendado",
        fecha: str(args.fecha) ?? str(args.nueva_fecha) ?? null,
        hora: str(args.hora) ?? str(args.nueva_hora) ?? null,
        doctor: doctor ?? null,
        patient: patient ?? null,
      };
    }

    case "anotar_lista_espera": {
      const patient_id = str(args.patient_id);
      const patient = patient_id ? await lookupPatient(patient_id) : undefined;
      return {
        kind: "lista_espera",
        especialidad: str(args.especialidad) ?? null,
        fecha_desde: str(args.fecha_desde) ?? null,
        fecha_hasta: str(args.fecha_hasta) ?? null,
        preferencia: str(args.preferencia_horaria) ?? null,
        patient: patient ?? null,
      };
    }

    case "buscar_paciente":
    case "registrar_paciente": {
      const patient_id = str(args.patient_id);
      const patient = patient_id ? await lookupPatient(patient_id) : undefined;
      return {
        kind: "paciente",
        registrado: name === "registrar_paciente",
        nombre: patient?.name ?? str(args.nombre) ?? null,
        telefono: patient?.phone ?? str(args.telefono) ?? null,
      };
    }

    default:
      return null;
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ tool: string }> },
): Promise<Response> {
  // Optional shared-secret check. Set ELEVENLABS_WEBHOOK_SECRET here and as the
  // tool's `x-elevenlabs-secret` request header (the setup script wires it up);
  // if unset, the check is skipped.
  const expected = process.env.ELEVENLABS_WEBHOOK_SECRET;
  if (expected && request.headers.get("x-elevenlabs-secret") !== expected) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const { tool } = await params;

  let args: Record<string, unknown>;
  try {
    const raw = await request.json();
    args = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  } catch {
    args = {};
  }

  try {
    const [message, card] = await Promise.all([dispatch(tool, args), preview(tool, args)]);
    return Response.json({ message, card });
  } catch (err) {
    return Response.json(
      {
        message: `Ocurrió un error procesando la solicitud. (${
          err instanceof Error ? err.message : "unknown"
        })`,
        card: null,
      },
      { status: 200 },
    );
  }
}
