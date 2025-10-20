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
