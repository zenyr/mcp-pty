import type { PtyOptions } from "../types";

/**
 * Parse command string into PtyOptions or return existing options
 * Handles "{executable} {...args}" pattern for strings
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

  // Simple parsing: split by spaces, first part is executable, rest are args
  // TODO: Handle quoted arguments properly
  const parts = trimmed.split(/\s+/);
  if (parts.length === 0 || !parts[0]) {
    throw new Error("Invalid command string: no executable found");
  }
  const executable = parts[0];
  const args = parts.length > 1 ? parts.slice(1) : [];

  return { executable, args, shellMode: true };
};
