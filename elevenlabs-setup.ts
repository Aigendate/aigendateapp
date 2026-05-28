/**
 * Creates (or updates) the "Lucía" voice assistant on ElevenLabs Agents.
 *
 *   ELEVENLABS_API_KEY=...  npm run elevenlabs:setup
 *
 * It first upserts 9 webhook (server) tools that POST to the app's webhook
 * (app/api/elevenlabs/<tool>/route.ts), then creates/updates an agent that
 * references them by tool_ids. Set ELEVENLABS_WEBHOOK_SECRET to have ElevenLabs
 * send an `x-elevenlabs-secret` header the webhook verifies.
 *
 * Re-running with ELEVENLABS_AGENT_ID set PATCHes that agent (and reuses tools
 * by name) instead of creating new ones.
 *
 * Schema mirrors live ElevenLabs config verified against this account:
 *   POST /v1/convai/tools            { tool_config: { type:"webhook", ... } }
 *   POST /v1/convai/agents/create    { conversation_config: { agent, tts, asr } }
 */
export {};

const API_KEY = process.env.ELEVENLABS_API_KEY;
if (!API_KEY) throw new Error("ELEVENLABS_API_KEY is required");

const WEBHOOK_BASE = (
  process.env.ELEVENLABS_WEBHOOK_URL ?? "https://aigendate.vercel.app"
).replace(/\/$/, "");
const WEBHOOK_SECRET = process.env.ELEVENLABS_WEBHOOK_SECRET;
const EXISTING_ID = process.env.ELEVENLABS_AGENT_ID;
const VOICE_ID = process.env.ELEVENLABS_VOICE_ID ?? "imFXYz8XIletRKLZZQaA"; // Kate 2 — LatAm Spanish, female
const TTS_MODEL = process.env.ELEVENLABS_TTS_MODEL ?? "eleven_flash_v2_5";
const LLM = process.env.ELEVENLABS_LLM ?? "gemini-2.5-flash";

const API = "https://api.elevenlabs.io/v1/convai";
const headers = { "xi-api-key": API_KEY, "Content-Type": "application/json" };

type Param = { type: "string" | "integer"; description: string };

async function api(method: string, path: string, body?: unknown) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error(`ElevenLabs ${method} ${path} -> ${res.status}`);
    console.error(JSON.stringify(data, null, 2));
    process.exit(1);
  }
  return data;
}

// Build a webhook tool_config from a friendly param map.
function toolConfig(
  name: string,
  description: string,
  properties: Record<string, Param>,
  required: string[] = [],
) {
  return {
    type: "webhook",
    name,
    description,
    response_timeout_secs: 20,
    api_schema: {
      url: `${WEBHOOK_BASE}/api/elevenlabs/${name}`,
      method: "POST",
      request_headers: WEBHOOK_SECRET ? { "x-elevenlabs-secret": WEBHOOK_SECRET } : {},
      request_body_schema: {
        type: "object",
        required,
        description: `Parámetros para ${name}.`,
        properties: Object.fromEntries(
          Object.entries(properties).map(([id, p]) => [
            id,
            { type: p.type, description: p.description },
          ]),
        ),
      },
      content_type: "application/json",
    },
  };
}

