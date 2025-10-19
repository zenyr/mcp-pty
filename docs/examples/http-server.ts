#!/usr/bin/env bun
import { McpServerFactory } from "mcp-pty/server";
import { startHttpServer } from "mcp-pty/transports";

const port = parseInt(process.env.PORT ?? "6420", 10);

const serverFactory = new McpServerFactory({
  name: "mcp-pty",
  version: "0.1.0",
});

startHttpServer(() => serverFactory.createServer(), port);
console.log(`MCP PTY HTTP server running on port ${port}`);
