import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerPtyResources } from "../resources";
import { registerPtyTools } from "../tools";
import type { McpServerConfig } from "../types";

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

    if (this.config.deactivateResources) {
      this.registerTools(server);
    }

    this.registerResources(server);

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
