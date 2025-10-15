import type { PtyOptions } from "../types";

/**
 * Detect if command requires shell execution
 * Returns true if command contains shell operators or features
 */
const requiresShell = (command: string): boolean => {
  const shellFeatures = [
    "&&",
    "||",
    ";", // Command chaining
    "|",
    "<",
    ">",
    ">>", // Pipes and redirects
    "$(", // Command substitution
    "`", // Backtick substitution
    "~", // Home directory expansion
    "*",
    "?",
    "[", // Glob patterns
    "{",
    "}", // Brace expansion
  ];

  return shellFeatures.some((feature) => command.includes(feature));
};

/**
 * Parse command string into PtyOptions or return existing options
 * Auto-detects shellMode based on command complexity
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

  // Check if command requires shell
  const needsShell = requiresShell(trimmed);

  if (needsShell) {
    // Execute full command via shell
    return { executable: trimmed, args: [], shellMode: true };
  }

  // Simple command: parse executable and args
  const parts = trimmed.split(/\s+/);
  if (parts.length === 0 || !parts[0]) {
    throw new Error("Invalid command string: no executable found");
  }
  const executable = parts[0];
  const args = parts.length > 1 ? parts.slice(1) : [];

  return { executable, args, shellMode: false };
};
