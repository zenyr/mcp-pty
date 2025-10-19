const parse = require("bash-parser");

// Basic AST node types for bash-parser
interface BashNode {
  type: string;
  commands?: BashNode[];
  prefix?: BashNode[];
  suffix?: BashNode[];
  name?: BashNode;
  text?: string;
}

/**
 * Dangerous command patterns that require explicit user consent
 */
const DANGEROUS_PATTERNS = [
  /\brm\s+-rf\s+\//, // rm -rf /
  /\bchmod\s+777/, // chmod 777
  /\bdd\s+if=.*of=\/dev\//, // dd to block devices
  /:\(\)\{.*:\|:&\};:/, // Fork bomb
  /\bmkfs\./, // Format filesystem
  />\s*\/dev\/sd[a-z]/, // Write to block device
];

/**
 * Privilege escalation commands
 */
const PRIVILEGE_ESCALATION = [
  "sudo",
  "doas",
  "pkexec",
  "su",
  "run0",
  "dzdo",
];

/**
 * Validate shell command for dangerous patterns
 * @throws {Error} if dangerous pattern detected without consent
 */
const validateShellCommand = (command: string): void => {
  // Check for dangerous patterns
  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(command)) {
      throw new Error(
        `Dangerous command pattern detected: ${pattern.source}. Set MCP_PTY_USER_CONSENT_FOR_DANGEROUS_ACTIONS to bypass.`,
      );
    }
  }

  // Check for privilege escalation
  const tokens = command.trim().split(/\s+/);
  const executable = tokens[0];
  if (executable && PRIVILEGE_ESCALATION.includes(executable)) {
    throw new Error(
      `Privilege escalation command detected: ${executable}. Set MCP_PTY_USER_CONSENT_FOR_DANGEROUS_ACTIONS to bypass.`,
    );
  }
};

/**
 * Validate executable name for privilege escalation
 * @throws {Error} if privilege escalation detected
 */
const validateExecutableName = (executable: string): void => {
  const baseName = executable.split("/").pop() ?? "";
  if (PRIVILEGE_ESCALATION.includes(baseName)) {
    throw new Error(
      `Privilege escalation command detected: ${baseName}. Set MCP_PTY_USER_CONSENT_FOR_DANGEROUS_ACTIONS to bypass.`,
    );
  }
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

    // Check if the command requires shell execution based on AST + string fallback
    const requiresShell =
      requiresShellExecution(ast) || /(&&|\|\||\||;|>|<|<<|>>)/.test(trimmed);

    if (requiresShell) {
      // Validate shell command for dangerous patterns
      validateShellCommand(trimmed);
      return JSON.stringify({ command: "sh", args: ["-c", trimmed] });
    } else {
      // Extract command and args from single command AST
      const commandInfo = extractCommandInfo(ast);
      if (commandInfo) {
        // Validate executable name
        validateExecutableName(commandInfo.command);
        return JSON.stringify(commandInfo);
      }
    }
  } catch (error) {
    // If parsing fails, validate and assume it needs shell
    console.log("parse error for:", trimmed, error);
    validateShellCommand(trimmed);
    return JSON.stringify({ command: "sh", args: ["-c", trimmed] });
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
