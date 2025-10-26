/**
 * Type definitions for normalize-commands package
 */

/**
 * Basic AST node types for bash-parser
 */
export interface BashNode {
  type: string;
  commands?: BashNode[];
  prefix?: BashNode[];
  suffix?: BashNode[];
  name?: BashNode;
  text?: string;
  redirect?: BashNode[];
  file?: BashNode;
  op?: string;
  left?: BashNode;
  right?: BashNode;
}

/**
 * Danger pattern definition for security checks
 */
export interface DangerPattern {
  check: (cmdName: string, args: string[]) => boolean;
  message: (cmdName: string) => string;
}

/**
 * Extracted command information
 */
export interface CommandInfo {
  command: string;
  args: string[];
}
