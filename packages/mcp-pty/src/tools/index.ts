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
import { normalizeWorkingDirectory } from "../utils";

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
    start: async ({
      command,
      pwd,
    }: {
      command: string;
      pwd: string;
    }): Promise<ToolResult> => {
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
          exitCode: pty.getExitCode(),
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
        "Create new PTY instance and execute command. Supports interactive shells (bash/python/node), long-running processes (dev servers), TUI apps (vim/htop), and shell commands (ls/git). Returns processId for subsequent operations (write_input, read, kill) and initial screen output. Command runs in specified working directory (pwd). Use write_input to send input, read to get output, kill to terminate.",
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
        "Write input to PTY stdin and return terminal state. TWO MODES: (1) Safe mode [RECOMMENDED]: Use 'input' (plain text) + 'ctrlCode' (Enter/Escape/Ctrl+C) separately to avoid escape sequence confusion. Example: {input: 'print(2+2)', ctrlCode: 'Enter'}. (2) Raw mode: Use 'data' field for multiline text, ANSI codes, or binary data. Example: {data: 'line1\\nline2\\n'}. Modes are mutually exclusive.",
      inputSchema: WriteInputSchema.shape,
      outputSchema: WriteInputOutputSchema.shape,
    },
    handlers.write_input,
  );

  // activate_pty_tools: TODO
};
