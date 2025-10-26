import { PRIVILEGE_ESCALATION_COMMANDS } from "./constants";
import type { BashNode, DangerPattern } from "./types";

/**
 * Check if command is a dangerous mkfs variant
 */
const isDangerousMkfsCommand = (cmdName: string): boolean => {
  return cmdName === "mkfs" || cmdName.startsWith("mkfs.");
};

/**
 * Danger patterns grouped by category
 */
export const DANGER_PATTERNS: DangerPattern[] = [
  // Privilege escalation commands
  {
    check: (cmdName) =>
      PRIVILEGE_ESCALATION_COMMANDS.includes(cmdName as never),
    message: (cmdName) => `Privilege escalation command detected: ${cmdName}`,
  },
  // Dangerous filesystem commands
  {
    check: (cmdName) => isDangerousMkfsCommand(cmdName),
    message: (cmdName) => `Dangerous command detected: ${cmdName}`,
  },
  // rm -rf / pattern
  {
    check: (cmdName, args) =>
      cmdName === "rm" && args.includes("-rf") && args.includes("/"),
    message: "Dangerous command pattern detected: rm -rf /",
  },
  // chmod 777 pattern
  {
    check: (cmdName, args) =>
      cmdName === "chmod" && args.some((arg) => arg.includes("777")),
    message: "Dangerous command pattern detected: chmod 777",
  },
  // dd to block device pattern
  {
    check: (cmdName, args) =>
      cmdName === "dd" && args.some((arg) => /^of=\/dev\/sd[a-z]/.test(arg)),
    message: "Dangerous command pattern detected: dd to block device",
  },
  // chmod 777 pattern
  {
    check: (cmdName, args) =>
      cmdName === "chmod" && args.some((arg) => arg.includes("777")),
    message: "Dangerous command pattern detected: chmod 777",
  },
  // dd to block device pattern
  {
    check: (cmdName, args) =>
      cmdName === "dd" && args.some((arg) => /^of=\/dev\/sd[a-z]/.test(arg)),
    message: "Dangerous command pattern detected: dd to block device",
  },
];

/**
 * Check dangerous patterns and throw if found
 */
export const checkDangerousPatterns = (
  cmdName: string,
  args: string[],
): void => {
  for (const pattern of DANGER_PATTERNS) {
    if (pattern.check(cmdName, args)) {
      const message =
        typeof pattern.message === "function"
          ? pattern.message(cmdName)
          : pattern.message;
      throw new Error(
        `${message}. Set MCP_PTY_USER_CONSENT_FOR_DANGEROUS_ACTIONS to bypass.`,
      );
    }
  }
};

/**
 * Check if redirect target is a dangerous device
 */
export const isDangerousRedirect = (node: BashNode): boolean => {
  // Check suffix for Redirect nodes
  if (node.suffix) {
    for (const s of node.suffix) {
      if (s && s.type === "Redirect") {
        const target = (s as { file?: BashNode }).file;
        if (target?.text) {
          // Block writes to block devices
          if (/^\/dev\/sd[a-z]/.test(target.text)) {
            return true;
          }
        }
      }
    }
  }
  return false;
};
