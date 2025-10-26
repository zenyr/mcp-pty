/**
 * Type definitions for normalize-commands package
 */

import type parse from "bash-parser";

/**
 * Re-export BashNode from bash-parser patch
 */
export type BashNode = ReturnType<typeof parse>;

/**
 * Danger pattern definition for security checks
 */
export interface DangerPattern {
  check: (cmdName: string, args: string[]) => boolean;
  message: string | ((cmdName: string) => string);
}

/**
 * Extracted command information
 */
export interface CommandInfo {
  command: string;
  args: string[];
}
