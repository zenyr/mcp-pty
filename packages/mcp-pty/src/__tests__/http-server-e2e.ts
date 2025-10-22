#!/usr/bin/env bun
/**
 * HTTP server for E2E recovery test
 * Usage: bun run --cwd=packages/mcp-pty src/__tests__/http-server-e2e.ts [port]
 */

import { McpServerFactory } from "../server/index.js";
import { startHttpServer } from "../transports/index.js";

const port = parseInt(process.env.PORT ?? process.argv[2] ?? "6421", 10);

console.log(`[SERVER] Starting MCP PTY HTTP server on port ${port}...`);

const serverFactory = new McpServerFactory({
  name: "mcp-pty",
  version: "0.1.0",
});

startHttpServer(() => serverFactory.createServer(), port);

console.log(`[SERVER] ✓ Server running on http://localhost:${port}/mcp`);
console.log(`[SERVER] Ready for connections`);
