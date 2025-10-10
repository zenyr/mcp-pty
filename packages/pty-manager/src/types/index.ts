import type { Terminal } from "@xterm/headless";
import type { IPty } from "bun-pty";

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

export interface PtyInstance {
  /** Unique process ID (nanoid-based) */
  id: string;
  /** Current status */
  status: PtyStatus;
  /** xterm headless terminal instance */
  terminal: Terminal;
  /** bun-pty process instance */
  process: IPty;
  /** Creation time */
  createdAt: Date;
  /** Last activity time */
  lastActivity: Date;
}

/**
 * PTY session interface
 * Manages all PTY instances belonging to one session
 */
export interface PtySession {
  /** Unique session ID (ULID, passed from session-manager) */
  sessionId: string;
  /** processId -> PtyInstance mapping */
  instances: Map<string, PtyInstance>;
  /** Session creation time */
  createdAt: Date;
}

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
  /** Program to execute (e.g., "vi", "bash") */
  executable: string;
  /** Arguments to pass to program */
  args?: string[];
  /** Working directory */
  cwd?: string;
  /** Environment variable overrides */
  env?: Record<string, string>;
  /** Whether to auto-dispose on program exit (for interactive programs) */
  autoDisposeOnExit?: boolean;
}
