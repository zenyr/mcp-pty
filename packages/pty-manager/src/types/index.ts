/**
 * PTY Manager type definitions
 * Pure PTY management types without MCP protocol dependencies
 */

import { z } from "zod";

/**
 * PTY process status
 */
export type PtyStatus =
  | "initializing"
  | "active"
  | "idle"
  | "terminating"
  | "terminated";

/**
 * Terminal output interface
 */
export interface TerminalOutput {
  /** Process ID where output occurred */
  processId: string;
  /** Output content */
  output: string;
  /** Whether ANSI sequences are stripped */
  ansiStripped?: boolean;
  /** Output time */
  timestamp: Date;
}

/**
 * PtyProcess creation options interface
 */
export interface PtyOptions {
  /** Shell command to execute (e.g., "ls -la", "echo hello && pwd") */
  command: string;
  /** Working directory */
  cwd: string;
  /** Environment variable overrides */
  env?: Record<string, string>;
  /** Whether to auto-dispose on program exit (for interactive programs) */
  autoDisposeOnExit?: boolean;
  /** Whether to strip ANSI escape sequences from output */
  ansiStrip?: boolean;
}

/**
 * Terminal write response interface
 */
export interface TerminalWriteResponse {
  /** Current terminal screen content (visible rows) */
  screen: string;
  /** Cursor position */
  cursor: { x: number; y: number };
  /** Process exit code (null if still running) */
  exitCode: number | null;
}

/**
 * Terminal write input schema
 */
export const TerminalWriteInputSchema = z.object({
  /** Raw input data (supports text, multiline, ANSI codes like \x03 for Ctrl+C) */
  data: z
    .string()
    .describe(
      "Input data. Examples: 'ls\\n', 'hello\\nworld', '\\x03' (Ctrl+C), '안녕하세요 👋'",
    ),
  /** Wait time for output in milliseconds */
  waitMs: z
    .number()
    .int()
    .positive()
    .default(1000)
    .describe("Wait time for output (ms)"),
});

export type TerminalWriteInput = z.infer<typeof TerminalWriteInputSchema>;
