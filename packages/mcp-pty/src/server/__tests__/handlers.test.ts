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
 * Mock session manager for testing
 */
const createMockSessionManager = () => ({
  getPtyManager: (_sessionId: string) => ({
    createPty: async () => ({
      processId: "test-pid",
      screen: "test screen",
      exitCode: null,
    }),
    removePty: () => true,
    getPty: () => ({
      captureBuffer: () => ["line1", "line2"],
      write: async () => ({
        screen: "output",
        cursor: { x: 0, y: 0 },
        exitCode: null,
      }),
      getOutputBuffer: () => "test output",
    }),
    getAllPtys: () => [],
  }),
  addPty: () => {},
  removePty: () => {},
});

/**
 * Mock MCP server
 */
const createMockServer = () => ({ sendLoggingMessage: async () => {} });

/**
 * Create mock handler context
 */
const createMockContext = (): HandlerContext => ({
  server: createMockServer() as unknown as HandlerContext["server"],
  sessionId: "test-session",
  sessionManager:
    createMockSessionManager() as unknown as HandlerContext["sessionManager"],
});

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

  test("kill handler returns success flag", async () => {
    const context = createMockContext();
    const result = await killToolHandler({ processId: "test-pid" }, context);

    expect(result.content).toBeDefined();
    expect(result.structuredContent?.success).toBe(true);
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

  test("read handler returns screen content", async () => {
    const context = createMockContext();
    const result = await readToolHandler({ processId: "test-pid" }, context);

    expect(result.content).toBeDefined();
    expect(result.structuredContent?.screen).toBeDefined();
    expect(typeof result.structuredContent?.screen).toBe("string");
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
});
