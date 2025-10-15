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
  // Register start tool
  server.registerTool(
    "start",
    {
      title: "Start PTY",
      description:
        "Create new PTY instance. Use shellMode=true to inherit system shell environment. Returns processId and initial output.",
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
      const { processId, output } =
        await ptyManager.createPtyWithOutput(options);
      sessionManager.addPty(sessionId, processId);
      return {
        content: [
          { type: "text", text: JSON.stringify({ processId, output }) },
        ],
        structuredContent: { processId, output },
      };
    },
  );

  // Register kill tool
  server.registerTool(
    "kill",
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

  // Register list tool
  server.registerTool(
    "list",
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

  // Register read tool
  server.registerTool(
    "read",
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
