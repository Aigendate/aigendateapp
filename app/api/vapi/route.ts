import {
  listHospitals,
  listDoctors,
  listPatients,
  registerPatient,
  createAppointment,
  cancelAppointment,
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
      if (rows.length === 0) return "No encontré hospitales con ese nombre. / No hospitals found.";
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
      });
      if (rows.length === 0)
        return "No encontré doctores con esos criterios. / No doctors found.";
      return rows
        .slice(0, MAX_RESULTS)
        .map((d) => `Dr. ${d.name} — ${d.specialty} en ${d.hospital_name} [doctor_id: ${d.id}, hospital_id: ${d.hospital_id}]`)
        .join("; ");
    }

    case "buscar_paciente": {
      const rows = await listPatients(str(args.nombre));
      if (rows.length === 0)
        return "No encontré ningún paciente registrado con ese nombre. / No patient found — register them first.";
      return rows
        .slice(0, MAX_RESULTS)
        .map((p) => `${p.name}${p.phone ? ` (${p.phone})` : ""} [patient_id: ${p.id}]`)
        .join("; ");
    }

    case "registrar_paciente": {
      const nombre = str(args.nombre);
      if (!nombre) return "Necesito el nombre del paciente para registrarlo. / A name is required.";
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
        return "Faltan datos para agendar (hospital, paciente, doctor, fecha y hora). / Missing booking details.";
      const res = await createAppointment({ hospital_id, patient_id, doctor_id, date, time });
      if (!res.ok) return res.error;
      return `Turno agendado para el ${res.appointment.date} a las ${res.appointment.time}. [turno_id: ${res.appointment.id}]`;
    }

    case "cancelar_turno": {
      const id = str(args.turno_id);
      if (!id) return "Necesito el identificador del turno para cancelarlo. / An appointment id is required.";
      const res = await cancelAppointment(id);
      if (!res.ok) return res.error;
      return `Turno cancelado: ${res.appointment.date} ${res.appointment.time} con Dr. ${res.appointment.doctor_name}.`;
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
          result: `Ocurrió un error procesando la solicitud. / An error occurred. (${
            err instanceof Error ? err.message : "unknown"
          })`,
        };
      }
    }),
  );

  return Response.json({ results });
}
