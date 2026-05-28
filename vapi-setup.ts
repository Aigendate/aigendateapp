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
  // Optional spoken filler while the tool runs. Searches are fast, so they get
  // none (avoids the robotic "Dejame ver… Dejame ver…" stutter on chained
  // calls); writes get a short, distinct line so a brief pause feels natural.
  filler?: string,
) => ({
  type: "function" as const,
  function: { name, description, parameters: { type: "object", properties, required } },
  server,
  messages: [
    ...(filler ? [{ type: "request-start", content: filler }] : []),
    {
      type: "request-failed",
      content: "Disculpá, tuve un problemita con eso.",
    },
  ],
});

const tools = [
  fn(
    "buscar_hospitales",
    "Busca hospitales por nombre O por ciudad/zona (busca en nombre y dirección). Devuelve nombre, dirección e id.",
    {
      nombre: {
        type: "string",
        description: "Nombre del hospital o ciudad/zona, ej. 'Itauguá', 'Asunción', 'IPS'",
      },
    },
  ),
  fn(
    "buscar_doctores",
    "Busca doctores por especialidad y/o ciudad y/o nombre. Devuelve doctor_id y hospital_id con el hospital de cada uno. Esta es la forma preferida de empezar cuando el paciente menciona una especialidad.",
    {
      especialidad: { type: "string", description: "Especialidad, ej. cardiología (recomendado)" },
      ciudad: { type: "string", description: "Ciudad o zona para acotar, ej. Asunción (opcional)" },
      nombre: { type: "string", description: "Nombre del doctor (opcional)" },
      hospital_id: { type: "string", description: "id del hospital para filtrar (opcional)" },
    },
  ),
  fn(
    "buscar_paciente",
    "Busca un paciente ya registrado por nombre. Devuelve patient_id.",
    { nombre: { type: "string", description: "Nombre del paciente" } },
    ["nombre"],
  ),
  fn(
    "registrar_paciente",
    "Registra un nuevo paciente. Devuelve patient_id. Usar solo si buscar_paciente no lo encuentra.",
    {
      nombre: { type: "string", description: "Nombre completo del paciente" },
      telefono: { type: "string", description: "Teléfono (opcional)" },
      email: { type: "string", description: "Email (opcional)" },
    },
    ["nombre"],
    "Dale, te anoto…",
  ),
  fn(
    "agendar_turno",
    "Agenda un turno. Requiere hospital_id, patient_id, doctor_id, fecha (YYYY-MM-DD) y hora (HH:MM, 24h).",
    {
      hospital_id: { type: "string", description: "id del hospital (de buscar_doctores)" },
      patient_id: { type: "string", description: "patient_id" },
      doctor_id: { type: "string", description: "doctor_id" },
      fecha: { type: "string", description: "Fecha en formato YYYY-MM-DD" },
      hora: { type: "string", description: "Hora en formato HH:MM de 24 horas" },
    },
    ["hospital_id", "patient_id", "doctor_id", "fecha", "hora"],
    "Perfecto, lo agendo…",
  ),
  fn(
    "cancelar_turno",
    "Cancela un turno por su identificador.",
    { turno_id: { type: "string", description: "turno_id devuelto al agendar" } },
    ["turno_id"],
    "Ok, lo cancelo…",
  ),
];

const SYSTEM_PROMPT = `Sos Sofía, recepcionista de "Turnos PY", que agenda turnos médicos por teléfono en Paraguay. Hablás como una persona real, cálida y relajada — no como un sistema automático.

CÓMO HABLÁS:
- Español paraguayo natural, con voseo ("querés", "fijate", "dale", "mirá"). Hablás siempre en español.
- Frases cortas y variadas. No uses siempre la misma fórmula. Suena a charla, no a formulario.
- Usá pequeños reconocimientos antes de seguir: "Dale", "Perfecto", "Buenísimo", "Ahí va".
- NO narres lo que hacés por dentro. Nunca digas "voy a buscar", "déjame consultar el sistema" ni "procesando". Simplemente hacé la consulta y contá lo que encontraste.
- NUNCA leas identificadores (ids) en voz alta — son solo para uso interno.
- No confirmes cada dato por separado ni repitas todo como un checklist. Una confirmación natural al final alcanza.

CÓMO PRESENTÁS DOCTORES (esto es lo que tiene que sonar humano):
- Arrancá por la especialidad, no por el hospital — la gente piensa en "un cardiólogo", no en nombres de hospital.
- Llamá a buscar_doctores con la especialidad (y la ciudad si la mencionó). Cada resultado ya trae el hospital del doctor.
- Contá lo que encontraste como lo haría una recepcionista, no como una lista: "Mirá, tengo a la doctora María López, que atiende en el Hospital de Itauguá, y también al doctor Benítez en Coronel Oviedo. ¿Cuál te queda mejor?" Ofrecé 2 o 3, no más.
- Si no hay nadie en esa ciudad, ofrecé buscar en otro lado sin que suene a error: "En esa zona no tengo a nadie ahora, pero puedo fijarme en hospitales cercanos, ¿dale?".
- Usá buscar_hospitales solo si la persona insiste en un hospital puntual o pregunta por hospitales (acepta también ciudad/zona).

EL RESTO DEL TURNO:
- Pedí el nombre del paciente de forma natural. Buscalo con buscar_paciente; si no aparece, pedí el teléfono y registralo con registrar_paciente.
- Preguntá qué día y hora le viene bien; convertí lo que diga a fecha YYYY-MM-DD y hora HH:MM (24h) por dentro.
- Antes de agendar, repetí en una sola frase amable lo acordado (doctor, fecha y hora) y agendá con agendar_turno usando el doctor_id y hospital_id que vinieron juntos de buscar_doctores.
- Si el horario está ocupado u otro error, decilo con naturalidad y ofrecé otra opción.

CANCELAR: necesitás el identificador del turno; si no lo tienen, explicá con amabilidad que por ahora hace falta ese dato.

REGLAS: No inventes hospitales, doctores ni horarios — usá siempre las herramientas. La fecha y hora actuales están en el contexto del sistema.`;

const assistant = {
  name: "Turnos PY — Asistente de turnos",
  firstMessage:
    "¡Hola! Bienvenido a Turnos PY, te habla Sofía. ¿Con qué especialista necesitás agendar?",
  firstMessageMode: "assistant-speaks-first",
  model: {
    provider: "openai",
    model: "gpt-4.1",
    temperature: 0.75,
    messages: [{ role: "system", content: SYSTEM_PROMPT }],
    tools,
  },
  voice: { provider: "vapi", voiceId: "Gustavo" },
  transcriber: { provider: "deepgram", model: "nova-3", language: "es" },
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
