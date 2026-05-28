/**
 * Creates (or updates) the bilingual Turnos voice assistant on Vapi.
 *
 *   VAPI_API_KEY=...  node --env-file=.env --import tsx vapi-setup.ts
 *
 * The assistant's tools are inline function tools that POST to the app's
 * webhook (app/api/vapi/route.ts). Set VAPI_SERVER_SECRET to have Vapi sign
 * tool calls with an `x-vapi-secret` header that the webhook verifies.
 *
 * Re-running with VAPI_ASSISTANT_ID set PATCHes that assistant instead of
 * creating a new one.
 */
export {};

const API_KEY = process.env.VAPI_API_KEY;
if (!API_KEY) throw new Error("VAPI_API_KEY is required");

const SERVER_URL =
  process.env.VAPI_WEBHOOK_URL ?? "https://aigendate.vercel.app/api/vapi";
const SERVER_SECRET = process.env.VAPI_SERVER_SECRET;
const EXISTING_ID = process.env.VAPI_ASSISTANT_ID;

const server = SERVER_SECRET
  ? { url: SERVER_URL, secret: SERVER_SECRET }
  : { url: SERVER_URL };

const fn = (
  name: string,
  description: string,
  properties: Record<string, { type: string; description: string }>,
  required: string[] = [],
) => ({
  type: "function" as const,
  function: { name, description, parameters: { type: "object", properties, required } },
  server,
  messages: [
    { type: "request-start", content: "Un momento, por favor… / One moment…" },
    {
      type: "request-failed",
      content:
        "Disculpá, tuve un problema con esa consulta. / Sorry, I had trouble with that.",
    },
  ],
});

const tools = [
  fn(
    "buscar_hospitales",
    "Busca hospitales por nombre. Devuelve nombre, dirección e id de cada hospital. / Search hospitals by name.",
    { nombre: { type: "string", description: "Nombre o parte del nombre del hospital" } },
  ),
  fn(
    "buscar_doctores",
    "Busca doctores por nombre, especialidad y/o hospital_id. Devuelve doctor_id y hospital_id. / Search doctors.",
    {
      nombre: { type: "string", description: "Nombre del doctor (opcional)" },
      especialidad: { type: "string", description: "Especialidad, ej. cardiología (opcional)" },
      hospital_id: { type: "string", description: "id del hospital para filtrar (opcional)" },
    },
  ),
  fn(
    "buscar_paciente",
    "Busca un paciente ya registrado por nombre. Devuelve patient_id. / Find an existing patient by name.",
    { nombre: { type: "string", description: "Nombre del paciente" } },
    ["nombre"],
  ),
  fn(
    "registrar_paciente",
    "Registra un nuevo paciente. Devuelve patient_id. Usar solo si buscar_paciente no lo encuentra. / Register a new patient.",
    {
      nombre: { type: "string", description: "Nombre completo del paciente" },
      telefono: { type: "string", description: "Teléfono (opcional)" },
      email: { type: "string", description: "Email (opcional)" },
    },
    ["nombre"],
  ),
  fn(
    "agendar_turno",
    "Agenda un turno. Requiere hospital_id, patient_id, doctor_id, fecha (YYYY-MM-DD) y hora (HH:MM, 24h). / Book an appointment.",
    {
      hospital_id: { type: "string", description: "id del hospital (de buscar_doctores)" },
      patient_id: { type: "string", description: "patient_id" },
      doctor_id: { type: "string", description: "doctor_id" },
      fecha: { type: "string", description: "Fecha en formato YYYY-MM-DD" },
      hora: { type: "string", description: "Hora en formato HH:MM de 24 horas" },
    },
    ["hospital_id", "patient_id", "doctor_id", "fecha", "hora"],
  ),
  fn(
    "cancelar_turno",
    "Cancela un turno por su identificador. / Cancel an appointment by id.",
    { turno_id: { type: "string", description: "turno_id devuelto al agendar" } },
    ["turno_id"],
  ),
];

const SYSTEM_PROMPT = `Sos el asistente telefónico de "Turnos PY", un sistema de turnos para hospitales en Paraguay.

IDIOMA: Empezá en español. Si la persona te habla en inglés, seguí en inglés. Respondé siempre en el idioma de la última intervención del usuario.

ESTILO: Sé breve, cálido y natural — respuestas cortas, como en una llamada. No leas identificadores (ids) en voz alta; usalos solo internamente para llamar a las herramientas.

FLUJO PARA AGENDAR UN TURNO:
1. Preguntá qué especialidad o doctor necesita y en qué hospital o ciudad.
2. Usá buscar_hospitales y/o buscar_doctores para encontrar opciones. Si hay varias, ofrecé las más relevantes y dejá que elija.
3. Pedí el nombre del paciente. Usá buscar_paciente; si no existe, pedí también teléfono y registralo con registrar_paciente.
4. Pedí fecha y hora preferidas. Convertí lo que diga la persona a fecha YYYY-MM-DD y hora HH:MM de 24 horas.
5. CONFIRMÁ en voz alta el doctor, hospital, fecha y hora antes de agendar.
6. Llamá a agendar_turno con los ids correctos (el hospital_id debe ser el del doctor elegido).
7. Confirmá el resultado. Si la herramienta devuelve un error (horario ocupado, etc.), explicalo y ofrecé otra opción.

CANCELAR: Para cancelar necesitás el identificador del turno; si no lo tienen, explicá que por ahora hace falta ese dato.

REGLAS: No inventes hospitales, doctores ni horarios — usá siempre las herramientas. Si algo no se puede hacer, decilo con claridad. La fecha y hora actuales están disponibles como contexto del sistema.`;

const assistant = {
  name: "Turnos PY — Asistente de turnos",
  firstMessage:
    "¡Hola! Soy el asistente de Turnos PY. Puedo ayudarte a agendar un turno médico. ¿En qué te puedo ayudar? / Hi! I can help you book a medical appointment.",
  firstMessageMode: "assistant-speaks-first",
  model: {
    provider: "openai",
    model: "gpt-4.1",
    temperature: 0.4,
    messages: [{ role: "system", content: SYSTEM_PROMPT }],
    tools,
  },
  voice: { provider: "vapi", voiceId: "Gustavo" },
  transcriber: { provider: "deepgram", model: "nova-3", language: "multi" },
};

const url = EXISTING_ID
  ? `https://api.vapi.ai/assistant/${EXISTING_ID}`
  : "https://api.vapi.ai/assistant";

const res = await fetch(url, {
  method: EXISTING_ID ? "PATCH" : "POST",
  headers: {
    Authorization: `Bearer ${API_KEY}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify(assistant),
});

const data = await res.json();
if (!res.ok) {
  console.error("Vapi error:", res.status, JSON.stringify(data, null, 2));
  process.exit(1);
}

console.log(`${EXISTING_ID ? "Updated" : "Created"} assistant: ${data.id}`);
console.log(`  name:    ${data.name}`);
console.log(`  webhook: ${SERVER_URL}${SERVER_SECRET ? " (secured)" : " (no secret)"}`);
console.log(`  tools:   ${tools.map((t) => t.function.name).join(", ")}`);
console.log("\nTest it in the Vapi dashboard (assistant > Talk to assistant).");
