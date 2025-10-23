import { describe, expect, test } from "bun:test";
import {
  killToolHandler,
  listToolHandler,
  readToolHandler,
  startToolHandler,
  writeInputToolHandler,
} from "../handlers/tools";
import type { HandlerContext } from "../types";

/**
 * Create isolated mock handler context for testing
 * Each invocation returns fresh mock objects for concurrent test safety
 */
const createMockContext = (): HandlerContext => {
  const mockPtyManager = {
    createPty: async () => ({
      processId: "test-pid",
      screen: "test screen",
      exitCode: null,
    }),
    removePty: () => true,
    getPty: (processId: string) =>
      processId === "test-pid"
        ? {
            captureBuffer: () => ["line1", "line2"],
            write: async () => ({
              screen: "output",
              cursor: { x: 0, y: 0 },
              exitCode: null,
            }),
            getOutputBuffer: () => "test output",
          }
        : null,
    getAllPtys: () => [],
  };

  const mockSessionManager = {
    getPtyManager: (_sessionId: string) => mockPtyManager,
    addPty: () => true,
    removePty: () => true,
  };

  const mockServer = { sendLoggingMessage: async () => {} };

  return {
    server: mockServer as unknown as HandlerContext["server"],
    sessionId: "test-session",
    sessionManager:
      mockSessionManager as unknown as HandlerContext["sessionManager"],
  };
};

describe("Tool Handlers", () => {
  test("start handler returns processId, screen, exitCode", async () => {
    const context = createMockContext();
    const result = await startToolHandler(
      { command: "echo test", pwd: "/" },
      context,
    );

    expect(result.content).toBeDefined();
    expect(result.content[0]?.type).toBe("text");
    expect(result.structuredContent).toBeDefined();
    expect(result.structuredContent?.processId).toBe("test-pid");
  });

  test("start handler throws on session not found", async () => {
    const context = createMockContext();
    context.sessionManager.getPtyManager = () =>
      null as unknown as ReturnType<
        typeof context.sessionManager.getPtyManager
      >;

    await expect(
      startToolHandler({ command: "echo test", pwd: "/" }, context),
    ).rejects.toThrow("Session not found");
  });

  test("kill handler returns success flag", async () => {
    const context = createMockContext();
    const result = await killToolHandler({ processId: "test-pid" }, context);

    expect(result.content).toBeDefined();
    expect(result.structuredContent?.success).toBe(true);
  });

  test("kill handler throws on session not found", async () => {
    const context = createMockContext();
    context.sessionManager.getPtyManager = () =>
      null as unknown as ReturnType<
        typeof context.sessionManager.getPtyManager
      >;

    await expect(
      killToolHandler({ processId: "test-pid" }, context),
    ).rejects.toThrow("Session not found");
  });

  test("list handler returns array of ptys", async () => {
    const context = createMockContext();
    const result = await listToolHandler(
      {} as Parameters<typeof listToolHandler>[0],
      context,
    );

    expect(result.content).toBeDefined();
    expect(result.structuredContent?.ptys).toBeDefined();
    expect(Array.isArray(result.structuredContent?.ptys)).toBe(true);
  });

  test("list handler throws on session not found", async () => {
    const context = createMockContext();
    context.sessionManager.getPtyManager = () =>
      null as unknown as ReturnType<
        typeof context.sessionManager.getPtyManager
      >;

    await expect(
      listToolHandler({} as Parameters<typeof listToolHandler>[0], context),
    ).rejects.toThrow("Session not found");
  });

  test("read handler returns screen content", async () => {
    const context = createMockContext();
    const result = await readToolHandler({ processId: "test-pid" }, context);

    expect(result.content).toBeDefined();
    expect(result.structuredContent?.screen).toBeDefined();
    expect(typeof result.structuredContent?.screen).toBe("string");
  });

  test("read handler throws on session not found", async () => {
    const context = createMockContext();
    context.sessionManager.getPtyManager = () =>
      null as unknown as ReturnType<
        typeof context.sessionManager.getPtyManager
      >;

    await expect(
      readToolHandler({ processId: "test-pid" }, context),
    ).rejects.toThrow("Session not found");
  });

  test("read handler throws on PTY not found", async () => {
    const context = createMockContext();
    const mockManager = context.sessionManager.getPtyManager("test-session");
    if (mockManager) {
      mockManager.getPty = () =>
        null as unknown as ReturnType<typeof mockManager.getPty>;
    }

    await expect(
      readToolHandler({ processId: "invalid-pid" }, context),
    ).rejects.toThrow("PTY not found");
  });

  test("write_input handler returns screen with cursor", async () => {
    const context = createMockContext();
    const result = await writeInputToolHandler(
      { processId: "test-pid", input: "test", ctrlCode: "Enter", waitMs: 1000 },
      context,
    );

    expect(result.content).toBeDefined();
    expect(result.structuredContent?.screen).toBeDefined();
    expect(result.structuredContent?.cursor).toBeDefined();
  });

  test("write_input handler throws on session not found", async () => {
    const context = createMockContext();
    context.sessionManager.getPtyManager = () =>
      null as unknown as ReturnType<
        typeof context.sessionManager.getPtyManager
      >;

    await expect(
      writeInputToolHandler(
        { processId: "test-pid", input: "test", waitMs: 1000 },
        context,
      ),
    ).rejects.toThrow("Session not found");
  });

  test("write_input handler throws on PTY not found", async () => {
    const context = createMockContext();
    const mockManager = context.sessionManager.getPtyManager("test-session");
    if (mockManager) {
      mockManager.getPty = () =>
        null as unknown as ReturnType<typeof mockManager.getPty>;
    }

    await expect(
      writeInputToolHandler(
        { processId: "invalid-pid", input: "test", waitMs: 1000 },
        context,
      ),
    ).rejects.toThrow("PTY not found");
  });

  test("write_input handler throws when no input mode provided", async () => {
    const context = createMockContext();

    await expect(
      writeInputToolHandler({ processId: "test-pid", waitMs: 1000 }, context),
    ).rejects.toThrow(
      "At least one of 'input', 'ctrlCode', or 'data' must be provided",
    );
  });

  test("write_input handler throws on mutually exclusive input modes", async () => {
    const context = createMockContext();

    await expect(
      writeInputToolHandler(
        { processId: "test-pid", input: "test", data: "raw", waitMs: 1000 },
        context,
      ),
    ).rejects.toThrow("Cannot use 'data' together with 'input' or 'ctrlCode'");
  });
});
