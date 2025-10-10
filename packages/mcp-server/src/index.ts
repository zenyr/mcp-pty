#!/usr/bin/env bun
import { Hono } from "hono";
import { toReqRes } from "fetch-to-node";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

// Parse command line arguments
const transportType = process.argv[2] === "http" ? "http" : "stdio";

// Initialize MCP server factory
const createServer = () =>
  new McpServer({
    name: "mcp-pty",
    version: "0.1.0",
    capabilities: {
      resources: {}, // TODO: Implement resources
      tools: {}, // TODO: Implement tools
    },
  });

const startStdioServer = async () => {
  const server = createServer();
  try {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.log("MCP PTY server started via stdio");
  } catch (error) {
    console.error("Error initializing MCP server:", error);
    process.exit(1);
  }
};

const startHttpServer = async () => {
  const app = new Hono();

  app.post("/mcp", async (c) => {
    const { req, res } = toReqRes(c.req.raw);
    const server = createServer();
    try {
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
        enableJsonResponse: true,
      });
      await server.connect(transport);
      await transport.handleRequest(req, res, await c.req.json());
    } catch (error) {
      console.error("MCP server error:", error);
      return c.json({ error: "MCP server error" }, 500);
    }
  });

  const port = 3000;
  console.log(`MCP PTY server started via HTTP on port ${port}`);
  Bun.serve({
    port,
    fetch: app.fetch,
  });
};

// Start server based on transport type
if (transportType === "http") {
  startHttpServer();
} else {
  startStdioServer();
}
