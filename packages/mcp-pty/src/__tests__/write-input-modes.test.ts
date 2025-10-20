import { describe, expect, test } from "bun:test";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withTestSessionManager } from "@pkgs/session-manager";
import { bindSessionToServer, createToolHandlers } from "../tools";

/**
 * Test new input/ctrlCode split API modes
 */

describe("Write Input Modes", () => {
  test("Safe mode: input + ctrlCode", async () => {
    await withTestSessionManager(async (sessionManager) => {
      const sessionId = sessionManager.createSession();
      const mockServer = { sessionId } as unknown as McpServer;
      bindSessionToServer(mockServer, sessionId);
      const handlers = createToolHandlers(mockServer);

      const startResult = await handlers.start({
        command: "node",
        pwd: process.cwd(),
      });
      const processId = (startResult.structuredContent as { processId: string })
        .processId;

      // Test: Plain text + Enter
      const result = await handlers.write_input({
        processId,
        input: "2+2",
        ctrlCode: "Enter",
        waitMs: 500,
      });

      const screen = (result.structuredContent as { screen: string }).screen;
      expect(screen).toContain("4");
    });
  }, 10000);

  test("Safe mode: ctrlCode only (Ctrl+C)", async () => {
    await withTestSessionManager(async (sessionManager) => {
      const sessionId = sessionManager.createSession();
      const mockServer = { sessionId } as unknown as McpServer;
      bindSessionToServer(mockServer, sessionId);
      const handlers = createToolHandlers(mockServer);

      const startResult = await handlers.start({
        command: "cat",
        pwd: process.cwd(),
      });
      const processId = (startResult.structuredContent as { processId: string })
        .processId;

      // Send Ctrl+C
      const result = await handlers.write_input({
        processId,
        ctrlCode: "Ctrl+C",
        waitMs: 300,
      });

      expect(result.structuredContent).toBeDefined();
    });
  }, 10000);

  test("Raw mode: multiline data", async () => {
    await withTestSessionManager(async (sessionManager) => {
      const sessionId = sessionManager.createSession();
      const mockServer = { sessionId } as unknown as McpServer;
      bindSessionToServer(mockServer, sessionId);
      const handlers = createToolHandlers(mockServer);

      const startResult = await handlers.start({
        command: "cat",
        pwd: process.cwd(),
      });
      const processId = (startResult.structuredContent as { processId: string })
        .processId;

      // Test: Multiline data
      const result = await handlers.write_input({
        processId,
        data: "line1\nline2\n",
        waitMs: 500,
      });

      const screen = (result.structuredContent as { screen: string }).screen;
      expect(screen).toContain("line1");
      expect(screen).toContain("line2");
    });
  }, 10000);

  test("Named control codes work", async () => {
    await withTestSessionManager(async (sessionManager) => {
      const sessionId = sessionManager.createSession();
      const mockServer = { sessionId } as unknown as McpServer;
      bindSessionToServer(mockServer, sessionId);
      const handlers = createToolHandlers(mockServer);

      const startResult = await handlers.start({
        command: "cat",
        pwd: process.cwd(),
      });
      const processId = (startResult.structuredContent as { processId: string })
        .processId;

      // Test: Named control codes
      const result = await handlers.write_input({
        processId,
        ctrlCode: "Enter",
        waitMs: 300,
      });

      expect(result.structuredContent).toBeDefined();
    });
  }, 10000);

  test("Validation: data and input/ctrlCode are mutually exclusive", async () => {
    await withTestSessionManager(async (sessionManager) => {
      const sessionId = sessionManager.createSession();
      const mockServer = { sessionId } as unknown as McpServer;
      bindSessionToServer(mockServer, sessionId);
      const handlers = createToolHandlers(mockServer);

      const startResult = await handlers.start({
        command: "cat",
        pwd: process.cwd(),
      });
      const processId = (startResult.structuredContent as { processId: string })
        .processId;

      // This should throw
      await expect(
        handlers.write_input({
          processId,
          input: "hello",
          data: "world\n",
          waitMs: 300,
        }),
      ).rejects.toThrow();
    });
  }, 10000);

  test("Empty input with ctrlCode only", async () => {
    await withTestSessionManager(async (sessionManager) => {
      const sessionId = sessionManager.createSession();
      const mockServer = { sessionId } as unknown as McpServer;
      bindSessionToServer(mockServer, sessionId);
      const handlers = createToolHandlers(mockServer);

      const startResult = await handlers.start({
        command: "cat",
        pwd: process.cwd(),
      });
      const processId = (startResult.structuredContent as { processId: string })
        .processId;

      // Test: Empty input + Enter
      const result = await handlers.write_input({
        processId,
        ctrlCode: "Enter",
        waitMs: 300,
      });

      expect(result.structuredContent).toBeDefined();
    });
  }, 10000);
});
