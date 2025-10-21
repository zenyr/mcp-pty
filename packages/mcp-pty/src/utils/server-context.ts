import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SessionManager } from "@pkgs/session-manager";

/**
 * Session context symbol for binding session ID to server
 */
export const SESSION_ID_SYMBOL = Symbol("mcp-pty:sessionId");

/**
 * SessionManager context symbol for injecting test SessionManager
 */
export const SESSION_MANAGER_SYMBOL = Symbol("mcp-pty:sessionManager");

/**
 * Type-safe server extension for session context
 */
export type ServerWithContext = McpServer & {
  [SESSION_ID_SYMBOL]?: string;
  [SESSION_MANAGER_SYMBOL]?: SessionManager;
};
