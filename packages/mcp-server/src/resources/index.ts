import {
  type McpServer,
  ResourceTemplate,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import { sessionManager } from "@pkgs/session-manager";

/**
 * Register PTY resources to the server
 * @param server McpServer instance
 */
export const registerPtyResources = (server: McpServer): void => {
  // Register status resource
  server.registerResource(
    "status",
    "pty://status",
    {
      title: "Server Status",
      description: "Server status including session and process counts",
    },
    async () => ({
      contents: [
        {
          uri: "pty://status",
          text: JSON.stringify({
            sessions: sessionManager.getSessionCount(),
            processes: 0, // TODO: PTY count
          }),
        },
      ],
    }),
  );

  // Register sessions/list resource
  server.registerResource(
    "sessions/list",
    new ResourceTemplate("pty://sessions/list", { list: undefined }),
    { title: "Sessions List", description: "List of all sessions" },
    async () => ({
      contents: [
        {
          uri: "pty://sessions/list",
          text: JSON.stringify(sessionManager.getAllSessions()),
        },
      ],
    }),
  );

  // Register session/output resource
  server.registerResource(
    "session/output",
    new ResourceTemplate("pty://session/{id}/output", { list: undefined }),
    {
      title: "Session PTY Output",
      description: "PTY output for a specific session",
    },
    async (uri, params) => {
      const id = params.id;
      if (typeof id !== "string") throw new Error("Invalid session id");
      const session = sessionManager.getSession(id);
      if (!session) throw new Error("Session not found");
      // TODO: Get PTY output
      return { contents: [{ uri: uri.href, text: "PTY output here" }] };
    },
  );

  // Register session/status resource
  server.registerResource(
    "session/status",
    new ResourceTemplate("pty://session/{id}/status", { list: undefined }),
    { title: "Session Status", description: "Status of a specific session" },
    async (uri, params) => {
      const id = params.id;
      if (typeof id !== "string") throw new Error("Invalid session id");
      const session = sessionManager.getSession(id);
      if (!session) throw new Error("Session not found");
      return { contents: [{ uri: uri.href, text: JSON.stringify(session) }] };
    },
  );
};
