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

  const transcriptEndRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
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
    <div className="grid gap-6 lg:grid-cols-[minmax(0,360px)_1fr]">
      {/* Call control panel */}
      <div className="flex flex-col gap-5">
        <div className="border border-border bg-card p-6">
          <div className="mb-1 text-[0.6rem] uppercase tracking-[0.2em] text-muted-foreground">
            Asistente de voz
          </div>
          <h2 className="font-serif text-3xl leading-tight">Hablá con Sofía</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Pedile un especialista, consultá horarios y agendá tu turno hablando, como con una
            recepcionista. Lo que vaya encontrando aparece acá al lado.
          </p>

          <div className="mt-6 flex items-center gap-4">
            <Orb status={status} speaking={assistantSpeaking} volume={volume} />
            <div className="flex-1">
              <StatusPill status={status} speaking={assistantSpeaking} />
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
                      muted ? "bg-foreground text-background" : "bg-transparent hover:bg-muted"
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
            {lines.length === 0 && !partial ? (
              <p className="text-sm text-muted-foreground">
                {isLive ? "Escuchando…" : "Cuando inicies la llamada, la transcripción aparece acá."}
              </p>
            ) : (
              <>
                {lines.map((l) => (
                  <TranscriptBubble key={l.id} line={l} />
                ))}
                {partial && <TranscriptBubble line={partial} dim />}
              </>
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
              Los doctores, horarios y turnos que mencione Sofía van apareciendo acá como tarjetas.
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
  const scale = active ? 1 + Math.min(volume, 1) * 0.45 : 1;
  return (
    <div className="relative flex h-16 w-16 shrink-0 items-center justify-center">
      <div
        className={cn(
          "absolute h-12 w-12 rounded-full transition-transform duration-100",
          speaking ? "bg-accent/30" : "bg-primary/20"
        )}
        style={{ transform: `scale(${scale})` }}
      />
      <div
        className={cn(
          "h-9 w-9 rounded-full",
          status === "connecting" && "animate-pulse bg-muted-foreground",
          status === "idle" && "bg-muted-foreground/40",
          status === "ended" && "bg-muted-foreground/40",
          active && (speaking ? "bg-accent" : "bg-primary")
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
            ? "Sofía está hablando"
            : "Te escucho";
  return (
    <span className="font-mono text-[0.7rem] uppercase tracking-wider text-foreground">{label}</span>
  );
}

function TranscriptBubble({ line, dim }: { line: TranscriptLine; dim?: boolean }) {
  const isSofia = line.role === "assistant";
  return (
    <div className={cn("flex", isSofia ? "justify-start" : "justify-end")}>
      <div
        className={cn(
          "max-w-[85%] px-3 py-1.5 text-sm",
          isSofia
            ? "bg-primary-light text-foreground"
            : "bg-muted text-foreground",
          dim && "opacity-60"
        )}
      >
        <span className="mr-1.5 text-[0.6rem] uppercase tracking-wider text-muted-foreground">
          {isSofia ? "Sofía" : "Vos"}
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
                <li key={d.id} className="flex items-baseline justify-between gap-3 py-2 first:pt-0 last:pb-0">
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
                <div className="mt-1 text-xs text-muted-foreground">Paciente: {card.patient.name}</div>
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
