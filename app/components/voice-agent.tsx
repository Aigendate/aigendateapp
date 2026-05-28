"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "~/lib/utils";

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

const PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY;
const ASSISTANT_ID =
  process.env.NEXT_PUBLIC_VAPI_ASSISTANT_ID ?? "904638c6-5a84-4e0b-9552-d0320ef59737";

// ---- Component -------------------------------------------------------------

export function VoiceAgent() {
  const vapiRef = useRef<{ stop: () => void; setMuted: (m: boolean) => void } | null>(null);
  const [status, setStatus] = useState<CallStatus>("idle");
  const [muted, setMuted] = useState(false);
  const [assistantSpeaking, setAssistantSpeaking] = useState(false);
  const [volume, setVolume] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [lines, setLines] = useState<TranscriptLine[]>([]);
  const [partial, setPartial] = useState<TranscriptLine | null>(null);
  const [cards, setCards] = useState<FeedCard[]>([]);

  // Auto-scroll the transcript's own container (not the page) to the latest line.
  const transcriptScrollRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = transcriptScrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [lines, partial]);

  // Forward an observed tool call to the read-only mirror to get card data.
  const fetchCard = useCallback(async (callId: string, name: string, args: unknown) => {
    try {
      const res = await fetch("/api/agent-ui", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, arguments: args }),
      });
      if (!res.ok) return;
      const { card } = (await res.json()) as { card: CardData | null };
      if (!card) return;
      setCards((prev) => [{ id: callId, ...card }, ...prev.filter((c) => c.id !== callId)]);
    } catch {
      // best-effort; voice is the source of truth
    }
  }, []);

  const handleMessage = useCallback(
    (message: { type?: string; role?: string; transcriptType?: string; transcript?: string; toolCallList?: unknown[] }) => {
      if (message.type === "transcript") {
        const role = message.role === "assistant" ? "assistant" : "user";
        const text = message.transcript ?? "";
        if (!text) return;
        if (message.transcriptType === "partial") {
          setPartial({ id: "partial", role, text });
        } else {
          setPartial(null);
          setLines((prev) => [...prev, { id: `${prev.length}-${role}`, role, text }]);
        }
        return;
      }

      if (message.type === "tool-calls" && Array.isArray(message.toolCallList)) {
        for (const raw of message.toolCallList) {
          const tc = raw as {
            id?: string;
            name?: string;
            arguments?: unknown;
            function?: { name?: string; arguments?: unknown };
          };
          const name = tc.name ?? tc.function?.name;
          if (!name) continue;
          let args = tc.arguments ?? tc.function?.arguments ?? {};
          if (typeof args === "string") {
            try {
              args = JSON.parse(args || "{}");
            } catch {
              args = {};
            }
          }
          fetchCard(tc.id ?? `${name}-${Math.round(volume * 1e6)}`, name, args);
        }
      }
    },
    [fetchCard, volume]
  );

  const start = useCallback(async () => {
    if (!PUBLIC_KEY) {
      setError("Falta NEXT_PUBLIC_VAPI_PUBLIC_KEY. Configurala para habilitar las llamadas.");
      return;
    }
    setError(null);
    setStatus("connecting");
    try {
      const { default: Vapi } = await import("@vapi-ai/web");
      const vapi = new Vapi(PUBLIC_KEY);
      vapiRef.current = vapi;

      vapi.on("call-start", () => setStatus("active"));
      vapi.on("call-end", () => {
        setStatus("ended");
        setAssistantSpeaking(false);
        setVolume(0);
        setPartial(null);
      });
      vapi.on("speech-start", () => setAssistantSpeaking(true));
      vapi.on("speech-end", () => setAssistantSpeaking(false));
      vapi.on("volume-level", (v: number) => setVolume(v));
      vapi.on("message", handleMessage);
      vapi.on("error", (e: unknown) => {
        const msg = e instanceof Error ? e.message : typeof e === "string" ? e : "Error en la llamada.";
        setError(msg);
        setStatus("ended");
      });

      await vapi.start(ASSISTANT_ID);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo iniciar la llamada.");
      setStatus("idle");
    }
  }, [handleMessage]);

  const stop = useCallback(() => {
    vapiRef.current?.stop();
  }, []);

  const toggleMute = useCallback(() => {
    setMuted((m) => {
      const next = !m;
      vapiRef.current?.setMuted(next);
      return next;
    });
  }, []);

  // Tear down the call if the component unmounts mid-conversation.
  useEffect(() => () => vapiRef.current?.stop(), []);

  const isLive = status === "active" || status === "connecting";

  return (
    <div className="flex flex-col gap-4">
      {/* ---- Slim control bar -------------------------------------------- */}
      <section className="animate-slide-up flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3 border border-border bg-card px-4 py-3">
          <div className="flex items-center gap-3">
            <Orb status={status} speaking={assistantSpeaking} volume={volume} />
            <div>
              <div className="text-[0.55rem] uppercase tracking-[0.3em] text-muted-foreground">
                Asistente de voz · Sofía
              </div>
              <div className="mt-1">
                <StatusPill status={status} speaking={assistantSpeaking} />
              </div>
            </div>
          </div>

          {isLive ? (
            <div className="flex gap-2">
              <button
                onClick={stop}
                className="bg-destructive px-5 py-2 font-mono text-[0.7rem] uppercase tracking-[0.2em] text-destructive-foreground transition-colors hover:bg-destructive/90"
              >
                Cortar
              </button>
              <button
                onClick={toggleMute}
                aria-pressed={muted}
                className={cn(
                  "border border-border px-5 py-2 font-mono text-[0.7rem] uppercase tracking-[0.2em] transition-colors",
                  muted ? "bg-foreground text-background" : "bg-card hover:bg-muted"
                )}
              >
                {muted ? "Silenciado" : "Silenciar"}
              </button>
            </div>
          ) : (
            <button
              onClick={start}
              className="group flex items-center gap-2.5 bg-primary px-6 py-2.5 font-mono text-[0.7rem] uppercase tracking-[0.22em] text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary-foreground transition-transform group-hover:scale-150" />
              {status === "ended" ? "Llamar de nuevo" : "Llamar a Sofía"}
            </button>
          )}
        </div>

        {error && (
          <div className="animate-slide-up border border-destructive bg-destructive-light px-4 py-2.5 text-xs text-destructive">
            {error}
          </div>
        )}
      </section>

      {/* ---- Conversation flow: transcript + live cards ------------------- */}
      <section className="grid gap-6 lg:grid-cols-2">
        {/* Transcript */}
        <div className="flex h-[70vh] min-h-[420px] flex-col border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border bg-muted/40 px-4 py-2.5">
            <span className="text-[0.6rem] uppercase tracking-[0.25em] text-muted-foreground">
              Conversación
            </span>
            {isLive && (
              <span className="flex items-center gap-1.5 text-[0.6rem] uppercase tracking-[0.2em] text-primary">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
                En curso
              </span>
            )}
          </div>
          <div ref={transcriptScrollRef} className="flex-1 space-y-2.5 overflow-y-auto p-4">
            {lines.length === 0 && !partial ? (
              <div className="flex h-full items-center justify-center px-6 text-center">
                <p className="max-w-[15rem] text-sm leading-relaxed text-muted-foreground">
                  {isLive
                    ? "Escuchando…"
                    : "Cuando inicies la llamada, la transcripción de la charla aparece acá."}
                </p>
              </div>
            ) : (
              <>
                {lines.map((l) => (
                  <TranscriptBubble key={l.id} line={l} />
                ))}
                {partial && <TranscriptBubble line={partial} dim />}
              </>
            )}
          </div>
        </div>

        {/* Card feed */}
        <div className="flex h-[70vh] min-h-[420px] flex-col border border-border bg-card/40">
          <div className="flex items-center justify-between border-b border-border bg-muted/40 px-4 py-2.5">
            <span className="text-[0.6rem] uppercase tracking-[0.25em] text-muted-foreground">
              En vivo
            </span>
            {cards.length > 0 && (
              <span className="bg-accent-light px-2 py-0.5 font-mono text-[0.6rem] uppercase tracking-[0.2em] text-accent">
                {cards.length} {cards.length === 1 ? "tarjeta" : "tarjetas"}
              </span>
            )}
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            {cards.length === 0 ? (
              <div className="flex h-full items-center justify-center px-6 text-center">
                <p className="max-w-[16rem] text-sm leading-relaxed text-muted-foreground">
                  Los doctores, horarios y turnos que mencione Sofía van apareciendo acá como
                  tarjetas.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {cards.map((card, i) => (
                  <div
                    key={card.id}
                    className="animate-card-rise"
                    style={{ animationDelay: `${Math.min(i, 4) * 60}ms` }}
                  >
                    <CardRenderer card={card} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

// ---- Subcomponents ---------------------------------------------------------

function Orb({
  status,
  speaking,
  volume,
}: {
  status: CallStatus;
  speaking: boolean;
  volume: number;
}) {
  const active = status === "active";
  // Volume drives the live "loudness" of the core; idle/ended sit calmly at rest.
  const scale = active ? 1 + Math.min(volume, 1) * 0.5 : 1;

  return (
    <div className="relative flex h-11 w-11 shrink-0 items-center justify-center">
      {/* Expanding ripples — only while the call is live */}
      {active && (
        <>
          <span
            className={cn(
              "absolute h-8 w-8 rounded-full border animate-ripple",
              speaking ? "border-accent/40" : "border-primary/35"
            )}
          />
          <span
            className={cn(
              "absolute h-8 w-8 rounded-full border animate-ripple",
              speaking ? "border-accent/40" : "border-primary/35"
            )}
            style={{ animationDelay: "1.2s" }}
          />
        </>
      )}

      {/* Soft halo glow */}
      <div
        className={cn(
          "absolute h-9 w-9 rounded-full blur-md transition-colors duration-500",
          status === "connecting" && "animate-shimmer bg-muted-foreground/40",
          status === "idle" && "animate-breathe bg-primary/25",
          status === "ended" && "bg-muted-foreground/20",
          active && (speaking ? "animate-glow bg-accent/45" : "animate-breathe bg-primary/35")
        )}
      />

      {/* Mid ring */}
      <div
        className={cn(
          "absolute h-7 w-7 rounded-full border transition-colors duration-500",
          speaking ? "border-accent/35" : active ? "border-primary/35" : "border-border"
        )}
      />

      {/* Core */}
      <div
        className={cn(
          "relative h-5 w-5 rounded-full shadow-[0_3px_10px_-2px_rgba(0,0,0,0.35)] transition-transform duration-100",
          status === "connecting" || status === "idle" || status === "ended"
            ? "orb-core-idle"
            : speaking
              ? "orb-core-speaking"
              : "orb-core-active"
        )}
        style={{ transform: `scale(${scale})` }}
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
            ? "Sofía está hablando"
            : "Te escucho";

  const dotClass =
    status === "connecting"
      ? "animate-pulse bg-muted-foreground"
      : status === "active"
        ? speaking
          ? "bg-accent"
          : "animate-pulse bg-primary"
        : "bg-muted-foreground/50";

  return (
    <span className="inline-flex items-center gap-2 border border-border bg-card px-3 py-1.5 font-mono text-[0.68rem] uppercase tracking-[0.2em] text-foreground">
      <span className={cn("h-1.5 w-1.5 rounded-full", dotClass)} />
      {label}
    </span>
  );
}

function TranscriptBubble({ line, dim }: { line: TranscriptLine; dim?: boolean }) {
  const isSofia = line.role === "assistant";
  return (
    <div className={cn("flex animate-slide-up", isSofia ? "justify-start" : "justify-end")}>
      <div className={cn("max-w-[85%]", dim && "opacity-60")}>
        <span
          className={cn(
            "mb-1 block text-[0.55rem] uppercase tracking-[0.2em] text-muted-foreground",
            isSofia ? "text-left" : "text-right"
          )}
        >
          {isSofia ? "Sofía" : "Vos"}
        </span>
        <div
          className={cn(
            "px-3.5 py-2 text-sm leading-relaxed",
            isSofia
              ? "border-l-2 border-primary bg-primary-light text-foreground"
              : "border-r-2 border-accent bg-muted text-foreground"
          )}
        >
          {line.text}
        </div>
      </div>
    </div>
  );
}

function CardShell({
  tag,
  accent = "primary",
  children,
}: {
  tag: string;
  accent?: "primary" | "accent" | "purple";
  children: React.ReactNode;
}) {
  const bar =
    accent === "accent" ? "bg-accent" : accent === "purple" ? "bg-purple" : "bg-primary";
  return (
    <div className="relative border border-border bg-card">
      <span className={cn("absolute inset-y-0 left-0 w-1", bar)} />
      <div className="border-b border-border bg-muted/40 px-4 py-2 pl-5 text-[0.6rem] uppercase tracking-[0.2em] text-muted-foreground">
        {tag}
      </div>
      <div className="p-4 pl-5">{children}</div>
    </div>
  );
}

// ---- Card helpers ----------------------------------------------------------

// Deterministically map a specialty to one of the brand accents so the same
// specialty always reads the same colour across cards.
const SPECIALTY_ACCENTS = [
  { chip: "bg-primary-light text-primary", glyph: "bg-primary text-primary-foreground" },
  { chip: "bg-accent-light text-accent", glyph: "bg-accent text-accent-foreground" },
  { chip: "bg-purple-light text-purple", glyph: "bg-purple text-primary-foreground" },
] as const;

function specialtyAccent(specialty: string) {
  let hash = 0;
  for (let i = 0; i < specialty.length; i++) {
    hash = (hash * 31 + specialty.charCodeAt(i)) >>> 0;
  }
  return SPECIALTY_ACCENTS[hash % SPECIALTY_ACCENTS.length];
}

// Split "HH:MM" slots into morning (< 12h) and afternoon (>= 12h) buckets.
function groupSlots(slots: string[]) {
  const manana: string[] = [];
  const tarde: string[] = [];
  for (const s of slots) {
    const hour = Number.parseInt(s.slice(0, 2), 10);
    if (Number.isNaN(hour)) continue;
    (hour < 12 ? manana : tarde).push(s);
  }
  return { manana, tarde };
}

function PinIcon() {
  return (
    <svg viewBox="0 0 12 12" className="h-3 w-3 shrink-0" fill="none" aria-hidden="true">
      <path
        d="M6 11s4-3.6 4-6.5A4 4 0 1 0 2 4.5C2 7.4 6 11 6 11Z"
        stroke="currentColor"
        strokeWidth="1"
      />
      <circle cx="6" cy="4.5" r="1.2" fill="currentColor" />
    </svg>
  );
}

function CardRenderer({ card }: { card: FeedCard }) {
  switch (card.kind) {
    case "doctores":
      return (
        <CardShell
          accent="accent"
          tag={`Doctores${card.query.especialidad ? ` · ${card.query.especialidad}` : ""}${
            card.query.ciudad ? ` · ${card.query.ciudad}` : ""
          }`}
        >
          {card.doctores.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin resultados.</p>
          ) : (
            <ul className="divide-y divide-border">
              {card.doctores.map((d) => {
                const accent = specialtyAccent(d.specialty);
                return (
                  <li key={d.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                    <span
                      className={cn(
                        "flex h-9 w-9 shrink-0 items-center justify-center font-serif text-base",
                        accent.glyph
                      )}
                      aria-hidden="true"
                    >
                      {d.name.replace(/^Dr[a]?\.?\s*/i, "").charAt(0).toUpperCase() || "·"}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{d.name}</div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <PinIcon />
                        <span className="truncate">{d.hospital_name}</span>
                      </div>
                    </div>
                    <span
                      className={cn(
                        "shrink-0 px-2 py-0.5 text-[0.62rem] uppercase tracking-wider",
                        accent.chip
                      )}
                    >
                      {d.specialty}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </CardShell>
      );

    case "hospitales":
      return (
        <CardShell accent="primary" tag="Hospitales">
          <ul className="divide-y divide-border">
            {card.hospitales.map((h) => (
              <li key={h.id} className="flex items-start gap-2.5 py-2.5 first:pt-0 last:pb-0">
                <span className="mt-0.5 text-primary">
                  <PinIcon />
                </span>
                <div className="min-w-0">
                  <div className="text-sm font-medium">{h.name}</div>
                  <div className="text-xs text-muted-foreground">{h.address}</div>
                </div>
              </li>
            ))}
          </ul>
        </CardShell>
      );

    case "disponibilidad": {
      const { manana, tarde } = groupSlots(card.slots);
      return (
        <CardShell accent="primary" tag={`Disponibilidad · ${card.fecha}`}>
          {card.doctor && (
            <div className="mb-3 text-sm">
              <span className="font-medium">{card.doctor.name}</span>{" "}
              <span className="text-muted-foreground">— {card.doctor.specialty}</span>
            </div>
          )}
          {card.slots.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin horarios libres ese día.</p>
          ) : (
            <div className="space-y-3">
              <SlotGroup label="Mañana" slots={manana} />
              <SlotGroup label="Tarde" slots={tarde} />
            </div>
          )}
        </CardShell>
      );
    }

    case "turno":
      return (
        <CardShell accent="primary" tag={`Turno ${card.accion}`}>
          <div className="flex items-start gap-3">
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center bg-primary text-lg text-primary-foreground"
              aria-hidden="true"
            >
              ✓
            </span>
            <div className="min-w-0 flex-1">
              {card.doctor && (
                <>
                  <div className="text-sm">
                    <span className="font-medium">{card.doctor.name}</span>{" "}
                    <span className="text-muted-foreground">— {card.doctor.specialty}</span>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <PinIcon />
                    {card.doctor.hospital_name}
                  </div>
                </>
              )}
              <div className="mt-2 flex items-baseline gap-2">
                <span className="font-serif text-2xl leading-none">{card.fecha ?? "—"}</span>
                {card.hora && (
                  <span className="bg-primary-light px-2 py-0.5 font-mono text-sm text-primary">
                    {card.hora}
                  </span>
                )}
              </div>
              {card.patient && (
                <div className="mt-2 text-xs text-muted-foreground">
                  Paciente: {card.patient.name}
                </div>
              )}
            </div>
          </div>
        </CardShell>
      );

    case "lista_espera":
      return (
        <CardShell accent="purple" tag="Lista de espera">
          <div className="text-sm">
            <div className="font-medium">{card.especialidad ?? "Especialidad"}</div>
            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
              <span className="border border-border bg-muted/60 px-2 py-0.5 font-mono">
                {card.fecha_desde ?? "—"} → {card.fecha_hasta ?? "—"}
              </span>
              {card.preferencia && (
                <span className="bg-purple-light px-2 py-0.5 uppercase tracking-wider text-purple">
                  {card.preferencia}
                </span>
              )}
            </div>
            {card.patient && (
              <div className="mt-2 text-xs text-muted-foreground">
                Paciente: {card.patient.name}
              </div>
            )}
          </div>
        </CardShell>
      );

    case "paciente":
      return (
        <CardShell accent="accent" tag={card.registrado ? "Paciente registrado" : "Paciente"}>
          <div className="flex items-center gap-3">
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center bg-accent font-serif text-base text-accent-foreground"
              aria-hidden="true"
            >
              {card.nombre?.charAt(0).toUpperCase() ?? "·"}
            </span>
            <div>
              <div className="text-sm font-medium">{card.nombre ?? "—"}</div>
              {card.telefono && (
                <div className="font-mono text-xs text-muted-foreground">{card.telefono}</div>
              )}
            </div>
          </div>
        </CardShell>
      );

    default:
      return null;
  }
}

function SlotGroup({ label, slots }: { label: string; slots: string[] }) {
  if (slots.length === 0) return null;
  return (
    <div>
      <div className="mb-1.5 text-[0.55rem] uppercase tracking-[0.2em] text-muted-foreground">
        {label}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {slots.slice(0, 12).map((s) => (
          <span
            key={s}
            className="border border-primary/30 bg-primary-light px-2 py-1 font-mono text-xs text-primary"
          >
            {s}
          </span>
        ))}
      </div>
    </div>
  );
}
