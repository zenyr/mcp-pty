const parse = require("bash-parser");

// Basic AST node types for bash-parser
interface BashNode {
  type: string;
  commands?: BashNode[];
  prefix?: BashNode[];
  suffix?: BashNode[];
  name?: BashNode;
  text?: string;
  redirect?: BashNode[];
}

import { PRIVILEGE_ESCALATION_COMMANDS } from "./constants";

/**
 * Check if command is a dangerous mkfs variant
 */
const isDangerousMkfsCommand = (cmdName: string): boolean => {
  return cmdName === "mkfs" || cmdName.startsWith("mkfs.");
};

/**
 * Extract command name from AST node
 */
const getCommandName = (node: BashNode): string | null => {
  if (node.type === "Command" && node.name) {
    if (typeof node.name === "object" && node.name.text) {
      return node.name.text;
    }
  }
  return null;
};

/**
 * Extract all arguments from AST node
 */
const getCommandArgs = (node: BashNode): string[] => {
  if (node.type === "Command" && node.suffix) {
    return node.suffix
      .filter((s) => s && s.type === "Word")
      .map((s) => s.text || "");
  }
  return [];
};

/**
 * Check if redirect target is a dangerous device
 */
const isDangerousRedirect = (node: BashNode): boolean => {
  // Check suffix for Redirect nodes
  if (node.suffix) {
    for (const s of node.suffix) {
      if (s && s.type === "Redirect") {
        const target = (s as { file?: BashNode }).file;
        if (target && target.text) {
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

/**
 * Validate command using AST analysis
 * @throws {Error} if dangerous command detected
 */
const validateCommandAST = (node: BashNode): void => {
  const validateNode = (n: BashNode): void => {
    if (n.type === "Command") {
      const cmdName = getCommandName(n);
      const args = getCommandArgs(n);

      if (!cmdName) return;

      // Check privilege escalation
      const baseName = cmdName.split("/").pop() ?? "";
      if (PRIVILEGE_ESCALATION_COMMANDS.includes(baseName as never)) {
        throw new Error(
          `Privilege escalation command detected: ${baseName}. Set MCP_PTY_USER_CONSENT_FOR_DANGEROUS_ACTIONS to bypass.`,
        );
      }

      // Check dangerous mkfs commands
      if (isDangerousMkfsCommand(baseName)) {
        throw new Error(
          `Dangerous command detected: ${baseName}. Set MCP_PTY_USER_CONSENT_FOR_DANGEROUS_ACTIONS to bypass.`,
        );
      }

      // Check rm -rf /
      if (cmdName === "rm") {
        const hasRf = args.includes("-rf") || args.includes("-fr");
        const hasRoot = args.includes("/");
        if (hasRf && hasRoot) {
          throw new Error(
            `Dangerous command pattern detected: rm -rf /. Set MCP_PTY_USER_CONSENT_FOR_DANGEROUS_ACTIONS to bypass.`,
          );
        }
      }

      // Check chmod 777
      if (cmdName === "chmod") {
        if (args.some((arg) => arg.includes("777"))) {
          throw new Error(
            `Dangerous command pattern detected: chmod 777. Set MCP_PTY_USER_CONSENT_FOR_DANGEROUS_ACTIONS to bypass.`,
          );
        }
      }

      // Check dd to block device
      if (cmdName === "dd") {
        const hasBlockDeviceOutput = args.some((arg) =>
          /^of=\/dev\/sd[a-z]/.test(arg),
        );
        if (hasBlockDeviceOutput) {
          throw new Error(
            `Dangerous command pattern detected: dd to block device. Set MCP_PTY_USER_CONSENT_FOR_DANGEROUS_ACTIONS to bypass.`,
          );
        }
      }

      // Check dangerous redirects
      if (isDangerousRedirect(n)) {
        throw new Error(
          `Dangerous redirect to block device detected. Set MCP_PTY_USER_CONSENT_FOR_DANGEROUS_ACTIONS to bypass.`,
        );
      }
    }

    // Recursively check child commands
    if (n.commands) {
      for (const cmd of n.commands) {
        if (cmd) validateNode(cmd);
      }
    }
  };

  validateNode(node);
};

/**
 * Normalizes a command string into a JSON string representing the command and arguments.
 * Uses bash-parser to accurately parse bash syntax and determine if shell execution is required.
 * @param input - The command string to normalize
 * @returns JSON string with {command: string, args: string[]}
 */
export const normalizeCommand = (input: string): string => {
  const trimmed = input.trim();
  if (trimmed === "") {
    return JSON.stringify({ command: "", args: [] });
  }

  try {
    const ast = parse(trimmed);

    // Validate using AST
    validateCommandAST(ast);

    // Check if the command requires shell execution based on AST + string fallback
    const requiresShell =
      requiresShellExecution(ast) || /(&&|\|\||\||;|>|<|<<|>>)/.test(trimmed);

    if (requiresShell) {
      return JSON.stringify({ command: "sh", args: ["-c", trimmed] });
    } else {
      // Extract command and args from single command AST
      const commandInfo = extractCommandInfo(ast);
      if (commandInfo) {
        return JSON.stringify(commandInfo);
      }
    }
  } catch (error) {
    // If parsing fails, try basic validation on raw string
    if (error instanceof Error && error.message.includes("detected")) {
      throw error; // Re-throw validation errors
    }
    console.log("parse error for:", trimmed, error);
    return JSON.stringify({ command: "sh", args: ["-c", trimmed] });
  }

  // Fallback
  return JSON.stringify({ command: "", args: [] });
};

const requiresShellExecution = (node: BashNode): boolean => {
  // Check if it's a pipeline or logical expression
  if (node.type === "Pipeline" || node.type === "LogicalExpression") {
    return true;
  }

  // Check if multiple commands (e.g., semicolon separated)
  if (node.commands && node.commands.length > 1) {
    return true;
  }

  // Check commands for redirects or other shell features
  if (node.commands) {
    for (const cmd of node.commands) {
      if (!cmd) continue;
      if (cmd.type === "Pipeline" || cmd.type === "LogicalExpression") {
        return true;
      }
      // Check for environment variable assignments (prefix)
      if (cmd.prefix && cmd.prefix.length > 0) {
        return true;
      }
      // Check suffix for redirects
      if (cmd.suffix) {
        for (const s of cmd.suffix) {
          if (s && s.type === "Redirect") {
            return true;
          }
        }
      }
    }
  }

  return false;
};

const extractCommandInfo = (
  node: BashNode,
): { command: string; args: string[] } | null => {
  // For Script, get first command
  if (node.type === "Script" && node.commands && node.commands.length > 0) {
    const cmd = node.commands[0];
    if (cmd && cmd.type === "Command") {
      // If there are environment variable assignments (prefix), require shell
      if (cmd.prefix && cmd.prefix.length > 0) {
        return null;
      }
      const commandName =
        cmd.name && typeof cmd.name === "object" && cmd.name.text
          ? cmd.name.text
          : "";
      const args = cmd.suffix
        ? cmd.suffix
            .filter((s) => s && s.type === "Word")
            .map((s) => s.text || "")
        : [];
      return { command: commandName, args };
    }
  }
  return null;
};
