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
 * Create HTTP 404 error response with session ID header
 * Used when session not found/expired to send new session ID to client
 */
const createSessionNotFoundResponse = (newSessionId: string) => {
  return new Response(
    JSON.stringify(createJsonRpcError(-32001, "Session not found")),
    {
      status: 404,
      headers: {
        "Content-Type": "application/json",
        "mcp-session-id": newSessionId,
      },
    },
  );
};

/**
 * Create StreamableHTTPServerTransport with session ID generator
 */
const createHttpTransport = (
  sessionId: string,
): StreamableHTTPServerTransport => {
  return new StreamableHTTPServerTransport({
    sessionIdGenerator: () => sessionId,
    enableJsonResponse: true,
  });
};

/**
 * Initialize session with server bindings
 * Sets up tools and resources for PTY management
 */
const initializeSessionBindings = (
  server: McpServer,
  sessionId: string,
): void => {
  bindSessionToServer(server, sessionId);
  bindSessionToServerResources(server, sessionId);
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
 * @returns Server instance for lifecycle management
 */
export const startHttpServer = async (
  serverFactory: () => McpServer,
  port: number,
): Promise<ReturnType<typeof Bun.serve>> => {
  const app = new Hono();

  /**
   * Session with typed transport sessionId
   * Extends StreamableHTTPServerTransport to ensure sessionId is tracked
   */
  interface HttpSession {
    server: McpServer;
    transport: StreamableHTTPServerTransport & { sessionId?: string };
    isConnecting?: boolean;
  }

  const sessions = new Map<string, HttpSession>();

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
          // Check if session exists in sessionManager (for reconnection or deferred initialization)
          const existingSession = sessionManager.getSession(sessionHeader);
          if (existingSession && existingSession.status !== "terminated") {
            // Session exists - reuse it if already in map (deferred init case)
            sessionId = sessionHeader;

            // Check if session was pre-registered but not yet initialized
            const deferredSession = sessions.get(sessionId);
            if (deferredSession) {
              // Session already exists in map - just need to initialize
              session = deferredSession;
              await session.server.connect(session.transport);
              sessionManager.updateStatus(sessionId, "active");
              logServer(`Initialized deferred session: ${sessionId}`);
            } else {
              // Reconnect to existing active session - create new transport
              const server = serverFactory();
              const transport = createHttpTransport(sessionId);

              initializeSessionBindings(server, sessionId);
              await server.connect(transport);
              sessionManager.updateStatus(sessionId, "active");

              session = { server, transport };
              sessions.set(sessionId, session);
              logServer(`Reconnected to session: ${sessionId}`);
            }
          } else {
            // Session is terminated or doesn't exist
            // Create new session for reconnection
            logServer(
              `Cannot reconnect to terminated session: ${sessionHeader}, creating new session`,
            );

            const newSessionId = sessionManager.createSession();
            const newServer = serverFactory();
            const newTransport = createHttpTransport(newSessionId);

            initializeSessionBindings(newServer, newSessionId);

            /**
             * MCP SDK Client Compatibility: Immediate Initialization on 404 Recovery
             *
             * StreamableHTTPClientTransport behavior:
             * 1. Receives 404 with mcp-session-id header
             * 2. Updates internal sessionId property
             * 3. Immediately retries with new sessionId
             *
             * Critical: We MUST initialize server.connect() BEFORE returning 404.
             * Otherwise, client's retry request will find uninitialized session
             * and receive "Bad Request: Server not initialized" (400 error).
             *
             * This is NOT deferred initialization - we block until server.connect()
             * completes to guarantee next client request succeeds.
             */
            try {
              await newServer.connect(newTransport);
              sessionManager.updateStatus(newSessionId, "active");
            } catch (err) {
              logError(
                `Failed to initialize recovered session ${newSessionId}`,
                err,
              );
              sessionManager.updateStatus(newSessionId, "terminated");
              return c.json(createJsonRpcError(-32603, "Internal error"), 500);
            }

            const newSession = { server: newServer, transport: newTransport };
            sessions.set(newSessionId, newSession);

            logServer(
              `Initialized recovered session (ready for retry): ${newSessionId}`,
            );

            // Return 404 with new session ID in header
            // Client will retry with this new ID, and session is ready
            return createSessionNotFoundResponse(newSessionId);
          }
        } else {
          /**
           * MCP SDK Client Compatibility: New Session Creation
           *
           * When client connects without mcp-session-id header (fresh connection),
           * we create session in "initializing" state and defer server.connect()
           * until handleRequest(). This allows SDK to send initialize request
           * before server is fully connected.
           *
           * Deferred initialization prevents race conditions where concurrent
           * requests might call server.connect() multiple times.
           */
          sessionId = sessionManager.createSession();
          const server = serverFactory();
          const transport = createHttpTransport(sessionId);

          initializeSessionBindings(server, sessionId);
          // DON'T call server.connect() yet - let it happen via handleRequest()

          session = { server, transport };
          sessions.set(sessionId, session);
          logServer(`Created new session (pending init): ${sessionId}`);
        }
      } else {
        // Type guard: sessionHeader is defined here because session exists
        if (!sessionHeader) {
          throw new Error("Session exists but sessionHeader is undefined");
        }
        sessionId = sessionHeader;
      }

      const currentSessionId = sessionId;

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
        // Session not found, create new session ID for client to use
        const newSessionId = sessionManager.createSession();
        const newServer = serverFactory();
        const newTransport = createHttpTransport(newSessionId);

        initializeSessionBindings(newServer, newSessionId);

        /**
         * MCP SDK Client Compatibility: Initialize for GET 404 Recovery
         * Same pattern as POST 404 recovery: initialize before returning 404
         * so client's next request finds a ready session.
         */
        try {
          await newServer.connect(newTransport);
          sessionManager.updateStatus(newSessionId, "active");
        } catch (err) {
          logError(
            `Failed to initialize recovered session ${newSessionId}`,
            err,
          );
          sessionManager.updateStatus(newSessionId, "terminated");
          return c.json(createJsonRpcError(-32603, "Internal error"), 500);
        }

        const newSession = { server: newServer, transport: newTransport };
        sessions.set(newSessionId, newSession);

        logServer(
          `Session ${sessionHeader} not found, created and initialized: ${newSessionId}`,
        );

        // Return 404 with new session ID in header so client can retry
        return createSessionNotFoundResponse(newSessionId);
      }

      // For POST/PUT requests, use raw request (do NOT read body with c.req.text())
      // The transport layer needs the original stream to handle JSON-RPC parsing
      const { req, res } = toReqRes(c.req.raw);

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

      /**
       * MCP SDK Client Compatibility: Deferred Initialization
       *
       * Initialize server connection on first request to prevent race conditions.
       * The isConnecting flag ensures only ONE concurrent request triggers server.connect().
       *
       * This pattern is required because:
       * 1. StreamableHTTPClientTransport sends initialize request immediately after connect()
       * 2. Multiple concurrent requests from client can arrive before server.connect() completes
       * 3. Without this guard, concurrent calls would trigger multiple server.connect() attempts
       *
       * Race condition scenario (without isConnecting flag):
       * - Request A: checks status=initializing, starts server.connect()
       * - Request B: checks status=initializing, starts server.connect() (ERROR: double connect)
       *
       * With isConnecting flag:
       * - Request A: sets isConnecting=true, starts server.connect()
       * - Request B: sees isConnecting=true, waits for completion
       */
      const sessionStatus = sessionManager.getSession(currentSessionId);
      if (
        sessionStatus &&
        sessionStatus.status === "initializing" &&
        !session.isConnecting
      ) {
        session.isConnecting = true;
        try {
          await session.server.connect(session.transport);
          sessionManager.updateStatus(currentSessionId, "active");
          logServer(
            `Initialized session before handleRequest: ${currentSessionId}`,
          );
        } finally {
          session.isConnecting = false;
        }
      }

      // Pass raw request to transport handler - it will parse the body itself
      await session.transport.handleRequest(req, res);
      const response = await toFetchResponse(res);
      // Ensure session ID header is set for client to reuse
      response.headers.set("mcp-session-id", currentSessionId);
      return response;
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      logError(`[HTTP] Error (sessionId=${sessionId})`, error);
      return c.json(createJsonRpcError(-32603, "Internal error"), 500);
    }
  });

  logServer(`MCP PTY server started via HTTP on port ${port}`);
  try {
    return Bun.serve({ port, fetch: app.fetch });
  } catch (err: unknown) {
    // Handle port conflict
    if (err instanceof Error && "code" in err && err.code === "EADDRINUSE") {
      logError(
        `Port ${port} is already in use. Please use a different port:`,
        new Error(
          `Use --port <PORT> flag or set MCP_PTY_PORT environment variable`,
        ),
      );
      process.exit(1);
    }
    throw err;
  }
};
