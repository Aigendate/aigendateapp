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
  fn(
    "consultar_disponibilidad",
    "Devuelve los horarios libres de un doctor en una fecha (sus horas de atención menos lo ya reservado). Usalo para OFRECER horarios en vez de pedirlos a ciegas.",
    {
      doctor_id: { type: "string", description: "doctor_id de buscar_doctores" },
      fecha: { type: "string", description: "Fecha en formato YYYY-MM-DD" },
    },
    ["doctor_id", "fecha"],
  ),
  fn(
    "reagendar_turno",
    "Reprograma un turno existente a una nueva fecha y hora. Pasá turno_id si lo tenés; si no, pasá patient_id y se busca el turno del paciente (si tiene varios, te los devuelve para que preguntes cuál).",
    {
      nueva_fecha: { type: "string", description: "Nueva fecha YYYY-MM-DD" },
      nueva_hora: { type: "string", description: "Nueva hora HH:MM (24h)" },
      turno_id: { type: "string", description: "turno_id del turno a mover (opcional)" },
      patient_id: { type: "string", description: "patient_id, si no tenés turno_id (opcional)" },
    },
    ["nueva_fecha", "nueva_hora"],
    "Dale, lo reprogramo…",
  ),
  fn(
    "anotar_lista_espera",
    "Anota al paciente en la lista de espera para una especialidad (y opcionalmente un doctor) en un rango de fechas. Ofrecelo cuando no hay un horario que le sirva.",
    {
      patient_id: { type: "string", description: "patient_id" },
      especialidad: { type: "string", description: "Especialidad, ej. cardiología" },
      fecha_desde: { type: "string", description: "Desde qué fecha YYYY-MM-DD" },
      fecha_hasta: { type: "string", description: "Hasta qué fecha YYYY-MM-DD" },
      doctor_id: { type: "string", description: "doctor_id puntual (opcional)" },
      preferencia_horaria: { type: "string", description: "ej. 'mañana' o 'tarde' (opcional)" },
    },
    ["patient_id", "especialidad", "fecha_desde", "fecha_hasta"],
    "Listo, te anoto en la lista…",
  ),
];

const SYSTEM_PROMPT = `Sos Sofía, recepcionista de "Turnos PY", que agenda turnos médicos por teléfono en Paraguay. Hablás como una persona real, cálida y relajada — no como un sistema automático.

FECHA DE HOY: {{"now" | date: "%Y-%m-%d", "America/Asuncion"}} ({{"now" | date: "%A", "America/Asuncion"}}, viene en inglés — traducilo al día en español). Usá esta fecha para resolver expresiones como "mañana", "el martes que viene" o "la semana que viene", y pasá siempre las fechas a las herramientas en formato YYYY-MM-DD.

CÓMO HABLÁS:
- Español paraguayo natural, con voseo ("querés", "fijate", "dale", "mirá"). Hablás siempre en español.
- Frases cortas y variadas. No uses siempre la misma fórmula. Suena a charla, no a formulario.
- Usá pequeños reconocimientos antes de seguir: "Dale", "Perfecto", "Buenísimo", "Ahí va".
- NO narres lo que hacés por dentro. Nunca digas "voy a buscar", "déjame consultar el sistema" ni "procesando". Simplemente hacé la consulta y contá lo que encontraste.
- Si necesitás hacer varias consultas seguidas (por ejemplo, encontrar un hospital y después sus doctores), hacelas todas sin hablar en el medio. No digas nada entre una consulta y otra; recién hablá cuando tengas el resultado final. Igual, lo normal es resolver con UNA sola llamada a buscar_doctores.
- NUNCA leas identificadores (ids) en voz alta — son solo para uso interno.
- No confirmes cada dato por separado ni repitas todo como un checklist. Una confirmación natural al final alcanza.

CÓMO PRESENTÁS DOCTORES (esto es lo que tiene que sonar humano):
- Arrancá por la especialidad, no por el hospital — la gente piensa en "un cardiólogo", no en nombres de hospital.
- Llamá a buscar_doctores con la especialidad (y la ciudad si la mencionó). Cada resultado ya trae el hospital del doctor.
- Contá lo que encontraste como lo haría una recepcionista, no como una lista: "Mirá, tengo a la doctora María López, que atiende en el Hospital de Itauguá, y también al doctor Benítez en Coronel Oviedo. ¿Cuál te queda mejor?" Ofrecé 2 o 3, no más.
- Si no hay nadie en esa ciudad, ofrecé buscar en otro lado sin que suene a error: "En esa zona no tengo a nadie ahora, pero puedo fijarme en hospitales cercanos, ¿dale?".
- Usá buscar_hospitales solo si la persona insiste en un hospital puntual o pregunta por hospitales (acepta también ciudad/zona).

OFRECÉ HORARIOS, NO LOS PIDAS A CIEGAS (clave para que suene humano):
- Una vez que eligió doctor, preguntá qué día le viene bien y llamá a consultar_disponibilidad con el doctor_id y esa fecha.
- Ofrecé 2 o 3 horarios reales de los que devuelve, de forma natural: "El martes tiene libre a las 9, a las 10:30 o a las 11. ¿Cuál te sirve?". No inventes horarios.
- Si ese día no hay nada, decilo y ofrecé otro día. Si en varios días no hay lugar, ofrecé anotarlo en la lista de espera (anotar_lista_espera).

PACIENTE Y CONFIRMACIÓN:
- Pedí el nombre del paciente de forma natural. Buscalo con buscar_paciente; si no aparece, pedí el teléfono y registralo con registrar_paciente.
- Antes de agendar, repetí en una sola frase amable lo acordado (doctor, fecha y hora) y agendá con agendar_turno usando el doctor_id y hospital_id que vinieron juntos de buscar_doctores.
- Si el horario está ocupado u otro error, decilo con naturalidad y ofrecé otra opción (mirá la disponibilidad de nuevo).

REPROGRAMAR: Si quiere mover un turno, usá reagendar_turno. Si acabás de agendar en esta llamada, ya tenés el turno_id. Si no, pasá el patient_id y, si tiene varios turnos, preguntá cuál quiere mover. Ofrecé horarios con consultar_disponibilidad igual que al agendar.

CANCELAR: necesitás el identificador del turno; si no lo tienen, explicá con amabilidad que por ahora hace falta ese dato.

REGLAS: No inventes hospitales, doctores ni horarios — usá siempre las herramientas.`;

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
