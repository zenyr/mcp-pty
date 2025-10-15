import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { sessionManager } from "@pkgs/session-manager";
import { toReqRes } from "fetch-to-node";
import { Hono } from "hono";
import { bindSessionToServer } from "../tools";
import { logError, logServer } from "../utils";

/**
 * Start stdio server
 * @param server McpServer instance
 */
export const startStdioServer = async (server: McpServer): Promise<void> => {
  const sessionId = sessionManager.createSession();
  try {
    bindSessionToServer(server, sessionId);
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
 * @param port HTTP server port
 */
export const startHttpServer = async (
  server: McpServer,
  port: number,
): Promise<void> => {
  const app = new Hono();
  const transports = new Map<string, StreamableHTTPServerTransport>();

  app.post("/mcp", async (c) => {
    const sessionHeader = c.req.header("mcp-session-id");
    let transport: StreamableHTTPServerTransport;
    let sessionId: string;

    if (sessionHeader && transports.has(sessionHeader)) {
      const existingTransport = transports.get(sessionHeader);
      if (!existingTransport) {
        throw new Error(`Transport not found for session: ${sessionHeader}`);
      }
      transport = existingTransport;
      sessionId = sessionHeader;
    } else {
      // New session - create session first, then bind to server
      sessionId = sessionManager.createSession();
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => sessionId,
        enableJsonResponse: true,
        onsessioninitialized: (id) => {
          transports.set(id, transport);
        },
      });
      bindSessionToServer(server, sessionId);
      await server.connect(transport);
      sessionManager.updateStatus(sessionId, "active");
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

  logServer(`MCP PTY server started via HTTP on port ${port}`);
  Bun.serve({ port, fetch: app.fetch });
};
