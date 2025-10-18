import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { sessionManager } from "@pkgs/session-manager";
import { toFetchResponse, toReqRes } from "fetch-to-node";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { bindSessionToServerResources } from "../resources";
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
    bindSessionToServerResources(server, sessionId);
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
  serverFactory: () => McpServer,
  port: number,
): Promise<void> => {
  const app = new Hono();
  const sessions = new Map<
    string,
    { server: McpServer; transport: StreamableHTTPServerTransport }
  >();

  app.use(logger());
  app.use(cors({ origin: "*", exposeHeaders: ["mcp-session-id"] }));

  // DELETE endpoint to gracefully cleanup session
  app.delete("/mcp", async (c) => {
    const sessionHeader = c.req.header("mcp-session-id");
    if (!sessionHeader) {
      return c.json({ error: "Missing mcp-session-id header" }, 400);
    }

    const session = sessions.get(sessionHeader);
    if (session) {
      try {
        await session.transport.close();
      } catch {
        // Ignore errors during close
      }
      sessions.delete(sessionHeader);
    }

    // Dispose PTYs but keep session for potential reconnection
    const ptyManager = sessionManager.getPtyManager(sessionHeader);
    ptyManager?.dispose();
    sessionManager.updateStatus(sessionHeader, "terminated");
    logServer(`Session PTYs disposed, session preserved: ${sessionHeader}`);
    return c.json({ success: true, sessionId: sessionHeader });
  });

  app.all("/mcp", async (c) => {
    const sessionHeader = c.req.header("mcp-session-id");
    let sessionId: string = "N/A";
    try {
      let session = sessionHeader ? sessions.get(sessionHeader) : undefined;

      if (!session) {
        if (sessionHeader) {
          // Check if session exists in sessionManager (for reconnection)
          const existingSession = sessionManager.getSession(sessionHeader);
          if (existingSession) {
            // Reconnect to existing session
            sessionId = sessionHeader;
            const server = serverFactory();
            const transport = new StreamableHTTPServerTransport({
              sessionIdGenerator: () => sessionId,
              enableJsonResponse: true,
              onsessioninitialized: (id) => {
                sessions.set(id, { server, transport });
              },
            });

            bindSessionToServer(server, sessionId);
            bindSessionToServerResources(server, sessionId);
            await server.connect(transport);
            sessionManager.updateStatus(sessionId, "active");

            session = { server, transport };
            logServer(`Reconnected to session: ${sessionId}`);
          } else {
            // Stale session, cleanup and create new
            const oldSession = sessions.get(sessionHeader);
            if (oldSession) {
              try {
                await oldSession.transport.close();
              } catch {
                // Ignore errors during close
              }
              sessions.delete(sessionHeader);
            }
            logServer(
              `Cleaned up stale session for new connection: ${sessionHeader}`,
            );

            // Create new session
            sessionId = sessionManager.createSession();
            const server = serverFactory();
            const transport = new StreamableHTTPServerTransport({
              sessionIdGenerator: () => sessionId,
              enableJsonResponse: true,
              onsessioninitialized: (id) => {
                sessions.set(id, { server, transport });
              },
            });

            bindSessionToServer(server, sessionId);
            bindSessionToServerResources(server, sessionId);
            await server.connect(transport);
            sessionManager.updateStatus(sessionId, "active");

            session = { server, transport };
          }
        } else {
          // New session
          sessionId = sessionManager.createSession();
          const server = serverFactory();
          const transport = new StreamableHTTPServerTransport({
            sessionIdGenerator: () => sessionId,
            enableJsonResponse: true,
            onsessioninitialized: (id) => {
              sessions.set(id, { server, transport });
            },
          });

          bindSessionToServer(server, sessionId);
          bindSessionToServerResources(server, sessionId);
          await server.connect(transport);
          sessionManager.updateStatus(sessionId, "active");

          session = { server, transport };
        }
      } else {
        // Type guard: sessionHeader is defined here because session exists
        if (!sessionHeader) {
          throw new Error("Session exists but sessionHeader is undefined");
        }
        sessionId = sessionHeader;
      }

      const { req, res } = toReqRes(c.req.raw);
      const currentSessionId = sessionId;
      res.on("close", () => {
        const transportSessionId = session?.transport.sessionId;
        if (transportSessionId) {
          // Dispose PTYs but keep session for reconnection
          const ptyManager = sessionManager.getPtyManager(transportSessionId);
          ptyManager?.dispose();
          sessionManager.updateStatus(transportSessionId, "terminated");
          sessions.delete(transportSessionId);
        }
      });
      const body = (await c.req.text()).trim();
      const jsonBody = body && JSON.parse(body);
      await session.transport.handleRequest(req, res, jsonBody);
      const response = await toFetchResponse(res);
      // Ensure session ID header is set for client to reuse
      if (!sessionHeader) {
        response.headers.set("mcp-session-id", currentSessionId);
      }
      return response;
    } catch (error) {
      logError(`[HTTP] Error (sessionId=${sessionId})`, error);
      return c.json({ error: "MCP server error" }, 500);
    }
  });

  logServer(`MCP PTY server started via HTTP on port ${port}`);
  Bun.serve({ port, fetch: app.fetch });
};
