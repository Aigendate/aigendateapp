import { VoiceAgent } from "~/components/voice-agent";

export const metadata = {
  title: "Asistente de voz — Aigendate",
  description: "Agendá tu turno hablando con Sofía",
};

export default function AsistentePage() {
  return (
    <div className="animate-slide-up">
      <VoiceAgent />
    </div>
  );
}
