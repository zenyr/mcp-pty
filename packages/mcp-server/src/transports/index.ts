import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { sessionManager } from "@pkgs/session-manager";
import { toReqRes } from "fetch-to-node";
import { Hono } from "hono";
import { logError, logServer } from "../utils";

/**
 * Start stdio server
 * @param server McpServer instance
 */
export const startStdioServer = async (server: McpServer): Promise<void> => {
  const sessionId = sessionManager.createSession();
  try {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    sessionManager.updateStatus(sessionId, "active");
    logServer(`MCP PTY server started via stdio, session: ${sessionId}`);
  } catch (error) {
    logError("Error initializing MCP server", error);
    sessionManager.updateStatus(sessionId, "terminated");
    process.exit(1);
  }
};

/**
 * Start HTTP server
 * @param server McpServer instance
 */
export const startHttpServer = async (server: McpServer): Promise<void> => {
  const app = new Hono();
  const transports = new Map<string, StreamableHTTPServerTransport>();

  app.post("/mcp", async (c) => {
    const sessionId = c.req.header("mcp-session-id");
    let transport: StreamableHTTPServerTransport;

    if (sessionId && transports.has(sessionId)) {
      const existingTransport = transports.get(sessionId);
      if (!existingTransport) {
        throw new Error(`Transport not found for session: ${sessionId}`);
      }
      transport = existingTransport;
    } else {
      // New session
      const newSessionId = sessionManager.createSession();
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => newSessionId,
        enableJsonResponse: true,
        onsessioninitialized: (id) => {
          transports.set(id, transport);
        },
      });
      const newServer = server; // TODO: Create new server instance per session if needed
      await newServer.connect(transport);
      sessionManager.updateStatus(newSessionId, "active");
    }

    const { req, res } = toReqRes(c.req.raw);
    res.on("close", () => {
      if (transport.sessionId) {
        sessionManager.updateStatus(transport.sessionId, "terminated");
        transports.delete(transport.sessionId);
      }
    });
    try {
      await transport.handleRequest(req, res, await c.req.json());
    } catch (error) {
      logError("MCP server error", error);
      return c.json({ error: "MCP server error" }, 500);
    }
  });

  const port = 3000;
  logServer(`MCP PTY server started via HTTP on port ${port}`);
  Bun.serve({ port, fetch: app.fetch });
};
