import { eq } from "drizzle-orm";
import { db } from "../../../server/client";
import { doctors, hospitals, patients } from "../../../server/schema";
import { listDoctors, listHospitals, getAvailableSlots } from "../../../server/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Read-only mirror of the voice tool calls, for the browser UI.
//
// The Vapi web client receives tool-call *names + arguments* but NOT the tool
// *results* (those go server->Vapi). So the /asistente page forwards each
// tool-call it observes to this endpoint, which re-derives the underlying data
// and returns structured JSON to render as cards. No secret: this exposes only
// the same data already shown on the public pages, and never mutates anything.

const str = (v: unknown): string | undefined =>
  typeof v === "string" && v.trim() ? v.trim() : undefined;

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

// Returns { kind, ... } describing what to render, or null if this tool has no card.
async function preview(
  name: string,
  args: Record<string, unknown>
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

export async function POST(request: Request): Promise<Response> {
  let body: { name?: string; arguments?: Record<string, unknown> };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name : "";
  const args = (body.arguments && typeof body.arguments === "object" ? body.arguments : {}) as Record<
    string,
    unknown
  >;

  try {
    const card = await preview(name, args);
    return Response.json({ card });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "unknown" },
      { status: 500 }
    );
  }
}
