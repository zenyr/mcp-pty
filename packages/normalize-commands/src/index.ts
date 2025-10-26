import parse from "bash-parser";

import type { BashNode, CommandInfo } from "./types";
import { checkDangerousPatterns, isDangerousRedirect } from "./patterns";

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
 * Validate command using AST analysis
 * @throws {Error} if dangerous command detected
 */
const validateCommandAST = (node: BashNode): void => {
  const validateNode = (n: BashNode): void => {
    if (n.type === "Command") {
      const cmdName = getCommandName(n);
      const args = getCommandArgs(n);

      if (!cmdName) return;

      // Check dangerous patterns
      const baseName = cmdName.split("/").pop() ?? "";
      checkDangerousPatterns(baseName, args);

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

const extractCommandInfo = (node: BashNode): CommandInfo | null => {
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
