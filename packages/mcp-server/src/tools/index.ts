import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { sessionManager } from "@pkgs/session-manager";
import {
  KillPtyInputSchema,
  KillPtyOutputSchema,
  ListPtyInputSchema,
  ListPtyOutputSchema,
  ReadPtyInputSchema,
  ReadPtyOutputSchema,
  StartPtyInputSchema,
  StartPtyOutputSchema,
} from "../types";

/**
 * Session context holder for bound session ID
 * Maps server instance to its bound session ID
 */
const sessionContext = new WeakMap<McpServer, string>();

/**
 * Bind session ID to server instance
 * Called by transport layer after session creation
 */
export const bindSessionToServer = (
  server: McpServer,
  sessionId: string,
): void => {
  sessionContext.set(server, sessionId);
};

/**
 * Get bound session ID from server instance
 */
const getBoundSessionId = (server: McpServer): string => {
  const sessionId = sessionContext.get(server);
  if (!sessionId) {
    throw new Error(
      "No session bound to server - transport initialization failed",
    );
  }
  return sessionId;
};

/**
 * Register PTY tools to the server
 * @param server McpServer instance
 */
export const registerPtyTools = (server: McpServer): void => {
  // Register start_pty tool
  server.registerTool(
    "start_pty",
    {
      title: "Start PTY",
      description:
        "Create new PTY instance. Use shellMode=true to inherit system shell environment.",
      inputSchema: StartPtyInputSchema.shape,
      outputSchema: StartPtyOutputSchema.shape,
    },
    async ({
      command,
      shellMode,
    }: {
      command: string;
      shellMode?: boolean;
    }) => {
      const sessionId = getBoundSessionId(server);
      const ptyManager = sessionManager.getPtyManager(sessionId);
      if (!ptyManager) throw new Error("Session not found");
      const options = shellMode ? { executable: command, shellMode } : command;
      const processId = ptyManager.createPty(options);
      sessionManager.addPty(sessionId, processId);
      return {
        content: [{ type: "text", text: JSON.stringify({ processId }) }],
        structuredContent: { processId },
      };
    },
  );

  // Register kill_pty tool
  server.registerTool(
    "kill_pty",
    {
      title: "Kill PTY",
      description: "Terminate PTY instance",
      inputSchema: KillPtyInputSchema.shape,
      outputSchema: KillPtyOutputSchema.shape,
    },
    async ({ processId }) => {
      const sessionId = getBoundSessionId(server);
      const ptyManager = sessionManager.getPtyManager(sessionId);
      if (!ptyManager) throw new Error("Session not found");
      const success = ptyManager.removePty(processId);
      if (success) sessionManager.removePty(sessionId, processId);
      return {
        content: [{ type: "text", text: JSON.stringify({ success }) }],
        structuredContent: { success },
      };
    },
  );

  // Register list_pty tool
  server.registerTool(
    "list_pty",
    {
      title: "List PTY",
      description: "List PTY processes",
      inputSchema: ListPtyInputSchema.shape,
      outputSchema: ListPtyOutputSchema.shape,
    },
    async (_input: Record<string, never>) => {
      const sessionId = getBoundSessionId(server);
      const ptyManager = sessionManager.getPtyManager(sessionId);
      if (!ptyManager) throw new Error("Session not found");
      const ptys = ptyManager
        .getAllPtys()
        .map((pty) => ({
          id: pty.id,
          status: pty.status,
          createdAt: pty.createdAt.toISOString(),
          lastActivity: pty.lastActivity.toISOString(),
        }));
      return {
        content: [{ type: "text", text: JSON.stringify({ ptys }) }],
        structuredContent: { ptys },
      };
    },
  );

  // Register read_pty tool
  server.registerTool(
    "read_pty",
    {
      title: "Read PTY",
      description: "Read PTY output",
      inputSchema: ReadPtyInputSchema.shape,
      outputSchema: ReadPtyOutputSchema.shape,
    },
    async ({ processId }) => {
      const sessionId = getBoundSessionId(server);
      const ptyManager = sessionManager.getPtyManager(sessionId);
      if (!ptyManager) throw new Error("Session not found");
      const pty = ptyManager.getPty(processId);
      if (!pty) throw new Error("PTY not found");
      const output = pty.getOutputBuffer();
      return {
        content: [{ type: "text", text: JSON.stringify({ output }) }],
        structuredContent: { output },
      };
    },
  );

  // activate_pty_tools: TODO
};
