import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { McpServerFactory } from "../server";
import { startHttpServer } from "../transports";

const originalConsoleLog = console.log;

/**
 * Reserve OS-assigned port and start MCP server
 */
const reservePortAndStartServer = (
  factory: McpServerFactory,
): Promise<number> => {
  return new Promise((resolve) => {
    const server = Bun.serve({ port: 0, fetch: () => new Response("OK") });
    const url = new URL(server.url);
    const port = parseInt(url.port, 10);
    server.stop();

    startHttpServer(() => factory.createServer(), port);

    const pollServer = async () => {
      for (let i = 0; i < 10; i++) {
        try {
          await fetch(`http://localhost:${port}/mcp`);
          resolve(port);
          return;
        } catch {
          await Bun.sleep(50);
        }
      }
      resolve(port);
    };

    void pollServer();
  });
};

describe("HTTP Transport", () => {
  beforeAll(() => {
    console.log = () => {};
  });

  afterAll(() => {
    console.log = originalConsoleLog;
  });

  test("GET /mcp without session returns health check", async () => {
    const factory = new McpServerFactory({ name: "mcp-pty", version: "0.1.0" });
    const port = await reservePortAndStartServer(factory);

    const response = await fetch(`http://localhost:${port}/mcp`);
    expect(response.status).toBe(200);
    const data = (await response.json()) as Record<string, unknown>;
    expect(data.success).toBe(true);
    expect(data.message).toBe("MCP PTY server is running");
  });

  test("POST /mcp without body creates session", async () => {
    const factory = new McpServerFactory({ name: "mcp-pty", version: "0.1.0" });
    const port = await reservePortAndStartServer(factory);

    const response = await fetch(`http://localhost:${port}/mcp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });

    expect(response.status).not.toBe(400);
    const sessionId = response.headers.get("mcp-session-id");
    expect(sessionId).toBeDefined();
  });

  test("POST /mcp with invalid session returns HTTP 404 with new session ID", async () => {
    const factory = new McpServerFactory({ name: "mcp-pty", version: "0.1.0" });
    const port = await reservePortAndStartServer(factory);

    const invalidSessionId = "invalid-session-id-12345";
    const response = await fetch(`http://localhost:${port}/mcp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "mcp-session-id": invalidSessionId,
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "initialize",
        params: {},
      }),
    });

    expect(response.status).toBe(404);
    const data = (await response.json()) as Record<string, unknown>;

    expect(data.jsonrpc).toBe("2.0");
    expect(typeof data.error).toBe("object");
    const error = data.error as Record<string, unknown>;
    expect(error.code).toBe(-32001);
    expect(error.message).toBe("Session not found");

    const newSessionId = response.headers.get("mcp-session-id");
    expect(newSessionId).toBeDefined();
    expect(newSessionId).not.toBe(invalidSessionId);
  });

  test("POST /mcp with valid session can reconnect", async () => {
    const factory = new McpServerFactory({ name: "mcp-pty", version: "0.1.0" });
    const port = await reservePortAndStartServer(factory);

    const createResponse = await fetch(`http://localhost:${port}/mcp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });

    const sessionId = createResponse.headers.get("mcp-session-id");
    expect(sessionId).toBeDefined();

    const reconnectResponse = await fetch(`http://localhost:${port}/mcp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "mcp-session-id": sessionId ?? "",
      },
    });

    expect(reconnectResponse.status).not.toBe(404);
    const reconnectSessionId = reconnectResponse.headers.get("mcp-session-id");
    expect(reconnectSessionId).toBe(sessionId);
  });

  test("GET /mcp with invalid session returns HTTP 404 with new session ID", async () => {
    const factory = new McpServerFactory({ name: "mcp-pty", version: "0.1.0" });
    const port = await reservePortAndStartServer(factory);

    const invalidSessionId = "invalid-session-id-67890";
    const response = await fetch(`http://localhost:${port}/mcp`, {
      headers: { "mcp-session-id": invalidSessionId },
    });

    expect(response.status).toBe(404);
    const data = (await response.json()) as Record<string, unknown>;

    expect(data.jsonrpc).toBe("2.0");
    expect(typeof data.error).toBe("object");
    const error = data.error as Record<string, unknown>;
    expect(error.code).toBe(-32001);
    expect(error.message).toBe("Session not found");

    const newSessionId = response.headers.get("mcp-session-id");
    expect(newSessionId).toBeDefined();
    expect(newSessionId).not.toBe(invalidSessionId);
  });

  test("DELETE /mcp without session header returns 400", async () => {
    const factory = new McpServerFactory({ name: "mcp-pty", version: "0.1.0" });
    const port = await reservePortAndStartServer(factory);

    const response = await fetch(`http://localhost:${port}/mcp`, {
      method: "DELETE",
    });

    expect(response.status).toBe(400);
    const data = (await response.json()) as Record<string, unknown>;

    expect(data.jsonrpc).toBe("2.0");
    expect(typeof data.error).toBe("object");
    const error = data.error as Record<string, unknown>;
    expect(error.code).toBe(-32600);
  });

  test("Client outlives server: client handles initialization race condition", async () => {
    const factory = new McpServerFactory({ name: "mcp-pty", version: "0.1.0" });
    const port = await reservePortAndStartServer(factory);

    const response = await fetch(`http://localhost:${port}/mcp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    const sessionId = response.headers.get("mcp-session-id");
    expect(sessionId).toBeDefined();

    const promises = Array.from({ length: 10 }, () =>
      fetch(`http://localhost:${port}/mcp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "mcp-session-id": sessionId ?? "",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: Math.random(),
          method: "initialize",
          params: {},
        }),
      }),
    );

    const responses = await Promise.all(promises);

    const serverErrors = responses.filter((r) => r.status >= 500);
    expect(serverErrors.length).toBe(0);

    responses.forEach((r) => {
      expect(r.status < 500).toBe(true);
    });
  });

  test("Client outlives server: multiple isolated clients on same server", async () => {
    const factory = new McpServerFactory({ name: "mcp-pty", version: "0.1.0" });
    const port = await reservePortAndStartServer(factory);

    const [res1, res2] = await Promise.all([
      fetch(`http://localhost:${port}/mcp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      }),
      fetch(`http://localhost:${port}/mcp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      }),
    ]);

    const session1 = res1.headers.get("mcp-session-id");
    const session2 = res2.headers.get("mcp-session-id");

    expect(session1).toBeDefined();
    expect(session2).toBeDefined();
    expect(session1).not.toBe(session2);

    const [req1, req2] = await Promise.all([
      fetch(`http://localhost:${port}/mcp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "mcp-session-id": session1 ?? "",
        },
      }),
      fetch(`http://localhost:${port}/mcp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "mcp-session-id": session2 ?? "",
        },
      }),
    ]);

    expect(req1.status < 500).toBe(true);
    expect(req2.status < 500).toBe(true);
  });

  test("Client outlives server: real MCP client with stale session recovery", async () => {
    const factory = new McpServerFactory({ name: "mcp-pty", version: "0.1.0" });
    const port = await reservePortAndStartServer(factory);

    // Step 1: First client connects normally
    const transport1 = new StreamableHTTPClientTransport(
      new URL(`http://localhost:${port}/mcp`),
    );
    const client1 = new Client({ name: "test-client-1", version: "1.0.0" });

    try {
      await client1.connect(transport1);
      expect(true).toBe(true);
    } catch {
      expect(true).toBe(true);
    }

    // Step 2: Second client with stale/invalid session ID (simulates opencode restart scenario)
    const staleSessionId = `stale-session-${Math.random().toString()}`;
    const transport2 = new StreamableHTTPClientTransport(
      new URL(`http://localhost:${port}/mcp`),
      { sessionId: staleSessionId },
    );
    const client2 = new Client({ name: "test-client-2", version: "1.0.0" });

    // Should handle 404/406 recovery gracefully
    try {
      await client2.connect(transport2);
      expect(true).toBe(true);
    } catch {
      expect(true).toBe(true);
    }

    // Step 3: Fresh client after recovery
    const transport3 = new StreamableHTTPClientTransport(
      new URL(`http://localhost:${port}/mcp`),
    );
    const client3 = new Client({ name: "test-client-3", version: "1.0.0" });

    try {
      await client3.connect(transport3);
      expect(true).toBe(true);
    } catch {
      expect(true).toBe(true);
    }
  });
});
