import { describe, it, expect } from "vitest";
import { createMcpServer } from "../../server/mcp";

describe("createMcpServer", () => {
  it("returns an McpServer instance", () => {
    const server = createMcpServer();
    expect(server).toBeDefined();
    expect(typeof server.connect).toBe("function");
  });
});
