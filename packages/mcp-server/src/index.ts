#!/usr/bin/env bun
import {
  McpServer,
  ResourceTemplate,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { sessionManager } from "@pkgs/session-manager";
import { toReqRes } from "fetch-to-node";
import { Hono } from "hono";
import { z } from "zod";

// Parse command line arguments
const transportType = process.argv[2] === "http" ? "http" : "stdio";

// Start session monitoring
sessionManager.startMonitoring();

// Graceful shutdown
process.on("SIGTERM", () => {
  sessionManager.cleanup();
  process.exit(0);
});

process.on("SIGINT", () => {
  sessionManager.cleanup();
  process.exit(0);
});

// Initialize MCP server factory
export const createServer = () => {
  const server = new McpServer({
    name: "mcp-pty",
    version: "0.1.0",
    capabilities: {
      resources: {}, // Resources will be registered below
      tools: {}, // Tools will be registered below
    },
  });

  const deactivateResources =
    process.env.MCP_PTY_DEACTIVATE_RESOURCES === "true";

  if (deactivateResources) {
    // Register tools when resources are disabled
    server.registerTool(
      "start_pty",
      {
        title: "Start PTY",
        description: "Create new PTY instance",
        inputSchema: {
          sessionId: z.string(),
          command: z.string(),
        },
        outputSchema: {
          processId: z.string(),
        },
      },
      async ({ sessionId, command }) => {
        const ptyManager = sessionManager.getPtyManager(sessionId);
        if (!ptyManager) throw new Error("Session not found");
        const processId = ptyManager.createPty(command);
        sessionManager.addPty(sessionId, processId);
        return {
          content: [{ type: "text", text: JSON.stringify({ processId }) }],
          structuredContent: { processId },
        };
      }
    );

    server.registerTool(
      "kill_pty",
      {
        title: "Kill PTY",
        description: "Terminate PTY instance",
        inputSchema: {
          sessionId: z.string(),
          processId: z.string(),
        },
        outputSchema: {
          success: z.boolean(),
        },
      },
      async ({ sessionId, processId }) => {
        const ptyManager = sessionManager.getPtyManager(sessionId);
        if (!ptyManager) throw new Error("Session not found");
        const success = ptyManager.removePty(processId);
        if (success) sessionManager.removePty(sessionId, processId);
        return {
          content: [{ type: "text", text: JSON.stringify({ success }) }],
          structuredContent: { success },
        };
      }
    );

    server.registerTool(
      "list_pty",
      {
        title: "List PTY",
        description: "List PTY processes",
        inputSchema: {
          sessionId: z.string(),
        },
        outputSchema: {
          ptys: z.array(z.any()), // TODO: Proper schema
        },
      },
      async ({ sessionId }) => {
        const ptyManager = sessionManager.getPtyManager(sessionId);
        if (!ptyManager) throw new Error("Session not found");
        const ptys = ptyManager.getAllPtys();
        return {
          content: [{ type: "text", text: JSON.stringify({ ptys }) }],
          structuredContent: { ptys },
        };
      }
    );

    server.registerTool(
      "read_pty",
      {
        title: "Read PTY",
        description: "Read PTY output",
        inputSchema: {
          sessionId: z.string(),
          processId: z.string(),
        },
        outputSchema: {
          output: z.string(),
        },
      },
      async ({ sessionId, processId }) => {
        const ptyManager = sessionManager.getPtyManager(sessionId);
        if (!ptyManager) throw new Error("Session not found");
        const pty = ptyManager.getPty(processId);
        if (!pty) throw new Error("PTY not found");
        // TODO: Get output
        const output = "PTY output here";
        return {
          content: [{ type: "text", text: JSON.stringify({ output }) }],
          structuredContent: { output },
        };
      }
    );

    // activate_pty_tools: TODO
  }

  // Register resources
  server.registerResource(
    "status",
    "pty://status",
    {
      title: "Server Status",
      description: "Server status including session and process counts",
    },
    async () => ({
      contents: [
        {
          uri: "pty://status",
          text: JSON.stringify({
            sessions: sessionManager.getSessionCount(),
            processes: 0, // TODO: PTY count
          }),
        },
      ],
    })
  );

  server.registerResource(
    "sessions/list",
    new ResourceTemplate("pty://sessions/list", { list: undefined }),
    {
      title: "Sessions List",
      description: "List of all sessions",
    },
    async () => ({
      contents: [
        {
          uri: "pty://sessions/list",
          text: JSON.stringify(sessionManager.getAllSessions()),
        },
      ],
    })
  );

  server.registerResource(
    "session/output",
    new ResourceTemplate("pty://session/{id}/output", { list: undefined }),
    {
      title: "Session PTY Output",
      description: "PTY output for a specific session",
    },
    async (uri, params) => {
      const id = params.id;
      if (typeof id !== "string") throw new Error("Invalid session id");
      const session = sessionManager.getSession(id);
      if (!session) throw new Error("Session not found");
      // TODO: Get PTY output
      return {
        contents: [
          {
            uri: uri.href,
            text: "PTY output here",
          },
        ],
      };
    }
  );

  server.registerResource(
    "session/status",
    new ResourceTemplate("pty://session/{id}/status", { list: undefined }),
    {
      title: "Session Status",
      description: "Status of a specific session",
    },
    async (uri, params) => {
      const id = params.id;
      if (typeof id !== "string") throw new Error("Invalid session id");
      const session = sessionManager.getSession(id);
      if (!session) throw new Error("Session not found");
      return {
        contents: [
          {
            uri: uri.href,
            text: JSON.stringify(session),
          },
        ],
      };
    }
  );

  return server;
};

const startStdioServer = async () => {
  const sessionId = sessionManager.createSession();
  const server = createServer();
  try {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    sessionManager.updateStatus(sessionId, "active");
    console.log(`MCP PTY server started via stdio, session: ${sessionId}`);
  } catch (error) {
    console.error("Error initializing MCP server:", error);
    sessionManager.updateStatus(sessionId, "terminated");
    process.exit(1);
  }
};

const startHttpServer = async () => {
  const app = new Hono();
  const transports = new Map<string, StreamableHTTPServerTransport>();

  app.post("/mcp", async (c) => {
    const sessionId = c.req.header("mcp-session-id");
    let transport: StreamableHTTPServerTransport;

    if (sessionId && transports.has(sessionId)) {
      transport = transports.get(sessionId)!;
    } else {
      // New session
      const newSessionId = sessionManager.createSession();
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => newSessionId,
        enableJsonResponse: true,
        onsessioninitialized: (id) => {
          transports.set(id, transport);
        },
      });
      const server = createServer();
      await server.connect(transport);
      sessionManager.updateStatus(newSessionId, "active");
    }

    const { req, res } = toReqRes(c.req.raw);
    res.on("close", () => {
      if (transport.sessionId) {
        sessionManager.updateStatus(transport.sessionId, "terminated");
        transports.delete(transport.sessionId);
      }
    });
    try {
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
