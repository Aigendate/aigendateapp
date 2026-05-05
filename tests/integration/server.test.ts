import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import express from "express";
import { createServer, type Server } from "node:http";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { randomUUID } from "node:crypto";
import { createMcpServer } from "../../server/mcp.js";

function buildTestApp() {
  const app = express();
  const sessions = new Map<string, { server: McpServer; transport: StreamableHTTPServerTransport }>();

  app.all("/mcp", async (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept, Authorization, Mcp-Session-Id");
    res.setHeader("Access-Control-Expose-Headers", "Mcp-Session-Id");

    if (req.method === "OPTIONS") {
      res.status(204).end();
      return;
    }

    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    if (sessionId && sessions.has(sessionId)) {
      await sessions.get(sessionId)!.transport.handleRequest(req, res);
      return;
    }

    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: () => randomUUID() });
    const server = createMcpServer(":memory:");
    await server.connect(transport);
    transport.onclose = () => { if (transport.sessionId) sessions.delete(transport.sessionId); };
    await transport.handleRequest(req, res);
    if (transport.sessionId) sessions.set(transport.sessionId, { server, transport });
  });

  app.get("/health", (_req, res) => {
    res.json({ ok: true });
  });

  return app;
}

describe("Express server", () => {
  let server: Server;
  let port: number;

  beforeAll(async () => {
    const app = buildTestApp();
    server = createServer(app);
    await new Promise<void>((resolve) => {
      server.listen(0, () => resolve());
    });
    const addr = server.address();
    port = typeof addr === "object" && addr ? addr.port : 0;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    (globalThis as any).__turnos_db = undefined;
  });

  it("OPTIONS /mcp returns 204 with CORS headers", async () => {
    const res = await fetch(`http://localhost:${port}/mcp`, { method: "OPTIONS" });
    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
    expect(res.headers.get("access-control-allow-methods")).toContain("POST");
  });

  it("POST /mcp with MCP initialize returns valid response", async () => {
    const res = await fetch(`http://localhost:${port}/mcp`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2024-11-05",
          capabilities: {},
          clientInfo: { name: "test", version: "1.0.0" },
        },
      }),
    });
    expect(res.status).toBe(200);
    const text = await res.text();
    // SSE response — parse the JSON from the data line
    const dataLine = text.split("\n").find((l) => l.startsWith("data: "));
    expect(dataLine).toBeTruthy();
    const body = JSON.parse(dataLine!.replace("data: ", ""));
    expect(body.result.serverInfo.name).toBe("turnos");
    expect(body.result.capabilities.tools).toBeDefined();
  });

  it("GET /health returns ok", async () => {
    const res = await fetch(`http://localhost:${port}/health`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });
});
