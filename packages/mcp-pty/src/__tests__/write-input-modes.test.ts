import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { sessionManager } from "@pkgs/session-manager";
import { createToolHandlers } from "../tools";

/**
 * Test new input/ctrlCode split API modes
 */

describe("Write Input Modes", () => {
  let sessionId: string;
  let mockServer: McpServer;
  let handlers: ReturnType<typeof createToolHandlers>;

  beforeEach(() => {
    sessionId = sessionManager.createSession();
    // Mock server with bound session
    mockServer = { sessionId } as unknown as McpServer;
    // Manually bind session
    const sessionContext = new WeakMap<McpServer, string>();
    sessionContext.set(mockServer, sessionId);

    // Inject getBoundSessionId for testing
    const originalModule = require("../tools/index.ts");
    const bindSessionToServer = originalModule.bindSessionToServer;
    bindSessionToServer(mockServer, sessionId);

    handlers = createToolHandlers(mockServer);
  });

  afterEach(() => {
    sessionManager.terminateSession(sessionId);
  });

  test("Safe mode: input + ctrlCode", async () => {
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
  }, 10000);

  test("Safe mode: ctrlCode only (Ctrl+C)", async () => {
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
  }, 10000);

  test("Raw mode: multiline data", async () => {
    const startResult = await handlers.start({
      command: "cat",
      pwd: process.cwd(),
    });
    const processId = (startResult.structuredContent as { processId: string })
      .processId;

    // Send multiline text
    const result = await handlers.write_input({
      processId,
      data: "line1\nline2\nline3\n",
      waitMs: 500,
    });

    const screen = (result.structuredContent as { screen: string }).screen;
    expect(screen).toContain("line1");
    expect(screen).toContain("line2");
    expect(screen).toContain("line3");
  }, 10000);

  test("Named control codes work", async () => {
    const startResult = await handlers.start({
      command: "node",
      pwd: process.cwd(),
    });
    const processId = (startResult.structuredContent as { processId: string })
      .processId;

    // Test different named codes
    await handlers.write_input({
      processId,
      input: "console.log('test')",
      ctrlCode: "Enter",
      waitMs: 500,
    });

    // Ctrl+C to interrupt
    const result = await handlers.write_input({
      processId,
      ctrlCode: "Ctrl+C",
      waitMs: 300,
    });

    expect(result.structuredContent).toBeDefined();
  }, 10000);

  test("Validation: data and input/ctrlCode are mutually exclusive", async () => {
    const startResult = await handlers.start({
      command: "cat",
      pwd: process.cwd(),
    });
    const processId = (startResult.structuredContent as { processId: string })
      .processId;

    // This should fail validation
    await expect(
      handlers.write_input({
        processId,
        input: "hello",
        data: "world\n",
        waitMs: 300,
      }),
    ).rejects.toThrow();
  }, 10000);

  test("Empty input with ctrlCode only", async () => {
    const startResult = await handlers.start({
      command: "node",
      pwd: process.cwd(),
    });
    const processId = (startResult.structuredContent as { processId: string })
      .processId;

    // Just press Enter (empty input + Enter)
    const result = await handlers.write_input({
      processId,
      input: "",
      ctrlCode: "Enter",
      waitMs: 300,
    });

    expect(result.structuredContent).toBeDefined();
  }, 10000);
});
