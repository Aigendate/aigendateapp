import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { getDb } from "../../server/db";

// Initialize the shared DB singleton with an in-memory DB before importing
// the route handler — the handler's createMcpServer() will reuse this instance.
getDb(":memory:");

const route = await import("../../app/mcp/route");

describe("MCP route handler", () => {
  afterAll(() => {
    (globalThis as any).__turnos_db = undefined;
    (globalThis as any).__mcp_sessions = undefined;
  });

  it("OPTIONS returns 204 with CORS headers", async () => {
    const res = await route.OPTIONS();
    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
    expect(res.headers.get("access-control-allow-methods")).toContain("POST");
  });

  it("POST initialize returns valid MCP response", async () => {
    const req = new Request("http://localhost/mcp", {
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
    const res = await route.POST(req);
    expect(res.status).toBe(200);
    const text = await res.text();
    const dataLine = text.split("\n").find((l) => l.startsWith("data: "));
    expect(dataLine).toBeTruthy();
    const body = JSON.parse(dataLine!.replace("data: ", ""));
    expect(body.result.serverInfo.name).toBe("turnos");
    expect(body.result.capabilities.tools).toBeDefined();
  });
});
