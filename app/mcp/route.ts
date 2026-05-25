import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { randomUUID } from "node:crypto";
import { createMcpServer } from "../../server/mcp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Session = { server: McpServer; transport: WebStandardStreamableHTTPServerTransport };

declare global {
  var __mcp_sessions: Map<string, Session> | undefined;
}

const sessions: Map<string, Session> = (globalThis.__mcp_sessions ??= new Map());

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Accept, Authorization, Mcp-Session-Id",
  "Access-Control-Expose-Headers": "Mcp-Session-Id",
};

function withCors(res: Response): Response {
  for (const [k, v] of Object.entries(CORS_HEADERS)) {
    res.headers.set(k, v);
  }
  return res;
}

async function handle(request: Request): Promise<Response> {
  const sessionId = request.headers.get("mcp-session-id") ?? undefined;
  if (sessionId && sessions.has(sessionId)) {
    return withCors(await sessions.get(sessionId)!.transport.handleRequest(request));
  }

  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
  });
  const server = createMcpServer();
  await server.connect(transport);
  transport.onclose = () => {
    if (transport.sessionId) sessions.delete(transport.sessionId);
  };
  const response = await transport.handleRequest(request);
  if (transport.sessionId) sessions.set(transport.sessionId, { server, transport });
  return withCors(response);
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export const GET = handle;
export const POST = handle;
export const DELETE = handle;
