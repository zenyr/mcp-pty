#!/usr/bin/env bun
import { startHttpServer } from "../packages/mcp-pty/src/transports";
import { McpServerFactory } from "../packages/mcp-pty/src/server";

const serverFactory = new McpServerFactory({
  name: "mcp-pty",
  version: "0.1.0",
});

startHttpServer(() => serverFactory.createServer(), 6420);
console.log("MCP PTY HTTP server running on port 6420");
