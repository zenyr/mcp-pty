import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SessionManager } from "@pkgs/session-manager";

/**
 * Handler execution context
 * Provided to all tool and resource handlers
 */
export interface HandlerContext {
  /** MCP Server instance */
  server: McpServer;
  /** Session ID for this connection */
  sessionId: string;
  /** Session manager instance */
  sessionManager: SessionManager;
}

/**
 * Tool result - matches SDK's CallToolResult structure
 */
export interface ToolResult {
  content: Array<{ type: "text"; text: string }>;
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
}

/**
 * Resource content - matches SDK's ReadResourceResult
 * Index signature required by SDK type compatibility
 */
export interface ResourceResult extends Record<string, unknown> {
  contents: Array<{ uri: string; text: string; mimeType?: string }>;
}

/**
 * Fixed URI resource handler
 */
export type FixedResourceHandler = (
  uri: URL,
  context: HandlerContext,
) => ResourceResult | Promise<ResourceResult>;

/**
 * Template URI resource handler
 */
export type TemplateResourceHandler = (
  uri: URL,
  variables: Record<string, string | string[]>,
  context: HandlerContext,
) => ResourceResult | Promise<ResourceResult>;
