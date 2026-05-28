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
    { type: "request-start", content: "Dejame ver…" },
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
    "Busca hospitales por nombre O por ciudad/zona (busca en nombre y dirección). Devuelve nombre, dirección e id. / Search hospitals by name or city.",
    {
      nombre: {
        type: "string",
        description: "Nombre del hospital o ciudad/zona, ej. 'Itauguá', 'Asunción', 'IPS'",
      },
    },
  ),
  fn(
    "buscar_doctores",
    "Busca doctores por especialidad y/o ciudad y/o nombre. Devuelve doctor_id y hospital_id con el hospital de cada uno. Esta es la forma preferida de empezar cuando el paciente menciona una especialidad. / Search doctors by specialty/city.",
    {
      especialidad: { type: "string", description: "Especialidad, ej. cardiología (recomendado)" },
      ciudad: { type: "string", description: "Ciudad o zona para acotar, ej. Asunción (opcional)" },
      nombre: { type: "string", description: "Nombre del doctor (opcional)" },
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

IDIOMA: Empezá en español. Si la persona te habla en inglés, seguí en inglés. Respondé en el idioma de la última intervención del usuario. No repitas la misma frase en los dos idiomas.

ESTILO: Breve, cálido y natural, como en una llamada. Una pregunta a la vez. NUNCA leas identificadores (ids) en voz alta — son solo para uso interno con las herramientas.

EMPEZÁ POR LA ESPECIALIDAD, NO POR EL HOSPITAL. La gente piensa en "un cardiólogo", no en nombres de hospitales.

FLUJO PARA AGENDAR:
1. Averiguá qué especialidad necesita (ej. cardiología) y, si la menciona, en qué ciudad o zona.
2. Llamá a buscar_doctores con esa especialidad (y ciudad si la dijo). Cada resultado YA incluye el hospital del doctor. NO pidas el nombre del hospital primero.
   - Si hay varios, ofrecé 2 o 3 opciones nombrando doctor y hospital, y dejá que elija.
   - Si no hay resultados en esa ciudad, ofrecé buscar la misma especialidad sin filtrar por ciudad.
   - Usá buscar_hospitales SOLO si la persona insiste en un hospital específico o pregunta por hospitales. Acepta también ciudades/zonas (busca en nombre y dirección).
3. Pedí el nombre del paciente. Buscalo con buscar_paciente; si no aparece, pedí el teléfono y registralo con registrar_paciente.
4. Pedí fecha y hora. Convertí lo que diga a fecha YYYY-MM-DD y hora HH:MM de 24h.
5. CONFIRMÁ en voz alta doctor, hospital, fecha y hora antes de agendar.
6. Llamá a agendar_turno usando el doctor_id y el hospital_id que vinieron juntos en buscar_doctores (el hospital_id debe ser el de ese doctor).
7. Confirmá el resultado. Si la herramienta devuelve un error (ej. horario ocupado), explicalo y ofrecé otra fecha/hora.

CANCELAR: necesitás el identificador del turno; si no lo tienen, explicá que por ahora hace falta ese dato.

REGLAS: No inventes hospitales, doctores ni horarios — usá siempre las herramientas. Si algo no se puede, decilo con claridad. La fecha y hora actuales están en el contexto del sistema.`;

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
