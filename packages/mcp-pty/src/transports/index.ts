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
 * MCP Streamable HTTP Error Handling Strategy
 *
 * Follows MCP Streamable HTTP specification for error responses.
 * Based on: https://spec.modelcontextprotocol.io/specification/2025-03-26/basic/protocols/streamable-http/
 *
 * Error HTTP Status Codes:
 * - 400: Bad Request (missing/invalid headers, parse errors)
 * - 404: Session Not Found (invalid/expired session ID)
 * - 406: Not Acceptable (invalid Accept/Content-Type headers)
 * - 415: Unsupported Media Type
 *
 * Response Format:
 * All errors return JSON-RPC 2.0 error object.
 * Standard error codes:
 * - -32000: Server error
 * - -32001: Session error (when session not found/expired)
 * - -32600: Invalid Request
 * - -32700: Parse error
 */

/**
 * Create MCP-compliant JSON-RPC error response object
 *
 * Follows JSON-RPC 2.0 spec: https://www.jsonrpc.org/specification
 *
 * @param code JSON-RPC error code (e.g., -32001 for session errors)
 * @param message Error message
 * @param data Optional error data (not included if undefined)
 * @param id JSON-RPC request ID (null for notifications/errors without request)
 * @returns JSON-RPC error object conforming to spec
 */
const createJsonRpcError = (
  code: number,
  message: string,
  data?: unknown,
  id: unknown = null,
) => {
  const error: Record<string, unknown> = { code, message };
  if (data !== undefined) {
    error.data = data;
  }
  return { jsonrpc: "2.0" as const, error, id };
};

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
 * @param serverFactory Factory function to create MCP servers
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
      return c.json(
        createJsonRpcError(
          -32600,
          "Invalid Request: Missing mcp-session-id header",
        ),
        400,
      );
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

    // Dispose PTYs and mark session as terminated
    const ptyManager = sessionManager.getPtyManager(sessionHeader);
    ptyManager?.dispose();
    sessionManager.updateStatus(sessionHeader, "terminated");
    logServer(`Session terminated: ${sessionHeader}`);
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
          if (existingSession && existingSession.status !== "terminated") {
            // Reconnect to existing session - reuse sessionHeader
            sessionId = sessionHeader;
            const server = serverFactory();
            const transport = new StreamableHTTPServerTransport({
              sessionIdGenerator: () => sessionId,
              enableJsonResponse: true,
            });

            bindSessionToServer(server, sessionId);
            bindSessionToServerResources(server, sessionId);
            await server.connect(transport);
            sessionManager.updateStatus(sessionId, "active");

            session = { server, transport };
            sessions.set(sessionId, session);
            logServer(`Reconnected to session: ${sessionId}`);
          } else {
            // Session is terminated or doesn't exist, return HTTP 404 with JSON-RPC error
            logServer(
              `Cannot reconnect to terminated session: ${sessionHeader}`,
            );
            return c.json(createJsonRpcError(-32001, "Session not found"), 404);
          }
        } else {
          // New session
          sessionId = sessionManager.createSession();
          const server = serverFactory();
          const transport = new StreamableHTTPServerTransport({
            sessionIdGenerator: () => sessionId,
            enableJsonResponse: true,
          });

          bindSessionToServer(server, sessionId);
          bindSessionToServerResources(server, sessionId);
          await server.connect(transport);
          sessionManager.updateStatus(sessionId, "active");

          session = { server, transport };
          sessions.set(sessionId, session);
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

      // Only cleanup on connection errors, not on normal request completion
      res.on("close", () => {
        const transportSessionId = session?.transport.sessionId;
        if (transportSessionId && res.writableEnded && !res.writableFinished) {
          // Connection was aborted or error occurred
          const ptyManager = sessionManager.getPtyManager(transportSessionId);
          ptyManager?.dispose();
          sessionManager.updateStatus(transportSessionId, "terminated");
          sessions.delete(transportSessionId);
          logServer(
            `Session cleaned up due to connection error: ${transportSessionId}`,
          );
        }
      });
      const body = (await c.req.text()).trim();
      let jsonBody: unknown;

      // Handle GET requests without body
      if (c.req.method === "GET") {
        if (!sessionHeader) {
          return c.json({
            success: true,
            message: "MCP PTY server is running",
            version: "0.1.0",
          });
        }
        // Check session status
        const existingSession = sessionManager.getSession(sessionHeader);
        if (existingSession) {
          return c.json({
            success: true,
            sessionId: sessionHeader,
            status: existingSession.status,
          });
        }
        // Session not found, return HTTP 404 with JSON-RPC error
        return c.json(createJsonRpcError(-32001, "Session not found"), 404);
      }

      // Parse body if present, otherwise undefined
      if (body) {
        try {
          jsonBody = JSON.parse(body);
        } catch (parseError) {
          logError(
            `[HTTP] Invalid JSON in request body (sessionId=${sessionId})`,
            parseError,
          );
          return c.json(createJsonRpcError(-32700, "Parse error"), 400);
        }
      }

      // Handle notifications (messages without id)
      if (
        jsonBody &&
        typeof jsonBody === "object" &&
        "method" in jsonBody &&
        jsonBody.method &&
        !("id" in jsonBody)
      ) {
        logServer(
          `[HTTP] Handling notification: ${String(jsonBody.method)} (sessionId=${sessionId})`,
        );
        // Process notifications through the transport to maintain session state
        await session.transport.handleRequest(req, res, jsonBody);
        const response = await toFetchResponse(res);
        response.headers.set("mcp-session-id", currentSessionId);
        return response;
      }

      await session.transport.handleRequest(req, res, jsonBody);
      const response = await toFetchResponse(res);
      // Ensure session ID header is set for client to reuse
      response.headers.set("mcp-session-id", currentSessionId);
      return response;
    } catch (error) {
      logError(`[HTTP] Error (sessionId=${sessionId})`, error);
      return c.json(createJsonRpcError(-32603, "Internal error"), 500);
    }
  });

  logServer(`MCP PTY server started via HTTP on port ${port}`);
  Bun.serve({ port, fetch: app.fetch });
};
