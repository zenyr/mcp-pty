const parse = require("bash-parser");

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

    // Check if the command requires shell execution based on AST + string fallback
    const requiresShell =
      requiresShellExecution(ast) || /(&&|\|\||\|;|>|<|<<|>>)/.test(trimmed);

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
    // If parsing fails, assume it needs shell
    console.log("parse error for:", trimmed, error);
    return JSON.stringify({ command: "sh", args: ["-c", trimmed] });
  }

  // Fallback
  return JSON.stringify({ command: "", args: [] });
};

const requiresShellExecution = (node: any): boolean => {
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
      if (cmd.type === "Pipeline" || cmd.type === "LogicalExpression") {
        return true;
      }
      // Check suffix for redirects
      if (cmd.suffix) {
        for (const s of cmd.suffix) {
          if (s.type === "Redirect") {
            return true;
          }
        }
      }
    }
  }

  return false;
};

const extractCommandInfo = (
  node: any,
): { command: string; args: string[] } | null => {
  // For Script, get first command
  if (node.type === "Script" && node.commands && node.commands.length > 0) {
    const cmd = node.commands[0];
    if (cmd.type === "Command") {
      const commandName = cmd.name ? cmd.name.text : "";
      const args = cmd.suffix
        ? cmd.suffix
            .filter((s: any) => s.type === "Word")
            .map((s: any) => s.text)
        : [];
      return { command: commandName, args };
    }
  }
  return null;
};