const TOOLS = [
  toolConfig(
    "buscar_hospitales",
    "Busca hospitales por nombre O por ciudad/zona (busca en nombre y dirección). Devuelve nombre, dirección e id.",
    {
      nombre: {
        type: "string",
        description: "Nombre del hospital o ciudad/zona, ej. 'Itauguá', 'Asunción', 'IPS'",
      },
    },
  ),
  toolConfig(
    "buscar_doctores",
    "Busca doctores por especialidad y/o ciudad y/o nombre. Devuelve doctor_id y hospital_id con el hospital de cada uno. Es la forma preferida de empezar cuando el paciente menciona una especialidad.",
    {
      especialidad: { type: "string", description: "Especialidad, ej. cardiología (recomendado)" },
      ciudad: { type: "string", description: "Ciudad o zona para acotar, ej. Asunción (opcional)" },
      nombre: { type: "string", description: "Nombre del doctor (opcional)" },
      hospital_id: { type: "string", description: "id del hospital para filtrar (opcional)" },
    },
  ),
  toolConfig(
    "buscar_paciente",
    "Busca un paciente ya registrado por nombre. Devuelve patient_id.",
    { nombre: { type: "string", description: "Nombre del paciente" } },
    ["nombre"],
  ),
  toolConfig(
    "registrar_paciente",
    "Registra un nuevo paciente. Devuelve patient_id. Usar solo si buscar_paciente no lo encuentra.",
    {
      nombre: { type: "string", description: "Nombre completo del paciente" },
      telefono: { type: "string", description: "Teléfono (opcional)" },
      email: { type: "string", description: "Email (opcional)" },
    },
    ["nombre"],
  ),
  toolConfig(
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
  ),
  toolConfig(
    "cancelar_turno",
    "Cancela un turno por su identificador.",
    { turno_id: { type: "string", description: "turno_id devuelto al agendar" } },
    ["turno_id"],
  ),
  toolConfig(
    "consultar_disponibilidad",
    "Devuelve los horarios libres de un doctor en una fecha (sus horas de atención menos lo ya reservado). Usalo para OFRECER horarios en vez de pedirlos a ciegas.",
    {
      doctor_id: { type: "string", description: "doctor_id de buscar_doctores" },
      fecha: { type: "string", description: "Fecha en formato YYYY-MM-DD" },
    },
    ["doctor_id", "fecha"],
  ),
  toolConfig(
    "reagendar_turno",
    "Reprograma un turno existente a una nueva fecha y hora. Pasá turno_id si lo tenés; si no, pasá patient_id y se busca el turno del paciente (si tiene varios, te los devuelve para que preguntes cuál).",
    {
      nueva_fecha: { type: "string", description: "Nueva fecha YYYY-MM-DD" },
      nueva_hora: { type: "string", description: "Nueva hora HH:MM (24h)" },
      turno_id: { type: "string", description: "turno_id del turno a mover (opcional)" },
      patient_id: { type: "string", description: "patient_id, si no tenés turno_id (opcional)" },
    },
    ["nueva_fecha", "nueva_hora"],
  ),
  toolConfig(
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
  ),
];

const SYSTEM_PROMPT = `Sos Lucía, recepcionista de "Turnos", que agenda turnos médicos por teléfono en Paraguay. Sos cálida, tranquila y resolutiva: tratás a la persona con respeto (de "vos"), tenés paciencia con quien duda o no escucha bien, y vas al grano sin ser cortante. Hablás como una persona real, no como un sistema automático.

FECHA DE HOY: {{fecha_hoy}} ({{dia_hoy}}). Usá esta fecha para resolver expresiones como "mañana", "el martes que viene" o "la semana que viene", y pasá siempre las fechas a las herramientas en formato YYYY-MM-DD.

CÓMO HABLÁS:
- Español paraguayo natural, con voseo ("querés", "fijate", "dale", "mirá"). Hablás siempre en español.
- Frases cortas y variadas. No uses siempre la misma fórmula. Suena a charla, no a formulario.
- Usá pequeños reconocimientos antes de seguir: "Dale", "Perfecto", "Buenísimo", "Ahí va".
- NO narres lo que hacés por dentro. Nunca digas "voy a buscar", "déjame consultar el sistema" ni "procesando". Simplemente hacé la consulta y contá lo que encontraste.
- Si necesitás hacer varias consultas seguidas, hacelas todas sin hablar en el medio; recién hablá cuando tengas el resultado final. Lo normal es resolver con UNA sola llamada a buscar_doctores.
- NUNCA leas identificadores (ids) en voz alta — son solo para uso interno.
- No confirmes cada dato por separado ni repitas todo como un checklist. Una confirmación natural al final alcanza.
- Decí las horas de forma natural ("a las nueve", "diez y media"), nunca leas el formato crudo. Las fechas decilas como persona ("el martes 2", "el 5 de junio").
- Tratá a las doctoras como "doctora" y a los doctores como "doctor" según el nombre, aunque en los datos figure siempre "Dr.".

CADA HERRAMIENTA TE DEVUELVE UN JSON CON "message" Y "card": basá tu respuesta hablada en el texto de "message". El "card" es solo para la pantalla, no lo leas.

CÓMO PRESENTÁS DOCTORES:
- Arrancá por la especialidad, no por el hospital — la gente piensa en "un cardiólogo", no en nombres de hospital.
- Llamá a buscar_doctores con la especialidad (y la ciudad si la mencionó). Cada resultado ya trae el hospital del doctor.
- Contá lo que encontraste como lo haría una recepcionista, no como una lista: "Mirá, tengo a la doctora María López, que atiende en el Hospital de Itauguá, y también al doctor Benítez en Coronel Oviedo. ¿Cuál te queda mejor?" Ofrecé 2 o 3, no más.
- Si no hay nadie en esa ciudad, ofrecé buscar en otro lado sin que suene a error.
- Usá buscar_hospitales solo si la persona insiste en un hospital puntual o pregunta por hospitales.

OFRECÉ HORARIOS, NO LOS PIDAS A CIEGAS:
- Una vez que eligió doctor, preguntá qué día le viene bien y llamá a consultar_disponibilidad con el doctor_id y esa fecha.
- Ofrecé 2 o 3 horarios reales de los que devuelve: "El martes tiene libre a las 9, a las 10:30 o a las 11. ¿Cuál te sirve?". No inventes horarios.
- Si ese día no hay nada, decilo y ofrecé otro día. Si en varios días no hay lugar, ofrecé la lista de espera (anotar_lista_espera).

PACIENTE Y CONFIRMACIÓN:
- Pedí el nombre del paciente de forma natural. Buscalo con buscar_paciente; si no aparece, pedí el teléfono y registralo con registrar_paciente.
- Antes de agendar, repetí en una sola frase amable lo acordado (doctor, fecha y hora) y agendá con agendar_turno usando el doctor_id y hospital_id que vinieron juntos de buscar_doctores.
- Si el horario está ocupado u otro error, decilo con naturalidad y ofrecé otra opción.

REPROGRAMAR: usá reagendar_turno. Si acabás de agendar en esta llamada, ya tenés el turno_id. Si no, pasá el patient_id y, si tiene varios turnos, preguntá cuál quiere mover.

CANCELAR: necesitás el identificador del turno; si no lo tienen, explicá con amabilidad que por ahora hace falta ese dato.

CIERRE: Cuando el trámite quede resuelto, preguntá si necesita algo más. Si no necesita nada, despedite con calidez: "¡Listo! Que tengas un buen día."

REGLAS: No inventes hospitales, doctores ni horarios — usá siempre las herramientas.`;

