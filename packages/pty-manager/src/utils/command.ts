import type { PtyOptions } from "../types";

/**
 * Parse command string into PtyOptions or return existing options
 */
export const parseCommand = (
  commandOrOptions: string | PtyOptions,
): PtyOptions => {
  if (typeof commandOrOptions !== "string") {
    return commandOrOptions;
  }

  const trimmed = commandOrOptions.trim();
  if (!trimmed) {
    throw new Error("Command string cannot be empty");
  }

  return { command: trimmed };
};
