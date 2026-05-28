export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Mints a short-lived signed WebSocket URL for the browser so the ElevenLabs API
// key never reaches the client. The /asistente-eleven page fetches this and
// passes the URL to `conversation.startSession({ signedUrl })`.
//
// Requires ELEVENLABS_API_KEY and ELEVENLABS_AGENT_ID. If the agent is public
// (auth disabled), the page can fall back to NEXT_PUBLIC_ELEVENLABS_AGENT_ID
// and skip this endpoint entirely.

export async function GET(): Promise<Response> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  const agentId = process.env.ELEVENLABS_AGENT_ID;

  if (!apiKey || !agentId) {
    return Response.json(
      { error: "Falta ELEVENLABS_API_KEY o ELEVENLABS_AGENT_ID en el servidor." },
      { status: 500 },
    );
  }

  const res = await fetch(
    `https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=${encodeURIComponent(
      agentId,
    )}`,
    { headers: { "xi-api-key": apiKey } },
  );

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    return Response.json(
      { error: "No se pudo obtener la URL firmada de ElevenLabs.", detail },
      { status: 502 },
    );
  }

  const data = (await res.json()) as { signed_url?: string };
  if (!data.signed_url) {
    return Response.json({ error: "Respuesta sin signed_url." }, { status: 502 });
  }

  return Response.json({ signedUrl: data.signed_url });
}
