"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ConversationProvider, useConversation } from "@elevenlabs/react";
import { cn } from "~/lib/utils";

// ElevenLabs Agents counterpart of components/voice-agent.tsx (Vapi).
//
// Differences from Vapi that shape this file:
// - The SDK exposes server-tool activity via onAgentToolRequest / onAgentToolResponse
//   but NOT the tool arguments. So the webhook returns { message, card } and we
//   read the card out of onAgentToolResponse.full_tool_result (keyed by tool_call_id).
// - useConversation() must live inside <ConversationProvider>, so ElevenAgent
//   wraps an inner component.
// The presentational pieces (Orb/StatusPill/TranscriptBubble/CardRenderer) are
// duplicated here on purpose to keep the working Vapi component untouched.

// ---- Types -----------------------------------------------------------------

type CallStatus = "idle" | "connecting" | "active" | "ended";

type TranscriptLine = { id: string; role: "user" | "assistant"; text: string };

type DoctorCard = {
  kind: "doctores";
  query: { especialidad: string | null; ciudad: string | null; nombre: string | null };
  doctores: { id: string; name: string; specialty: string; hospital_name: string }[];
};
type HospitalCard = {
  kind: "hospitales";
  query: { nombre: string | null };
  hospitales: { id: string; name: string; address: string }[];
};
type DisponibilidadCard = {
  kind: "disponibilidad";
  fecha: string;
  doctor: { id: string; name: string; specialty: string; hospital_name: string } | null;
  slots: string[];
};
type TurnoCard = {
  kind: "turno";
  accion: "agendado" | "reprogramado";
  fecha: string | null;
  hora: string | null;
  doctor: { name: string; specialty: string; hospital_name: string } | null;
  patient: { name: string } | null;
};
type ListaEsperaCard = {
  kind: "lista_espera";
  especialidad: string | null;
  fecha_desde: string | null;
  fecha_hasta: string | null;
  preferencia: string | null;
  patient: { name: string } | null;
};
type PacienteCard = {
  kind: "paciente";
  registrado: boolean;
  nombre: string | null;
  telefono: string | null;
};

type CardData =
  | DoctorCard
  | HospitalCard
  | DisponibilidadCard
  | TurnoCard
  | ListaEsperaCard
  | PacienteCard;

type FeedCard = { id: string } & CardData;

// ---- Config ----------------------------------------------------------------

const PUBLIC_AGENT_ID = process.env.NEXT_PUBLIC_ELEVENLABS_AGENT_ID;

// Today's date in Paraguay, passed as dynamic variables the prompt references
// ({{fecha_hoy}} / {{dia_hoy}}) so "mañana", "el martes que viene", etc. resolve.
function todayVars(): Record<string, string> {
  const now = new Date();
  const fecha_hoy = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Asuncion" }).format(now);
  const dia_hoy = new Intl.DateTimeFormat("es-PY", {
    timeZone: "America/Asuncion",
    weekday: "long",
  }).format(now);
  return { fecha_hoy, dia_hoy };
}

// ---- Inner component (inside ConversationProvider) -------------------------