const FIRST_MESSAGE =
  "¡Hola! Bienvenido a Turnos, te habla Lucía. ¿Con qué especialista necesitás agendar?";

async function main() {
  // 1. Upsert tools, reusing existing ones by name to avoid duplicates on re-run.
  const existing = (await api("GET", "/tools")) as {
    tools?: { id: string; tool_config?: { name?: string } }[];
  };
  const byName = new Map<string, string>();
  for (const t of existing.tools ?? []) {
    if (t.tool_config?.name) byName.set(t.tool_config.name, t.id);
  }

  const toolIds: string[] = [];
  for (const tool_config of TOOLS) {
    const id = byName.get(tool_config.name);
    if (id) {
      await api("PATCH", `/tools/${id}`, { tool_config });
      toolIds.push(id);
      console.log(`  tool updated: ${tool_config.name} (${id})`);
    } else {
      const created = (await api("POST", "/tools", { tool_config })) as { id: string };
      toolIds.push(created.id);
      console.log(`  tool created: ${tool_config.name} (${created.id})`);
    }
  }

  // 2. Create/update the agent referencing those tools.
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Asuncion" }); // YYYY-MM-DD
  const weekday = new Date().toLocaleDateString("es-PY", {
    timeZone: "America/Asuncion",
    weekday: "long",
  });

  const conversation_config = {
    agent: {
      first_message: FIRST_MESSAGE,
      language: "es",
      dynamic_variables: {
        dynamic_variable_placeholders: { fecha_hoy: today, dia_hoy: weekday },
      },
      prompt: {
        prompt: SYSTEM_PROMPT,
        llm: LLM,
        temperature: 0.75,
        tool_ids: toolIds,
      },
    },
    tts: { model_id: TTS_MODEL, voice_id: VOICE_ID },
    asr: { quality: "high" },
  };

  const agent = EXISTING_ID
    ? await api("PATCH", `/agents/${EXISTING_ID}`, { conversation_config })
    : await api("POST", "/agents/create", {
        name: "Turnos — Lucía (ElevenLabs)",
        conversation_config,
      });

  const id = (agent as { agent_id?: string }).agent_id ?? EXISTING_ID;
  console.log(`\n${EXISTING_ID ? "Updated" : "Created"} agent: ${id}`);
  console.log(`  webhook: ${WEBHOOK_BASE}/api/elevenlabs/<tool>${WEBHOOK_SECRET ? " (secured)" : " (no secret)"}`);
  console.log(`  voice:   ${VOICE_ID}  model: ${TTS_MODEL}  llm: ${LLM}`);
  console.log(`  tools:   ${TOOLS.map((t) => t.name).join(", ")}`);
  console.log(`\nSet these in .env:`);
  console.log(`  ELEVENLABS_AGENT_ID=${id}`);
  console.log(`  NEXT_PUBLIC_ELEVENLABS_AGENT_ID=${id}`);
}

await main();
