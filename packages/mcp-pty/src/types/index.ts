import { z } from "zod";

// Re-export control codes
export * from "./control-codes";

/**
 * MCP server configuration interface
 */
export interface McpServerConfig {
  name: string;
  version: string;
  deactivateResources?: boolean;
}

/**
 * PTY tool input schemas
 * sessionId is optional - automatically resolved from transport connection
 */
export const StartPtyInputSchema = z.object({
  command: z
    .string()
    .describe(
      "Command to execute in PTY. Supports: (1) Interactive shells: 'bash', 'zsh', 'python3', 'node', 'irb'. (2) Long-running processes: 'npm run dev', 'bun dev', 'cargo run'. (3) TUI applications: 'vim file.txt', 'htop', 'less file.log'. (4) Shell commands: 'ls -la', 'git status', 'cat file.txt'. Arguments included in command string. Executed via shell ($SHELL or /bin/sh).",
    ),
  pwd: z
    .string()
    .describe(
      "Working directory for the PTY process. Must be an absolute path (e.g., /home/user/project) or start with tilde (e.g., ~/project). Relative paths (., .., ./foo) are not allowed.",
    ),
});

export const KillPtyInputSchema = z.object({ processId: z.string() });

export const ListPtyInputSchema = z.object({});

export const ReadPtyInputSchema = z.object({ processId: z.string() });

export const WriteInputSchema = z.object({
  processId: z.string(),

  // Plain text input (no escape sequences - literal text only)
  input: z
    .string()
    .optional()
    .describe(
      "Plain text input without escape sequences. Use this for typing regular text. Examples: 'hello', 'print(2+2)', 'cd /tmp'. DO NOT include \\n or \\t here - use ctrlCode instead.",
    ),

  // Control codes (named or raw bytes)
  ctrlCode: z
    .string()
    .optional()
    .describe(
      "Control code to send after input. Supports named codes (e.g., 'Enter', 'Escape', 'Ctrl+C') or raw sequences (e.g., '\\n', '\\x1b', '\\x03'). Named codes: Enter, Escape, Tab, Ctrl+A-Z, ArrowUp/Down/Left/Right, etc. This is sent AFTER input field.",
    ),

  // Raw data field (for advanced use cases)
  data: z
    .string()
    .optional()
    .describe(
      "Raw input data with escape sequences. Use this for: (1) multiline text with actual newlines, (2) ANSI escape codes in text, (3) binary data. Takes precedence over input+ctrlCode. Examples: 'cat << EOF\\nhello\\nEOF\\n', '\\x1b[31mRED\\x1b[0m', 'print(1)\\nprint(2)\\n'.",
    ),

  waitMs: z
    .number()
    .int()
    .positive()
    .default(1000)
    .describe("Wait time for output (ms)"),
});

/**
 * PTY tool output schemas
 */
export const StartPtyOutputSchema = z.object({
  processId: z
    .string()
    .describe(
      "Unique process identifier. Use this ID for subsequent operations: write_input (send input), read (get output), kill (terminate).",
    ),
  screen: z
    .string()
    .describe(
      "Initial terminal screen content after command start. May include welcome messages, prompts, or command output. Empty for background processes.",
    ),
  exitCode: z
    .number()
    .nullable()
    .describe(
      "Process exit code. null = still running (interactive shells, servers, TUI apps). non-null = already terminated (quick commands like 'ls'). 0 = success, non-zero = error.",
    ),
});

export const KillPtyOutputSchema = z.object({ success: z.boolean() });

export const PtyInfoSchema = z.object({
  id: z.string(),
  status: z.string(),
  createdAt: z.string(),
  lastActivity: z.string(),
  exitCode: z.number().nullable(),
});

export const ListPtyOutputSchema = z.object({ ptys: z.array(PtyInfoSchema) });

export const ReadPtyOutputSchema = z.object({
  screen: z.string().describe("Current terminal screen content (ANSI-parsed)"),
});

export const WriteInputOutputSchema = z.object({
  screen: z.string().describe("Current terminal screen content (visible rows)"),
  cursor: z
    .object({ x: z.number(), y: z.number() })
    .describe("Cursor position"),
  exitCode: z
    .number()
    .nullable()
    .describe("Process exit code (null if still running)"),
  warning: z
    .string()
    .optional()
    .describe("Warning message for edge cases (e.g., empty input)"),
});

/**
 * Transport type
 */
export type TransportType = "stdio" | "http";

/**
 * Server status
 */
export interface ServerStatus {
  sessions: number;
  processes: number;
}

/**
 * Session status
 */
export interface SessionStatus {
  id: string;
  status: "active" | "terminated";
}
