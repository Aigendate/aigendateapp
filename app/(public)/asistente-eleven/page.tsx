import { ElevenAgent } from "~/components/eleven-agent";

export const metadata = {
  title: "Asistente de voz (ElevenLabs) — Aigendate",
  description: "Agendá tu turno hablando con Lucía, sobre ElevenLabs Agents",
};

export default function AsistenteElevenPage() {
  return (
    <div className="animate-slide-up">
      <ElevenAgent />
    </div>
  );
}
