import { z } from "zod";

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
  command: z.string(),
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
  data: z
    .string()
    .describe(
      "Input data. Examples: 'ls\\n', 'hello\\nworld', '\\x03' (Ctrl+C), '안녕하세요 👋'. NOTE: Use actual escape sequences like '\\x03' (single byte 0x03), NOT literal strings like '\\\\x03' (6 characters)",
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
  processId: z.string(),
  screen: z.string().describe("Initial terminal screen content"),
  exitCode: z
    .number()
    .nullable()
    .describe(
      "Process exit code (null if still running, non-null if already terminated)",
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
