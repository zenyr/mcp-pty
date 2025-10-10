import { test, expect } from "bun:test";
import { createServer } from "../index";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

test("MCP server factory creates server", () => {
  const server = createServer();
  expect(server).toBeDefined();
  expect(server).toBeInstanceOf(McpServer);
});
