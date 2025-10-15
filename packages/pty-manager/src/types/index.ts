/**
 * PTY Manager type definitions
 * Pure PTY management types without MCP protocol dependencies
 */

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
  cwd?: string;
  /** Environment variable overrides */
  env?: Record<string, string>;
  /** Whether to auto-dispose on program exit (for interactive programs) */
  autoDisposeOnExit?: boolean;
  /** Whether to strip ANSI escape sequences from output */
  ansiStrip?: boolean;
}
