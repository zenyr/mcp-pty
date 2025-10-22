import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  sessionManager as globalSessionManager,
  type SessionManager,
} from "@pkgs/session-manager";
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
import { normalizeWorkingDirectory } from "../utils";
import {
  SESSION_ID_SYMBOL,
  SESSION_MANAGER_SYMBOL,
  type ServerWithContext,
} from "../utils/server-context";

/**
 * Bind session ID to server instance
 * Called by transport layer after session creation
 */
export const bindSessionToServer = (
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
    start: async ({
      command,
      pwd,
    }: {
      command: string;
      pwd: string;
    }): Promise<ToolResult> => {
      const sessionManager = getSessionManager(server);
      const sessionId = getBoundSessionId(server);
      const ptyManager = sessionManager.getPtyManager(sessionId);
      if (!ptyManager) throw new Error("Session not found");

      // Normalize and validate working directory
      const cwd = normalizeWorkingDirectory(pwd);

      // Validate directory exists and is a directory
      let stat: Awaited<ReturnType<typeof Bun.file.prototype.stat>>;
      try {
        stat = await Bun.file(cwd).stat();
      } catch (_error) {
        throw new Error(
          `Working directory does not exist or is inaccessible: ${cwd}`,
        );
      }

      if (!stat.isDirectory()) {
        throw new Error(`Path is not a directory: ${cwd}`);
      }

      const { processId, screen, exitCode } = await ptyManager.createPty({
        command,
        cwd,
      });
      sessionManager.addPty(sessionId, processId);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ processId, screen, exitCode }),
          },
        ],
        structuredContent: { processId, screen, exitCode },
      };
    },

    kill: async ({ processId }: { processId: string }): Promise<ToolResult> => {
      const sessionManager = getSessionManager(server);
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
      const sessionManager = getSessionManager(server);
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
          exitCode: pty.getExitCode(),
        }));
      return {
        content: [{ type: "text", text: JSON.stringify({ ptys }) }],
        structuredContent: { ptys },
      };
    },

    read: async ({ processId }: { processId: string }): Promise<ToolResult> => {
      const sessionManager = getSessionManager(server);
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
      input,
      ctrlCode,
      data,
      waitMs = 1000,
    }: {
      processId: string;
      input?: string;
      ctrlCode?: string;
      data?: string;
      waitMs?: number;
    }): Promise<ToolResult> => {
      const sessionManager = getSessionManager(server);
      const sessionId = getBoundSessionId(server);
      const ptyManager = sessionManager.getPtyManager(sessionId);
      if (!ptyManager) throw new Error("Session not found");
      const pty = ptyManager.getPty(processId);
      if (!pty) throw new Error("PTY not found");

      // Validate input parameters using schema
      const validationResult = WriteInputSchema.safeParse({
        processId,
        input,
        ctrlCode,
        data,
        waitMs,
      });
      if (!validationResult.success) {
        throw new Error(
          `Invalid input: ${validationResult.error.issues
            .map((i) => i.message)
            .join(", ")}`,
        );
      }

      // Additional validation: at least one of input, ctrlCode, or data must be present
      if (input === undefined && ctrlCode === undefined && data === undefined) {
        throw new Error(
          "At least one of 'input', 'ctrlCode', or 'data' must be provided",
        );
      }

      // Additional validation: data and (input/ctrlCode) are mutually exclusive
      const hasData = data !== undefined;
      const hasInputOrCtrl = input !== undefined || ctrlCode !== undefined;
      if (hasData && hasInputOrCtrl) {
        throw new Error(
          "Cannot use 'data' together with 'input' or 'ctrlCode'. Use either data (raw mode) OR input+ctrlCode (safe mode).",
        );
      }

      // Build final data to write
      let finalData: string;

      if (data !== undefined) {
        // Legacy mode: use data field as-is
        finalData = data;
      } else {
        // New mode: combine input + ctrlCode
        const { resolveControlCode } = await import("../types/control-codes");
        finalData =
          (input ?? "") + (ctrlCode ? resolveControlCode(ctrlCode) : "");
      }

      const result = await pty.write(finalData, waitMs);
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
        "Create PTY, execute command, return processId & screen. Supports bash/python/node, dev servers, vim/htop, shell cmds. Use write_input for stdin, read for output, kill to terminate.",
      inputSchema: StartPtyInputSchema.shape,
      outputSchema: StartPtyOutputSchema.shape,
    },
    handlers.start,
  );

  server.registerTool(
    "kill",
    {
      title: "Kill PTY",
      description: "Terminate PTY process",
      inputSchema: KillPtyInputSchema.shape,
      outputSchema: KillPtyOutputSchema.shape,
    },
    handlers.kill,
  );

  server.registerTool(
    "list",
    {
      title: "List PTYs",
      description: "List running PTY processes in session",
      inputSchema: ListPtyInputSchema.shape,
      outputSchema: ListPtyOutputSchema.shape,
    },
    handlers.list,
  );

  server.registerTool(
    "read",
    {
      title: "Read PTY",
      description: "Read PTY screen buffer",
      inputSchema: ReadPtyInputSchema.shape,
      outputSchema: ReadPtyOutputSchema.shape,
    },
    handlers.read,
  );

  server.registerTool(
    "write_input",
    {
      title: "Write Input to PTY",
      description:
        "Send input to PTY stdin, return screen state. Two modes: Safe (input + ctrlCode) or Raw (data). Ex: {input: 'ls', ctrlCode: 'Enter'} or {data: 'ls\\n'}. Windows SSH: use CRLF (\\r\\n) not LF.",
      inputSchema: WriteInputSchema.shape,
      outputSchema: WriteInputOutputSchema.shape,
    },
    handlers.write_input,
  );

  // activate_pty_tools: TODO
};
