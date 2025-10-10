#!/usr/bin/env bun
import { McpServerFactory } from "./server";
import { startHttpServer, startStdioServer } from "./transports";
import {
  initializeServer,
  parseTransportType,
  setupGracefulShutdown,
} from "./utils";

// Parse command line arguments
const transportType = parseTransportType(process.argv);

// Start session monitoring
initializeServer();

// Graceful shutdown
setupGracefulShutdown();

// Initialize MCP server factory
const serverFactory = new McpServerFactory({
  name: "mcp-pty",
  version: "0.1.0",
  deactivateResources: process.env.MCP_PTY_DEACTIVATE_RESOURCES === "true",
});

const server = serverFactory.createServer();

// Start server based on transport type
if (transportType === "http") {
  startHttpServer(server);
} else {
  startStdioServer(server);
}
