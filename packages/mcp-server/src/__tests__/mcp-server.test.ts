import { expect, test } from "bun:test";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createServer } from "../server";

test("MCP server factory creates server", () => {
  const server = createServer();
  expect(server).toBeDefined();
  expect(server).toBeInstanceOf(McpServer);
});
