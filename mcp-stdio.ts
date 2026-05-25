#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createMcpServer } from "./server/mcp";

const server = createMcpServer();
const transport = new StdioServerTransport();
await server.connect(transport);
console.error("Turnos MCP Server running on stdio");
