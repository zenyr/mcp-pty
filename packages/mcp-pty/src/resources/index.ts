import {
  type McpServer,
  ResourceTemplate,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  sessionManager as globalSessionManager,
  type SessionManager,
} from "@pkgs/session-manager";
import {
  SESSION_ID_SYMBOL,
  SESSION_MANAGER_SYMBOL,
  type ServerWithContext,
} from "../utils/server-context";

/**
 * Bind session ID to server instance for resources
 * Called by transport layer after session creation
 */
export const bindSessionToServerResources = (
  server: McpServer,
  sessionId: string,
  sessionManager?: SessionManager,
): void => {
  const serverWithContext = server as ServerWithContext;
  serverWithContext[SESSION_ID_SYMBOL] = sessionId;
  if (sessionManager) {
    serverWithContext[SESSION_MANAGER_SYMBOL] = sessionManager;
  }
};

/**
 * Get bound session ID from server instance
 */
const getBoundSessionId = (server: McpServer): string => {
  const serverWithContext = server as ServerWithContext;
  const sessionId = serverWithContext[SESSION_ID_SYMBOL];
  if (!sessionId) {
    throw new Error(
      "No session bound to server - transport initialization failed",
    );
  }
  return sessionId;
};

/**
 * Get SessionManager for server instance
 */
const getSessionManager = (server: McpServer): SessionManager => {
  const serverWithContext = server as ServerWithContext;
  return serverWithContext[SESSION_MANAGER_SYMBOL] || globalSessionManager;
};

/**
 * Resource handler factories for testing
 * These are exported separately to allow direct unit testing
 */
export const createResourceHandlers = (server: McpServer) => {
  return {
    status: async () => {
      const sessionManager = getSessionManager(server);
      return {
        contents: [
          {
            uri: "pty://status",
            text: JSON.stringify({
              sessions: sessionManager.getSessionCount(),
              processes: sessionManager
                .getAllSessions()
                .reduce((sum, session) => {
                  const ptyManager = sessionManager.getPtyManager(session.id);
                  return (
                    sum + (ptyManager ? ptyManager.getAllPtys().length : 0)
                  );
                }, 0),
            }),
          },
        ],
      };
    },
    processes: async () => {
      const sessionManager = getSessionManager(server);
      const sessionId = getBoundSessionId(server);
      const ptyManager = sessionManager.getPtyManager(sessionId);
      if (!ptyManager) throw new Error("Session not found");
      const processes = ptyManager
        .getAllPtys()
        .map((pty) => ({
          processId: pty.id,
          status: pty.status,
          createdAt: pty.createdAt.toISOString(),
          lastActivity: pty.lastActivity.toISOString(),
        }));
      return {
        contents: [
          { uri: "pty://processes", text: JSON.stringify({ processes }) },
        ],
      };
    },
    processOutput: async (
      uri: URL,
      variables: Record<string, string | string[]>,
    ) => {
      const sessionManager = getSessionManager(server);
      const sessionId = getBoundSessionId(server);
      const processId = variables.processId;
      if (typeof processId !== "string") throw new Error("Invalid process id");
      const ptyManager = sessionManager.getPtyManager(sessionId);
      if (!ptyManager) throw new Error("Session not found");
      const pty = ptyManager.getPty(processId);
      if (!pty) throw new Error("PTY process not found");
      const output = pty.getOutputBuffer();
      return {
        contents: [{ uri: uri.href, text: JSON.stringify({ output }) }],
      };
    },
  };
};

/**
 * Register PTY resources to the server
 * @param server McpServer instance
 */
export const registerPtyResources = (server: McpServer): void => {
  const handlers = createResourceHandlers(server);

  // Register global status resource (all sessions)
  server.registerResource(
    "status",
    "pty://status",
    {
      title: "Global Server Status",
      description: "Server status including all sessions and process counts",
    },
    handlers.status,
  );

  // Register processes resource (PTY process list)
  server.registerResource(
    "processes",
    "pty://processes",
    {
      title: "PTY Processes",
      description: "List of PTY processes in current session",
    },
    handlers.processes,
  );

  // Register process output resource template (specific process output)
  server.registerResource(
    "process-output",
    new ResourceTemplate("pty://processes/{processId}", { list: undefined }),
    {
      title: "PTY Process Output",
      description: "Output buffer for a specific PTY process",
    },
    handlers.processOutput,
  );
};
