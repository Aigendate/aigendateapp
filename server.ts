import express, { type Request, type Response } from "express";
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { randomUUID } from "node:crypto";
import { createMcpServer } from "./server/mcp.js";

const app = express();
const port = parseInt(process.env.PORT || "3456", 10);
const isProd = process.env.NODE_ENV === "production";

const sessions = new Map<string, { server: McpServer; transport: StreamableHTTPServerTransport }>();

async function mcpHandler(req: Request, res: Response) {
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
  const server = createMcpServer();
  await server.connect(transport);
  transport.onclose = () => {
    if (transport.sessionId) sessions.delete(transport.sessionId);
  };
  await transport.handleRequest(req, res);
  if (transport.sessionId) sessions.set(transport.sessionId, { server, transport });
}

const mcpRouter = express.Router();
mcpRouter.use("/", (req, res, next) => {
  mcpHandler(req, res).catch(next);
});
app.use("/mcp", mcpRouter);

if (isProd) {
  app.use(express.static("build/client"));

  // @ts-expect-error build output exists after `npm run build`
  const build = await import("./build/server/index.js");
  const { createRequestHandler } = await import("@react-router/express");
  app.use(createRequestHandler({ build }));
} else {
  const vite = await import("vite");
  const devServer = await vite.createServer({
    server: { middlewareMode: true },
  });
  app.use(devServer.middlewares);

  const { createRequestHandler } = await import("@react-router/express");
  app.use((req, res, next) => {
    const handler = createRequestHandler({
      build: () => devServer.ssrLoadModule("virtual:react-router/server-build") as any,
    });
    return handler(req, res, next);
  });
}

app.listen(port, () => {
  console.log(`Turnos running at http://localhost:${port}`);
  console.log(`MCP HTTP at http://localhost:${port}/mcp`);
  if (!isProd) console.log("Dev mode with HMR");
});
