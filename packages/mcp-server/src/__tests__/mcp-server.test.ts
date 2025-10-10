import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { PtyManager } from "@pkgs/pty-manager";
import { sessionManager } from "@pkgs/session-manager";
import { createServer } from "../server";

describe("MCP Server", () => {
  test("creates server instance", () => {
    const server = createServer();
    expect(server).toBeDefined();
    expect(server).toBeInstanceOf(McpServer);
  });

  describe("Integration Tests", () => {
    let sessionId: string;
    let ptyManager: PtyManager | undefined;

    beforeEach(() => {
      sessionId = sessionManager.createSession();
      ptyManager = sessionManager.getPtyManager(sessionId);
    });

    afterEach(() => {
      ptyManager?.dispose();
      sessionManager.cleanup();
    });

    test("createSession creates session with ptyManager", () => {
      expect(sessionId).toBeDefined();
      expect(ptyManager).toBeDefined();
      expect(sessionManager.getSession(sessionId)).toBeDefined();
    });

    test("ptyManager creates and lists PTY processes", () => {
      if (!ptyManager) throw new Error("ptyManager is undefined");

      const processId = ptyManager.createPty("echo");
      expect(processId).toBeDefined();

      const ptys = ptyManager.getAllPtys();
      expect(ptys).toBeDefined();
      expect(ptys.length).toBe(1);
      expect(ptys[0]?.id).toBe(processId);
    });

    test("ptyManager reads output buffer", () => {
      if (!ptyManager) throw new Error("ptyManager is undefined");

      const processId = ptyManager.createPty("echo");
      if (!processId) throw new Error("Failed to create PTY");

      const pty = ptyManager.getPty(processId);
      if (!pty) throw new Error("PTY not found");

      expect(pty).toBeDefined();
      expect(typeof pty.getOutputBuffer()).toBe("string");
    });

    test("ptyManager removes PTY", () => {
      if (!ptyManager) throw new Error("ptyManager is undefined");

      const processId = ptyManager.createPty("sleep");
      if (!processId) throw new Error("Failed to create PTY");

      const removed = ptyManager.removePty(processId);
      expect(removed).toBe(true);
      expect(ptyManager.getPty(processId)).toBeUndefined();
    });

    test("ptyManager returns false when removing non-existent PTY", () => {
      if (!ptyManager) throw new Error("ptyManager is undefined");

      const removed = ptyManager.removePty("non-existent");
      expect(removed).toBe(false);
    });

    test("sessionManager counts sessions and processes", () => {
      if (!ptyManager) throw new Error("ptyManager is undefined");

      ptyManager.createPty("echo");
      ptyManager.createPty("ls");

      expect(sessionManager.getSessionCount()).toBeGreaterThan(0);
      const sessions = sessionManager.getAllSessions();
      expect(sessions.length).toBeGreaterThan(0);
    });

    test("sessionManager provides ptyManager per session", () => {
      const manager = sessionManager.getPtyManager(sessionId);
      expect(manager).toBe(ptyManager);
    });

    test("sessionManager returns undefined for non-existent session", () => {
      const manager = sessionManager.getPtyManager("non-existent");
      expect(manager).toBeUndefined();
    });
  });
});
