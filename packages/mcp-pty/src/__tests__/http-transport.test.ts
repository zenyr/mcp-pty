import { afterAll, beforeAll, describe, expect, test } from "bun:test";
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

    // Poll for server readiness instead of fixed delay
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
      resolve(port); // Fallback if polling fails
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

  test("GET /mcp returns health check", async () => {
    const factory = new McpServerFactory({ name: "mcp-pty", version: "0.1.0" });

    const port = await reservePortAndStartServer(factory);

    const response = await fetch(`http://localhost:${port}/mcp`);
    expect(response.status).toBe(200);
    const data = (await response.json()) as Record<string, unknown>;
    expect(data.success).toBe(true);
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

  test("POST /mcp with session header reconnects", async () => {
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

    expect(reconnectResponse.status).not.toBe(410);
    const reconnectSessionId = reconnectResponse.headers.get("mcp-session-id");
    expect(reconnectSessionId).toBe(sessionId);
  });

  test("DELETE /mcp without session header returns 400", async () => {
    const factory = new McpServerFactory({ name: "mcp-pty", version: "0.1.0" });

    const port = await reservePortAndStartServer(factory);

    const response = await fetch(`http://localhost:${port}/mcp`, {
      method: "DELETE",
    });

    expect(response.status).toBe(400);
    const data = (await response.json()) as Record<string, unknown>;
    expect(typeof data.error).toBe("string");
  });
});
