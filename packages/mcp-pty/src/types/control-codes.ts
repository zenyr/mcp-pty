/**
 * Control code definitions for PTY input
 * Maps user-friendly names to actual byte sequences
 *
 * Strategy: Support most common use cases (80/20 rule)
 * - REPL interactions: Enter, Ctrl+C, Ctrl+D
 * - Text editors: Escape, Arrow keys
 * - Shell navigation: Tab, Ctrl+A/E/U/W
 *
 * Fallback: Raw sequences for advanced cases
 */

/**
 * Common control codes with user-friendly names
 */
export const CONTROL_CODES = {
  // Most common: REPL & shell
  Enter: "\n",
  "Ctrl+C": "\x03", // Interrupt
  "Ctrl+D": "\x04", // EOF
  Tab: "\t",

  // Text editors (vim/nano/emacs)
  Escape: "\x1b",
  "Ctrl+[": "\x1b", // Alternative ESC

  // Shell editing
  "Ctrl+A": "\x01", // Beginning of line
  "Ctrl+E": "\x05", // End of line
  "Ctrl+U": "\x15", // Clear line before cursor
  "Ctrl+K": "\x0b", // Clear line after cursor
  "Ctrl+W": "\x17", // Delete word
  "Ctrl+L": "\x0c", // Clear screen

  // Arrow keys
  ArrowUp: "\x1b[A",
  ArrowDown: "\x1b[B",
  ArrowRight: "\x1b[C",
  ArrowLeft: "\x1b[D",

  // Less common but useful
  Backspace: "\x7f",
  "Ctrl+Z": "\x1a", // Suspend
  "Ctrl+R": "\x12", // Reverse search

  // Aliases for clarity
  Return: "\r",
  EOF: "\x04", // Same as Ctrl+D
  EOT: "\x04", // End of transmission
  Interrupt: "\x03", // Same as Ctrl+C
} as const;

/**
 * Valid control code names
 */
export type ControlCodeName = keyof typeof CONTROL_CODES;

/**
 * Check if string is a valid control code name
 */
export const isControlCodeName = (value: string): value is ControlCodeName => {
  return value in CONTROL_CODES;
};

/**
 * Resolve control code to actual byte sequence
 * @param code - Control code name or raw byte sequence
 * @returns Actual byte sequence to send to PTY
 * @throws {Error} if code is invalid format
 */
export const resolveControlCode = (code: string): string => {
  // If it's a known control code name, resolve it
  if (isControlCodeName(code)) {
    return CONTROL_CODES[code];
  }

  // Allow raw escape sequences for advanced use cases
  // Valid formats: \n, \r, \t, \x03, \x1b, etc.
  // These are already JavaScript strings with actual bytes
  // Just validate they're reasonable (1-4 bytes for control sequences)
  if (code.length <= 4) {
    return code;
  }

  throw new Error(
    `Invalid control code: "${code}". Use named codes (Enter, Escape, Ctrl+C) or raw sequences (\\n, \\x1b). Available codes: ${getAvailableControlCodes().join(", ")}`,
  );
};

/**
 * Get list of all available control codes
 */
export const getAvailableControlCodes = (): ControlCodeName[] => {
  return Object.keys(CONTROL_CODES) as ControlCodeName[];
};

/**
 * Descriptions for control codes (for LLM guidance)
 */
export const CONTROL_CODE_DESCRIPTIONS: Record<ControlCodeName, string> = {
  Enter: "Execute command / send newline. Most common in REPL & shell",
  "Ctrl+C": "Interrupt running process (SIGINT). Stop long-running commands",
  "Ctrl+D": "End of file / logout. Exit shells, REPL, or input mode",
  Tab: "Auto-completion in shell. Suggest filenames or commands",
  Escape: "Exit insert mode in vim/nano. Switch to normal/command mode",
  "Ctrl+[": "Alternative to Escape. Same as Escape key",
  "Ctrl+A": "Move cursor to beginning of line in shell",
  "Ctrl+E": "Move cursor to end of line in shell",
  "Ctrl+U": "Delete all text before cursor (clear line start)",
  "Ctrl+K": "Delete all text after cursor (clear line end)",
  "Ctrl+W": "Delete previous word in shell",
  "Ctrl+L": "Clear entire screen / redraw terminal",
  ArrowUp: "Previous command in shell history. Also move up in vim",
  ArrowDown: "Next command in shell history. Also move down in vim",
  ArrowRight: "Move cursor right in shell or vim",
  ArrowLeft: "Move cursor left in shell or vim",
  Backspace: "Delete character before cursor",
  "Ctrl+Z": "Suspend process (SIGTSTP). Put fg job in background",
  "Ctrl+R": "Reverse search in bash history",
  Return: "Carriage return (CR). Used in raw mode for line endings",
  EOF: "Alias for Ctrl+D (end of file)",
  EOT: "Alias for Ctrl+D (end of transmission)",
  Interrupt: "Alias for Ctrl+C (interrupt process)",
} as const;

/**
 * Example use cases for control codes
 */
export const CONTROL_CODE_EXAMPLES: Record<ControlCodeName, string> = {
  Enter: "Execute command: {input: 'ls', ctrlCode: 'Enter'}",
  "Ctrl+C": "Stop hanging process: {ctrlCode: 'Ctrl+C'}",
  "Ctrl+D": "Exit Python REPL: {ctrlCode: 'Ctrl+D'}",
  Tab: "Complete filename: {input: 'cd /h', ctrlCode: 'Tab'}",
  Escape: "Exit vim insert: {ctrlCode: 'Escape'} then {data: ':wq\\n'}",
  "Ctrl+[": "Same as Escape in vim",
  "Ctrl+A": "Go to line start: {ctrlCode: 'Ctrl+A'}",
  "Ctrl+E": "Go to line end: {ctrlCode: 'Ctrl+E'}",
  "Ctrl+U": "Clear command: {ctrlCode: 'Ctrl+U'} after typing wrong cmd",
  "Ctrl+K": "Delete to end: {ctrlCode: 'Ctrl+K'}",
  "Ctrl+W": "Delete word: {ctrlCode: 'Ctrl+W'}",
  "Ctrl+L": "Refresh screen: {ctrlCode: 'Ctrl+L'}",
  ArrowUp: "Previous cmd: {ctrlCode: 'ArrowUp'} then {ctrlCode: 'Enter'}",
  ArrowDown: "Next cmd: {ctrlCode: 'ArrowDown'}",
  ArrowRight: "Move cursor: {ctrlCode: 'ArrowRight'}",
  ArrowLeft: "Move cursor: {ctrlCode: 'ArrowLeft'}",
  Backspace: "Erase char: {ctrlCode: 'Backspace'}",
  "Ctrl+Z": "Suspend job: {ctrlCode: 'Ctrl+Z'}, resume with 'fg'",
  "Ctrl+R": "Search history: {ctrlCode: 'Ctrl+R'} in bash",
  Return: "Raw CR in data mode: {data: 'text\\r\\n'}",
  EOF: "Same as Ctrl+D",
  EOT: "Same as Ctrl+D",
  Interrupt: "Same as Ctrl+C",
} as const;
