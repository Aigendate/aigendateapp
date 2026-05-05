import { describe, it, expect, afterEach } from "vitest";
import { createMcpServer } from "../../server/mcp.js";

describe("createMcpServer", () => {
  afterEach(() => {
    (globalThis as any).__turnos_db = undefined;
  });

  it("returns an McpServer instance", () => {
    const server = createMcpServer(":memory:");
    expect(server).toBeDefined();
    expect(typeof server.connect).toBe("function");
  });
});
