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
  WriteInputOutputSchema,
  WriteInputSchema,
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
 * Tool handler return type
 */
type ToolResult = {
  content: Array<{ type: "text"; text: string }>;
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
};

/**
 * Create tool handlers bound to server instance
 * @param server McpServer instance
 * @returns Tool handler functions
 */
export const createToolHandlers = (server: McpServer) => {
  return {
    start: async ({ command }: { command: string }): Promise<ToolResult> => {
      const sessionId = getBoundSessionId(server);
      const ptyManager = sessionManager.getPtyManager(sessionId);
      if (!ptyManager) throw new Error("Session not found");
      const { processId, screen } = await ptyManager.createPty(command);
      sessionManager.addPty(sessionId, processId);
      return {
        content: [
          { type: "text", text: JSON.stringify({ processId, screen }) },
        ],
        structuredContent: { processId, screen },
      };
    },

    kill: async ({ processId }: { processId: string }): Promise<ToolResult> => {
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

    list: async (_input: Record<string, never>): Promise<ToolResult> => {
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

    read: async ({ processId }: { processId: string }): Promise<ToolResult> => {
      const sessionId = getBoundSessionId(server);
      const ptyManager = sessionManager.getPtyManager(sessionId);
      if (!ptyManager) throw new Error("Session not found");
      const pty = ptyManager.getPty(processId);
      if (!pty) throw new Error("PTY not found");
      const screen = pty.captureBuffer().join("\n").trimEnd();
      return {
        content: [{ type: "text", text: JSON.stringify({ screen }) }],
        structuredContent: { screen },
      };
    },

    write_input: async ({
      processId,
      data,
      waitMs = 1000,
    }: {
      processId: string;
      data: string;
      waitMs?: number;
    }): Promise<ToolResult> => {
      const sessionId = getBoundSessionId(server);
      const ptyManager = sessionManager.getPtyManager(sessionId);
      if (!ptyManager) throw new Error("Session not found");
      const pty = ptyManager.getPty(processId);
      if (!pty) throw new Error("PTY not found");
      const result = await pty.write(data, waitMs);
      return {
        content: [{ type: "text", text: JSON.stringify(result) }],
        structuredContent: result,
      };
    },
  };
};

/**
 * Register PTY tools to the server
 * @param server McpServer instance
 */
export const registerPtyTools = (server: McpServer): void => {
  const handlers = createToolHandlers(server);

  // Register start tool
  server.registerTool(
    "start",
    {
      title: "Start PTY",
      description:
        "Create new PTY instance with shell execution (using $SHELL or /bin/sh). Returns processId and initial output.",
      inputSchema: StartPtyInputSchema.shape,
      outputSchema: StartPtyOutputSchema.shape,
    },
    handlers.start,
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
    handlers.kill,
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
    handlers.list,
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
    handlers.read,
  );

  // Register write_input tool
  server.registerTool(
    "write_input",
    {
      title: "Write Input to PTY",
      description:
        "Write data to PTY stdin and return terminal state. Supports plain text, CJK, Emoji, multiline (\\n), and ANSI control codes (e.g., \\x03 for Ctrl+C).",
      inputSchema: WriteInputSchema.shape,
      outputSchema: WriteInputOutputSchema.shape,
    },
    handlers.write_input,
  );

  // activate_pty_tools: TODO
};
