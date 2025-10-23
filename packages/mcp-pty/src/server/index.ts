import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  sessionManager as globalSessionManager,
  type SessionManager,
} from "@pkgs/session-manager";
import { registerPtyResources } from "../resources";
import { registerPtyTools } from "../tools";
import type { McpServerConfig } from "../types";
import {
  SESSION_ID_SYMBOL,
  SESSION_MANAGER_SYMBOL,
  type ServerWithContext,
} from "../utils/server-context";
import { registerResources, registerTools } from "./registrar";
import type { HandlerContext } from "./types";

/**
 * MCP server factory class
 * Responsible for server creation and configuration
 */
export class McpServerFactory {
  private config: McpServerConfig;

  constructor(config: McpServerConfig) {
    this.config = config;
  }

  /**
   * Create MCP server instance
   * @returns configured McpServer instance
   */
  public createServer(): McpServer {
    const server = new McpServer({
      name: this.config.name,
      version: this.config.version,
      capabilities: { resources: {}, tools: {} },
    });

    this.registerTools(server);

    if (!this.config.deactivateResources) {
      this.registerResources(server);
    }

    return server;
  }

  /**
   * Register tools
   * @param server McpServer instance
   */
  private registerTools(server: McpServer): void {
    // Tool registration logic from tools module
    registerPtyTools(server);
  }

  /**
   * Register resources
   * @param server McpServer instance
   */
  private registerResources(server: McpServer): void {
    // Resource registration logic from resources module
    registerPtyResources(server);
  }

  /**
   * Get bound session ID from server instance
   */
  private getBoundSessionId(server: McpServer): string {
    const serverWithContext = server as ServerWithContext;
    const sessionId = serverWithContext[SESSION_ID_SYMBOL];
    if (!sessionId) {
      throw new Error(
        "No session bound to server - transport initialization failed",
      );
    }
    return sessionId;
  }

  /**
   * Get SessionManager for server instance
   */
  private getSessionManager(server: McpServer): SessionManager {
    const serverWithContext = server as ServerWithContext;
    return serverWithContext[SESSION_MANAGER_SYMBOL] || globalSessionManager;
  }

  /**
   * Create handler context for the new registrar functions
   * This bridges the gap between old and new registration patterns
   */
  public createHandlerContext(server: McpServer): HandlerContext {
    return {
      server,
      sessionId: this.getBoundSessionId(server),
      sessionManager: this.getSessionManager(server),
    };
  }

  /**
   * Register tools using new structured handler pattern
   * @param server McpServer instance
   */
  public registerToolsWithNewPattern(server: McpServer): void {
    const context = this.createHandlerContext(server);
    registerTools(server, context);
  }

  /**
   * Register resources using new structured handler pattern
   * @param server McpServer instance
   */
  public registerResourcesWithNewPattern(server: McpServer): void {
    const context = this.createHandlerContext(server);
    registerResources(server, context);
  }
}

// Backward compatibility export
export const createServer = () => {
  const factory = new McpServerFactory({
    name: "mcp-pty",
    version: "0.1.0",
    deactivateResources: process.env.MCP_PTY_DEACTIVATE_RESOURCES === "true",
  });
  return factory.createServer();
};
