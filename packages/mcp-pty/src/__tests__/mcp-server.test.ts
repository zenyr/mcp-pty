import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withTestPtyManager } from "@pkgs/pty-manager";
import { withTestSessionManager } from "@pkgs/session-manager";
import {
  bindSessionToServerResources,
  createResourceHandlers,
} from "../resources";
import { McpServerFactory } from "../server";
import { bindSessionToServer, createToolHandlers } from "../tools";

describe("MCP Server", () => {
  const originalConsoleLog = console.log;

  beforeAll(() => {
    console.log = () => {};
  });

  afterAll(() => {
    console.log = originalConsoleLog;
  });

  test("creates server instance", () => {
    const factory = new McpServerFactory({
      name: "mcp-pty",
      version: "0.1.0",
      deactivateResources: false,
    });
    const server = factory.createServer();
    expect(server).toBeDefined();
    expect(server).toBeInstanceOf(McpServer);
  });

  describe("Integration Tests", () => {
    test("createSession creates session with ptyManager", async () => {
      await withTestSessionManager(async (sessionManager) => {
        const sessionId = sessionManager.createSession();
        const ptyManager = sessionManager.getPtyManager(sessionId);

        expect(sessionId).toBeDefined();
        expect(ptyManager).toBeDefined();
        expect(sessionManager.getSession(sessionId)).toBeDefined();
      });
    });

    test("ptyManager creates and lists PTY processes", async () => {
      await withTestPtyManager("test-session", async (ptyManager) => {
        const { processId } = await ptyManager.createPty("echo");
        expect(processId).toBeDefined();

        const ptys = ptyManager.getAllPtys();
        expect(ptys).toBeDefined();
        expect(ptys.length).toBe(1);
        expect(ptys[0]?.id).toBe(processId);
      });
    });

    test("ptyManager reads output buffer", async () => {
      await withTestPtyManager("test-session", async (ptyManager) => {
        const { processId } = await ptyManager.createPty("echo");
        if (!processId) throw new Error("Failed to create PTY");

        const pty = ptyManager.getPty(processId);
        if (!pty) throw new Error("PTY not found");

        expect(pty).toBeDefined();
        expect(typeof pty.getScreenContent()).toBe("string");
      });
    });

    test("ptyManager removes PTY", async () => {
      await withTestPtyManager("test-session", async (ptyManager) => {
        const { processId } = await ptyManager.createPty("sleep");
        if (!processId) throw new Error("Failed to create PTY");

        const removed = ptyManager.removePty(processId);
        expect(removed).toBe(true);
        expect(ptyManager.getPty(processId)).toBeUndefined();
      });
    });

    test("ptyManager returns false when removing non-existent PTY", async () => {
      await withTestPtyManager("test-session", async (ptyManager) => {
        const removed = ptyManager.removePty("non-existent");
        expect(removed).toBe(false);
      });
    });
  });

  describe("MCP Resources", () => {
    test("pty://status returns global server status", async () => {
      await withTestSessionManager(async (sessionManager) => {
        const factory = new McpServerFactory({
          name: "mcp-pty",
          version: "0.1.0",
          deactivateResources: false,
        });
        const server = factory.createServer();
        const sessionId = sessionManager.createSession();
        const ptyManager = sessionManager.getPtyManager(sessionId);
        if (!ptyManager) throw new Error("Failed to get PtyManager");

        bindSessionToServer(server, sessionId);
        bindSessionToServerResources(server, sessionId);

        const handlers = createResourceHandlers(server);
        const result = await handlers.status();
        expect(result).toBeDefined();
        expect(result.contents).toBeDefined();
        expect(result.contents.length).toBe(1);

        const content = result.contents[0];
        expect(content?.uri).toBe("pty://status");
        if (!content?.text) throw new Error("content.text is undefined");

        const parsed = JSON.parse(content.text);
        expect(parsed).toHaveProperty("sessions");
        expect(parsed).toHaveProperty("processes");
        expect(typeof parsed.sessions).toBe("number");
        expect(typeof parsed.processes).toBe("number");

        ptyManager.dispose();
      });
    });

    test("pty://processes returns empty process list initially", async () => {
      await withTestSessionManager(async (sessionManager) => {
        const factory = new McpServerFactory({
          name: "mcp-pty",
          version: "0.1.0",
          deactivateResources: false,
        });
        const server = factory.createServer();
        const sessionId = sessionManager.createSession();
        const ptyManager = sessionManager.getPtyManager(sessionId);
        if (!ptyManager) throw new Error("Failed to get PtyManager");

        bindSessionToServer(server, sessionId);
        bindSessionToServerResources(server, sessionId);

        const handlers = createResourceHandlers(server);
        const result = await handlers.processes();
        expect(result.contents).toBeDefined();
        expect(result.contents.length).toBe(1);

        const content = result.contents[0];
        expect(content?.uri).toBe("pty://processes");
        if (!content?.text) throw new Error("content.text is undefined");

        const parsed = JSON.parse(content.text);
        expect(parsed).toHaveProperty("processes");
        expect(Array.isArray(parsed.processes)).toBe(true);
        expect(parsed.processes.length).toBe(0);

        ptyManager.dispose();
      });
    });

    test("pty://processes returns process list after creating PTY", async () => {
      await withTestSessionManager(async (sessionManager) => {
        const factory = new McpServerFactory({
          name: "mcp-pty",
          version: "0.1.0",
          deactivateResources: false,
        });
        const server = factory.createServer();
        const sessionId = sessionManager.createSession();
        const ptyManager = sessionManager.getPtyManager(sessionId);
        if (!ptyManager) throw new Error("Failed to get PtyManager");

        bindSessionToServer(server, sessionId);
        bindSessionToServerResources(server, sessionId);

        const { processId } = await ptyManager.createPty("echo test");
        sessionManager.addPty(sessionId, processId);

        const handlers = createResourceHandlers(server);
        const result = await handlers.processes();
        const content = result.contents[0];
        if (!content?.text) throw new Error("content.text is undefined");

        const parsed = JSON.parse(content.text);
        expect(parsed.processes.length).toBe(1);
        expect(parsed.processes[0]).toHaveProperty("processId", processId);
        expect(parsed.processes[0]).toHaveProperty("status");
        expect(parsed.processes[0]).toHaveProperty("createdAt");
        expect(parsed.processes[0]).toHaveProperty("lastActivity");

        ptyManager.dispose();
      });
    });

    test("pty://processes/{processId} returns specific process output", async () => {
      await withTestSessionManager(async (sessionManager) => {
        const factory = new McpServerFactory({
          name: "mcp-pty",
          version: "0.1.0",
          deactivateResources: false,
        });
        const server = factory.createServer();
        const sessionId = sessionManager.createSession();
        const ptyManager = sessionManager.getPtyManager(sessionId);
        if (!ptyManager) throw new Error("Failed to get PtyManager");

        bindSessionToServer(server, sessionId);
        bindSessionToServerResources(server, sessionId);

        const { processId } = await ptyManager.createPty("echo test");
        sessionManager.addPty(sessionId, processId);

        await new Promise((resolve) => setTimeout(resolve, 100));

        const handlers = createResourceHandlers(server);
        const uri = new URL(`pty://processes/${processId}`);
        const result = await handlers.processOutput(uri, { processId });
        const content = result.contents[0];
        if (!content?.text) throw new Error("content.text is undefined");

        const parsed = JSON.parse(content.text);
        expect(parsed).toHaveProperty("screen");
        expect(typeof parsed.screen).toBe("string");

        ptyManager.dispose();
      });
    });

    test("pty://processes/{processId} throws for non-existent process", async () => {
      await withTestSessionManager(async (sessionManager) => {
        const factory = new McpServerFactory({
          name: "mcp-pty",
          version: "0.1.0",
          deactivateResources: false,
        });
        const server = factory.createServer();
        const sessionId = sessionManager.createSession();
        const ptyManager = sessionManager.getPtyManager(sessionId);
        if (!ptyManager) throw new Error("Failed to get PtyManager");

        bindSessionToServer(server, sessionId);
        bindSessionToServerResources(server, sessionId);

        const handlers = createResourceHandlers(server);
        const uri = new URL("pty://processes/non-existent");
        await expect(
          handlers.processOutput(uri, { processId: "non-existent" }),
        ).rejects.toThrow("PTY process not found");

        ptyManager.dispose();
      });
    });

    test("resource throws when session not bound", async () => {
      const factory = new McpServerFactory({
        name: "mcp-pty",
        version: "0.1.0",
        deactivateResources: false,
      });
      const unboundServer = factory.createServer();

      const handlers = createResourceHandlers(unboundServer);
      await expect(handlers.processes()).rejects.toThrow(
        "No session bound to server",
      );
    });
  });

  describe("MCP Tools", () => {
    test("start tool handler creates PTY", async () => {
      await withTestSessionManager(async (sessionManager) => {
        const factory = new McpServerFactory({
          name: "mcp-pty",
          version: "0.1.0",
          deactivateResources: false,
        });
        const server = factory.createServer();
        const sessionId = sessionManager.createSession();
        const ptyManager = sessionManager.getPtyManager(sessionId);
        if (!ptyManager) throw new Error("Failed to get PtyManager");

        bindSessionToServer(server, sessionId);

        const { start } = createToolHandlers(server);
        const result = await start({
          command: "echo test",
          pwd: process.cwd(),
        });

        expect(result).toBeDefined();
        expect(result.content).toBeDefined();
        expect(result.structuredContent).toBeDefined();

        const structured = result.structuredContent as {
          processId: string;
          screen: string;
          exitCode: number | null;
        };
        expect(structured.processId).toBeDefined();
        expect(typeof structured.processId).toBe("string");
        expect(typeof structured.screen).toBe("string");
        expect(
          structured.exitCode === null ||
            typeof structured.exitCode === "number",
        ).toBe(true);

        const pty = ptyManager.getPty(structured.processId);
        expect(pty).toBeDefined();

        ptyManager.dispose();
      });
    });

    test("start tool handler throws for non-existent directory", async () => {
      await withTestSessionManager(async (sessionManager) => {
        const factory = new McpServerFactory({
          name: "mcp-pty",
          version: "0.1.0",
          deactivateResources: false,
        });
        const server = factory.createServer();
        const sessionId = sessionManager.createSession();
        const ptyManager = sessionManager.getPtyManager(sessionId);
        if (!ptyManager) throw new Error("Failed to get PtyManager");

        bindSessionToServer(server, sessionId);

        const { start } = createToolHandlers(server);
        await expect(
          start({ command: "echo test", pwd: "/nonexistent/directory/path" }),
        ).rejects.toThrow(
          "Working directory does not exist or is inaccessible",
        );

        ptyManager.dispose();
      });
    });

    test("start tool handler throws when pwd is a file", async () => {
      await withTestSessionManager(async (sessionManager) => {
        const factory = new McpServerFactory({
          name: "mcp-pty",
          version: "0.1.0",
          deactivateResources: false,
        });
        const server = factory.createServer();
        const sessionId = sessionManager.createSession();
        const ptyManager = sessionManager.getPtyManager(sessionId);
        if (!ptyManager) throw new Error("Failed to get PtyManager");

        bindSessionToServer(server, sessionId);

        const { start } = createToolHandlers(server);
        await expect(
          start({ command: "echo test", pwd: `${process.cwd()}/package.json` }),
        ).rejects.toThrow("Path is not a directory");

        ptyManager.dispose();
      });
    });

    test("start tool handler throws when session not bound", async () => {
      const factory = new McpServerFactory({
        name: "mcp-pty",
        version: "0.1.0",
        deactivateResources: false,
      });
      const unboundServer = factory.createServer();
      const { start } = createToolHandlers(unboundServer);

      await expect(
        start({ command: "echo test", pwd: process.cwd() }),
      ).rejects.toThrow("No session bound to server");
    });

    test("kill tool handler removes PTY", async () => {
      await withTestSessionManager(async (sessionManager) => {
        const factory = new McpServerFactory({
          name: "mcp-pty",
          version: "0.1.0",
          deactivateResources: false,
        });
        const server = factory.createServer();
        const sessionId = sessionManager.createSession();
        const ptyManager = sessionManager.getPtyManager(sessionId);
        if (!ptyManager) throw new Error("Failed to get PtyManager");

        bindSessionToServer(server, sessionId);

        const { processId } = await ptyManager.createPty("sleep 10");
        sessionManager.addPty(sessionId, processId);

        const { kill } = createToolHandlers(server);
        const result = await kill({ processId });

        const structured = result.structuredContent as { success: boolean };
        expect(structured.success).toBe(true);
        expect(ptyManager.getPty(processId)).toBeUndefined();

        ptyManager.dispose();
      });
    });

    test("kill tool handler returns false for non-existent PTY", async () => {
      await withTestSessionManager(async (sessionManager) => {
        const factory = new McpServerFactory({
          name: "mcp-pty",
          version: "0.1.0",
          deactivateResources: false,
        });
        const server = factory.createServer();
        const sessionId = sessionManager.createSession();
        const ptyManager = sessionManager.getPtyManager(sessionId);
        if (!ptyManager) throw new Error("Failed to get PtyManager");

        bindSessionToServer(server, sessionId);

        const { kill } = createToolHandlers(server);
        const result = await kill({ processId: "non-existent" });

        const structured = result.structuredContent as { success: boolean };
        expect(structured.success).toBe(false);

        ptyManager.dispose();
      });
    });

    test("list tool handler returns empty array initially", async () => {
      await withTestSessionManager(async (sessionManager) => {
        const factory = new McpServerFactory({
          name: "mcp-pty",
          version: "0.1.0",
          deactivateResources: false,
        });
        const server = factory.createServer();
        const sessionId = sessionManager.createSession();
        const ptyManager = sessionManager.getPtyManager(sessionId);
        if (!ptyManager) throw new Error("Failed to get PtyManager");

        bindSessionToServer(server, sessionId);

        const { list } = createToolHandlers(server);
        const result = await list({});

        const structured = result.structuredContent as {
          ptys: Array<{ id: string; status: string }>;
        };
        expect(Array.isArray(structured.ptys)).toBe(true);
        expect(structured.ptys.length).toBe(0);

        ptyManager.dispose();
      });
    });

    test("list tool handler returns PTY list", async () => {
      await withTestSessionManager(async (sessionManager) => {
        const factory = new McpServerFactory({
          name: "mcp-pty",
          version: "0.1.0",
          deactivateResources: false,
        });
        const server = factory.createServer();
        const sessionId = sessionManager.createSession();
        const ptyManager = sessionManager.getPtyManager(sessionId);
        if (!ptyManager) throw new Error("Failed to get PtyManager");

        bindSessionToServer(server, sessionId);

        const { processId } = await ptyManager.createPty("echo test");
        sessionManager.addPty(sessionId, processId);

        const { list } = createToolHandlers(server);
        const result = await list({});

        const structured = result.structuredContent as {
          ptys: Array<{ id: string; status: string; exitCode: number | null }>;
        };
        expect(structured.ptys.length).toBe(1);
        expect(structured.ptys[0]?.id).toBe(processId);
        expect(structured.ptys[0]).toHaveProperty("status");
        expect(structured.ptys[0]).toHaveProperty("createdAt");
        expect(structured.ptys[0]).toHaveProperty("lastActivity");
        expect(structured.ptys[0]).toHaveProperty("exitCode");
        expect(
          structured.ptys[0]?.exitCode === null ||
            typeof structured.ptys[0]?.exitCode === "number",
        ).toBe(true);

        ptyManager.dispose();
      });
    });

    test("read tool handler returns PTY output", async () => {
      await withTestSessionManager(async (sessionManager) => {
        const factory = new McpServerFactory({
          name: "mcp-pty",
          version: "0.1.0",
          deactivateResources: false,
        });
        const server = factory.createServer();
        const sessionId = sessionManager.createSession();
        const ptyManager = sessionManager.getPtyManager(sessionId);
        if (!ptyManager) throw new Error("Failed to get PtyManager");

        bindSessionToServer(server, sessionId);

        const { processId } = await ptyManager.createPty("echo test");
        sessionManager.addPty(sessionId, processId);

        await new Promise((resolve) => setTimeout(resolve, 100));

        const { read } = createToolHandlers(server);
        const result = await read({ processId });

        const structured = result.structuredContent as { screen: string };
        expect(typeof structured.screen).toBe("string");

        ptyManager.dispose();
      });
    });

    test("read tool handler throws for non-existent PTY", async () => {
      await withTestSessionManager(async (sessionManager) => {
        const factory = new McpServerFactory({
          name: "mcp-pty",
          version: "0.1.0",
          deactivateResources: false,
        });
        const server = factory.createServer();
        const sessionId = sessionManager.createSession();
        const ptyManager = sessionManager.getPtyManager(sessionId);
        if (!ptyManager) throw new Error("Failed to get PtyManager");

        bindSessionToServer(server, sessionId);

        const { read } = createToolHandlers(server);
        await expect(read({ processId: "non-existent" })).rejects.toThrow(
          "PTY not found",
        );

        ptyManager.dispose();
      });
    });

    test("write_input tool handler writes data and returns terminal state", async () => {
      await withTestSessionManager(async (sessionManager) => {
        const factory = new McpServerFactory({
          name: "mcp-pty",
          version: "0.1.0",
          deactivateResources: false,
        });
        const server = factory.createServer();
        const sessionId = sessionManager.createSession();
        const ptyManager = sessionManager.getPtyManager(sessionId);
        if (!ptyManager) throw new Error("Failed to get PtyManager");

        bindSessionToServer(server, sessionId);

        const { processId } = await ptyManager.createPty("cat");
        sessionManager.addPty(sessionId, processId);

        const { write_input } = createToolHandlers(server);
        const result = await write_input({
          processId,
          data: "hello world\n",
          waitMs: 500,
        });

        expect(result).toBeDefined();
        expect(result.content).toBeDefined();
        expect(result.structuredContent).toBeDefined();

        const structured = result.structuredContent as {
          screen: string;
          cursor: { x: number; y: number };
          exitCode: number | null;
        };
        expect(typeof structured.screen).toBe("string");
        expect(structured.screen).toContain("hello world");
        expect(structured.cursor).toHaveProperty("x");
        expect(structured.cursor).toHaveProperty("y");
        expect(structured.exitCode).toBeNull();

        ptyManager.dispose();
      });
    });

    test("write_input tool handler handles CJK and Emoji", async () => {
      await withTestSessionManager(async (sessionManager) => {
        const factory = new McpServerFactory({
          name: "mcp-pty",
          version: "0.1.0",
          deactivateResources: false,
        });
        const server = factory.createServer();
        const sessionId = sessionManager.createSession();
        const ptyManager = sessionManager.getPtyManager(sessionId);
        if (!ptyManager) throw new Error("Failed to get PtyManager");

        bindSessionToServer(server, sessionId);

        const { processId } = await ptyManager.createPty("cat");
        sessionManager.addPty(sessionId, processId);

        const { write_input } = createToolHandlers(server);
        const result = await write_input({
          processId,
          data: "안녕하세요 👋\n",
          waitMs: 500,
        });

        const structured = result.structuredContent as { screen: string };
        expect(structured.screen).toContain("안녕하세요");
        expect(structured.screen).toContain("👋");

        ptyManager.dispose();
      });
    });

    test("write_input tool handler throws for non-existent PTY", async () => {
      await withTestSessionManager(async (sessionManager) => {
        const factory = new McpServerFactory({
          name: "mcp-pty",
          version: "0.1.0",
          deactivateResources: false,
        });
        const server = factory.createServer();
        const sessionId = sessionManager.createSession();
        const ptyManager = sessionManager.getPtyManager(sessionId);
        if (!ptyManager) throw new Error("Failed to get PtyManager");

        bindSessionToServer(server, sessionId);

        const { write_input } = createToolHandlers(server);
        await expect(
          write_input({ processId: "non-existent", data: "test\n" }),
        ).rejects.toThrow("PTY not found");

        ptyManager.dispose();
      });
    });
  });
});