function ElevenAgentInner() {
  const [status, setStatus] = useState<CallStatus>("idle");
  const [muted, setMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lines, setLines] = useState<TranscriptLine[]>([]);
  const [cards, setCards] = useState<FeedCard[]>([]);

  // Pull a card object out of a tool's JSON result and upsert it (keyed by the
  // tool_call_id) at the top of the feed.
  const ingestToolResult = useCallback((toolCallId: string, fullResult: string) => {
    try {
      const parsed = JSON.parse(fullResult) as { card?: CardData | null };
      const card = parsed?.card;
      if (!card) return;
      setCards((prev) => [{ id: toolCallId, ...card }, ...prev.filter((c) => c.id !== toolCallId)]);
    } catch {
      // result wasn't our JSON envelope; voice is the source of truth
    }
  }, []);

  const conversation = useConversation({
    onConnect: () => setStatus("active"),
    onDisconnect: () => setStatus("ended"),
    onError: (message: string) => {
      setError(message || "Error en la llamada.");
      setStatus("ended");
    },
    onMessage: ({ message, role, source }) => {
      const text = (message ?? "").trim();
      if (!text) return;
      const who = (role ?? source) === "user" ? "user" : "assistant";
      setLines((prev) => [...prev, { id: `${prev.length}-${who}`, role: who, text }]);
    },
    onAgentToolResponse: (props) => {
      if ("full_tool_result" in props && props.full_tool_result) {
        ingestToolResult(props.tool_call_id, props.full_tool_result);
      }
    },
  });

  const isSpeaking = conversation.isSpeaking;

  const transcriptEndRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [lines]);

  const start = useCallback(async () => {
    setError(null);
    setStatus("connecting");
    setLines([]);
    try {
      const dynamicVariables = todayVars();

      // Prefer a server-minted signed URL (keeps the API key server-side, works
      // for private agents). Fall back to a public agentId if configured.
      let started = false;
      try {
        const res = await fetch("/api/elevenlabs-token");
        if (res.ok) {
          const { signedUrl } = (await res.json()) as { signedUrl?: string };
          if (signedUrl) {
            await conversation.startSession({ signedUrl, dynamicVariables });
            started = true;
          }
        }
      } catch {
        // fall through to public agentId
      }

      if (!started) {
        if (!PUBLIC_AGENT_ID) {
          throw new Error(
            "Falta configurar el agente de ElevenLabs (ELEVENLABS_AGENT_ID en el servidor o NEXT_PUBLIC_ELEVENLABS_AGENT_ID).",
          );
        }
        await conversation.startSession({ agentId: PUBLIC_AGENT_ID, dynamicVariables });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo iniciar la llamada.");
      setStatus("idle");
    }
  }, [conversation]);

  const stop = useCallback(() => {
    void conversation.endSession();
  }, [conversation]);

  const toggleMute = useCallback(() => {
    setMuted((m) => {
      const next = !m;
      conversation.setMuted(next);
      return next;
    });
  }, [conversation]);

  // Tear down the call if the component unmounts mid-conversation.
  useEffect(() => () => void conversation.endSession(), [conversation]);

  const isLive = status === "active" || status === "connecting";

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,360px)_1fr]">
      {/* Call control panel */}
      <div className="flex flex-col gap-5">
        <div className="border border-border bg-card p-6">
          <div className="mb-1 text-[0.6rem] uppercase tracking-[0.2em] text-muted-foreground">
            Asistente de voz · ElevenLabs
          </div>
          <h2 className="font-serif text-3xl leading-tight">Hablá con Lucía</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            La versión sobre ElevenLabs Agents. Pedile un especialista, consultá horarios y agendá tu
            turno hablando. Lo que vaya encontrando aparece acá al lado.
          </p>

          <div className="mt-6 flex items-center gap-4">
            <Orb status={status} speaking={isSpeaking} />
            <div className="flex-1">
              <StatusPill status={status} speaking={isSpeaking} />
              {isLive ? (
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={stop}
                    className="bg-destructive px-4 py-2 font-mono text-[0.7rem] uppercase tracking-wider text-destructive-foreground transition-colors hover:bg-destructive/90"
                  >
                    Cortar
                  </button>
                  <button
                    onClick={toggleMute}
                    className={cn(
                      "border border-border px-4 py-2 font-mono text-[0.7rem] uppercase tracking-wider transition-colors",
                      muted ? "bg-foreground text-background" : "bg-transparent hover:bg-muted",
                    )}
                  >
                    {muted ? "Silenciado" : "Silenciar"}
                  </button>
                </div>
              ) : (
                <button
                  onClick={start}
                  className="mt-3 bg-primary px-5 py-2 font-mono text-[0.7rem] uppercase tracking-wider text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
                >
                  {status === "ended" ? "Llamar de nuevo" : "Llamar"}
                </button>
              )}
            </div>
          </div>

          {error && (
            <div className="mt-4 border border-destructive bg-destructive-light px-3 py-2 text-xs text-destructive">
              {error}
            </div>
          )}
        </div>

        {/* Transcript */}
        <div className="flex min-h-[220px] flex-col border border-border bg-card p-4">
          <div className="mb-2 text-[0.6rem] uppercase tracking-[0.2em] text-muted-foreground">
            Conversación
          </div>
          <div className="flex-1 space-y-2 overflow-y-auto pr-1">
            {lines.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {isLive ? "Escuchando…" : "Cuando inicies la llamada, la transcripción aparece acá."}
              </p>
            ) : (
              lines.map((l) => <TranscriptBubble key={l.id} line={l} />)
            )}
            <div ref={transcriptEndRef} />
          </div>
        </div>
      </div>

      {/* Card feed */}
      <div className="min-h-[400px] border border-border bg-card/50 p-4">
        <div className="mb-3 text-[0.6rem] uppercase tracking-[0.2em] text-muted-foreground">
          En vivo
        </div>
        {cards.length === 0 ? (
          <div className="flex h-[340px] items-center justify-center text-center text-sm text-muted-foreground">
            <p className="max-w-xs">
              Los doctores, horarios y turnos que mencione Lucía van apareciendo acá como tarjetas.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {cards.map((card) => (
              <div key={card.id} className="animate-slide-up">
                <CardRenderer card={card} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function ElevenAgent() {
  return (
    <ConversationProvider>
      <ElevenAgentInner />
    </ConversationProvider>
  );
}

// ---- Subcomponents ---------------------------------------------------------

function Orb({ status, speaking }: { status: CallStatus; speaking: boolean }) {
  const active = status === "active";
  return (
    <div className="relative flex h-16 w-16 shrink-0 items-center justify-center">
      <div
        className={cn(
          "absolute h-12 w-12 rounded-full transition-transform duration-150",
          speaking ? "scale-125 bg-accent/30" : "scale-100 bg-primary/20",
        )}
      />
      <div
        className={cn(
          "h-9 w-9 rounded-full",
          status === "connecting" && "animate-pulse bg-muted-foreground",
          status === "idle" && "bg-muted-foreground/40",
          status === "ended" && "bg-muted-foreground/40",
          active && (speaking ? "bg-accent" : "bg-primary"),
        )}
      />
    </div>
  );
}

function StatusPill({ status, speaking }: { status: CallStatus; speaking: boolean }) {
  const label =
    status === "idle"
      ? "Listo para llamar"
      : status === "connecting"
        ? "Conectando…"
        : status === "ended"
          ? "Llamada finalizada"
          : speaking
            ? "Lucía está hablando"
            : "Te escucho";
  return (
    <span className="font-mono text-[0.7rem] uppercase tracking-wider text-foreground">{label}</span>
  );
}

function TranscriptBubble({ line }: { line: TranscriptLine }) {
  const isLucia = line.role === "assistant";
  return (
    <div className={cn("flex", isLucia ? "justify-start" : "justify-end")}>
      <div
        className={cn(
          "max-w-[85%] px-3 py-1.5 text-sm",
          isLucia ? "bg-primary-light text-foreground" : "bg-muted text-foreground",
        )}
      >
        <span className="mr-1.5 text-[0.6rem] uppercase tracking-wider text-muted-foreground">
          {isLucia ? "Lucía" : "Vos"}
        </span>
        {line.text}
      </div>
    </div>
  );
}

function CardShell({ tag, children }: { tag: string; children: React.ReactNode }) {
  return (
    <div className="border border-border bg-card">
      <div className="border-b border-border bg-muted/50 px-3 py-1.5 text-[0.6rem] uppercase tracking-[0.2em] text-muted-foreground">
        {tag}
      </div>
      <div className="p-3">{children}</div>
    </div>
  );
}

function CardRenderer({ card }: { card: FeedCard }) {
  switch (card.kind) {
    case "doctores":
      return (
        <CardShell
          tag={`Doctores${card.query.especialidad ? ` · ${card.query.especialidad}` : ""}${
            card.query.ciudad ? ` · ${card.query.ciudad}` : ""
          }`}
        >
          {card.doctores.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin resultados.</p>
          ) : (
            <ul className="divide-y divide-border">
              {card.doctores.map((d) => (
                <li
                  key={d.id}
                  className="flex items-baseline justify-between gap-3 py-2 first:pt-0 last:pb-0"
                >
                  <div>
                    <div className="text-sm font-medium">{d.name}</div>
                    <div className="text-xs text-muted-foreground">{d.hospital_name}</div>
                  </div>
                  <span className="shrink-0 bg-accent-light px-2 py-0.5 text-[0.65rem] uppercase tracking-wider text-accent">
                    {d.specialty}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardShell>
      );

    case "hospitales":
      return (
        <CardShell tag="Hospitales">
          <ul className="divide-y divide-border">
            {card.hospitales.map((h) => (
              <li key={h.id} className="py-2 first:pt-0 last:pb-0">
                <div className="text-sm font-medium">{h.name}</div>
                <div className="text-xs text-muted-foreground">{h.address}</div>
              </li>
            ))}
          </ul>
        </CardShell>
      );

    case "disponibilidad":
      return (
        <CardShell tag={`Disponibilidad · ${card.fecha}`}>
          {card.doctor && (
            <div className="mb-2 text-sm">
              <span className="font-medium">{card.doctor.name}</span>{" "}
              <span className="text-muted-foreground">— {card.doctor.specialty}</span>
            </div>
          )}
          {card.slots.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin horarios libres ese día.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {card.slots.slice(0, 16).map((s) => (
                <span
                  key={s}
                  className="border border-primary/40 bg-primary-light px-2 py-1 font-mono text-xs text-primary"
                >
                  {s}
                </span>
              ))}
            </div>
          )}
        </CardShell>
      );

    case "turno":
      return (
        <CardShell tag={`Turno ${card.accion}`}>
          <div className="flex items-start gap-3">
            <div className="mt-0.5 text-accent">✓</div>
            <div className="text-sm">
              {card.doctor && (
                <div>
                  <span className="font-medium">{card.doctor.name}</span>{" "}
                  <span className="text-muted-foreground">— {card.doctor.specialty}</span>
                </div>
              )}
              {card.doctor && (
                <div className="text-xs text-muted-foreground">{card.doctor.hospital_name}</div>
              )}
              <div className="mt-1 font-mono">
                {card.fecha ?? "—"} {card.hora ? `· ${card.hora}` : ""}
              </div>
              {card.patient && (
                <div className="mt-1 text-xs text-muted-foreground">
                  Paciente: {card.patient.name}
                </div>
              )}
            </div>
          </div>
        </CardShell>
      );

    case "lista_espera":
      return (
        <CardShell tag="Lista de espera">
          <div className="text-sm">
            <div className="font-medium">{card.especialidad ?? "Especialidad"}</div>
            <div className="text-xs text-muted-foreground">
              Entre {card.fecha_desde ?? "—"} y {card.fecha_hasta ?? "—"}
              {card.preferencia ? ` · ${card.preferencia}` : ""}
            </div>
            {card.patient && (
              <div className="mt-1 text-xs text-muted-foreground">Paciente: {card.patient.name}</div>
            )}
          </div>
        </CardShell>
      );

    case "paciente":
      return (
        <CardShell tag={card.registrado ? "Paciente registrado" : "Paciente"}>
          <div className="text-sm font-medium">{card.nombre ?? "—"}</div>
          {card.telefono && <div className="text-xs text-muted-foreground">{card.telefono}</div>}
        </CardShell>
      );

    default:
      return null;
  }
}
