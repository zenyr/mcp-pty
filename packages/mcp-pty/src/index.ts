#!/usr/bin/env bun
import { consola } from "consola";
import { McpServerFactory } from "./server";
import { startHttpServer, startStdioServer } from "./transports";
import {
  initializeServer,
  loadConfig,
  parseCliArgs,
  setupGracefulShutdown,
} from "./utils";

// Load configuration (XDG config → env fallback)
const config = await loadConfig();

// Parse command line arguments (CLI args override config)
const { transport, port } = parseCliArgs();

// Start server based on transport type (CLI args > config > default)
const finalTransport = transport ?? config.transport ?? "stdio";
const finalPort = port ?? config.port ?? 6420;

// Configure consola for stdio transport (suppress stdout logs)
if (finalTransport === "stdio") {
  consola.level = 0;
}

// Start session monitoring
initializeServer();

// Graceful shutdown
setupGracefulShutdown();

// Initialize MCP server factory
const serverFactory = new McpServerFactory({
  name: "mcp-pty",
  version: "0.1.0",
  deactivateResources:
    config.deactivateResources ??
    process.env.MCP_PTY_DEACTIVATE_RESOURCES === "true",
});

if (finalTransport === "http") {
  await startHttpServer(() => serverFactory.createServer(), finalPort);
} else {
  const server = serverFactory.createServer();
  await startStdioServer(server);
}
