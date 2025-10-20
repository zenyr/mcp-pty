import { describe, expect, it } from "bun:test";
import { withTestSessionManager } from "../test-utils.ts";

describe("SessionManager", () => {
  it("should create a new session", async () => {
    await withTestSessionManager(async (manager) => {
      const sessionId = manager.createSession();
      expect(sessionId).toBeDefined();
      expect(typeof sessionId).toBe("string");
      expect(sessionId.length).toBeGreaterThan(0);
    });
  });

  it("should get a session by id", async () => {
    await withTestSessionManager(async (manager) => {
      const sessionId = manager.createSession();
      const session = manager.getSession(sessionId);
      expect(session).toBeDefined();
      expect(session?.id).toBe(sessionId);
      expect(session?.status).toBe("initializing");
    });
  });

  it("should return undefined for non-existent session", async () => {
    await withTestSessionManager(async (manager) => {
      const session = manager.getSession("non-existent");
      expect(session).toBeUndefined();
    });
  });

  it("should update session status", async () => {
    await withTestSessionManager(async (manager) => {
      const sessionId = manager.createSession();
      const success = manager.updateStatus(sessionId, "active");
      expect(success).toBe(true);

      const session = manager.getSession(sessionId);
      expect(session?.status).toBe("active");
    });
  });

  it("should not update status for non-existent session", async () => {
    await withTestSessionManager(async (manager) => {
      const success = manager.updateStatus("non-existent", "active");
      expect(success).toBe(false);
    });
  });

  it("should add PTY to session", async () => {
    await withTestSessionManager(async (manager) => {
      const sessionId = manager.createSession();
      const processId = "test-process-1";

      const success = manager.addPty(sessionId, processId);
      expect(success).toBe(true);

      const session = manager.getSession(sessionId);
      expect(session?.ptyInstances.has(processId)).toBe(true);
    });
  });

  it("should remove PTY from session", async () => {
    await withTestSessionManager(async (manager) => {
      const sessionId = manager.createSession();
      const processId = "test-process-1";

      manager.addPty(sessionId, processId);
      const success = manager.removePty(sessionId, processId);
      expect(success).toBe(true);

      const session = manager.getSession(sessionId);
      expect(session?.ptyInstances.has(processId)).toBe(false);
    });
  });

  it("should delete a session", async () => {
    await withTestSessionManager(async (manager) => {
      const sessionId = manager.createSession();
      const success = manager.deleteSession(sessionId);
      expect(success).toBe(true);

      const session = manager.getSession(sessionId);
      expect(session).toBeUndefined();
    });
  });

  it("should not delete non-existent session", async () => {
    await withTestSessionManager(async (manager) => {
      const success = manager.deleteSession("non-existent");
      expect(success).toBe(false);
    });
  });

  it("should get all sessions", async () => {
    await withTestSessionManager(async (manager) => {
      const id1 = manager.createSession();
      const id2 = manager.createSession();
      const sessions = manager.getAllSessions();

      expect(sessions.length).toBe(2);
      expect(sessions.map((s) => s.id)).toContain(id1);
      expect(sessions.map((s) => s.id)).toContain(id2);
    });
  });

  it("should count sessions", async () => {
    await withTestSessionManager(async (manager) => {
      expect(manager.getSessionCount()).toBe(0);
      manager.createSession();
      expect(manager.getSessionCount()).toBe(1);
    });
  });

  it("should terminate a session forcefully", async () => {
    await withTestSessionManager(async (manager) => {
      const sessionId = manager.createSession();
      const success = manager.terminateSession(sessionId);
      expect(success).toBe(true);

      const session = manager.getSession(sessionId);
      expect(session).toBeUndefined();
    });
  });

  it("should dispose a session gracefully", async () => {
    await withTestSessionManager(async (manager) => {
      const sessionId = manager.createSession();
      const success = await manager.disposeSession(sessionId);
      expect(success).toBe(true);

      const session = manager.getSession(sessionId);
      expect(session).toBeUndefined();
    });
  });

  it("should monitor idle sessions", async () => {
    await withTestSessionManager(async (manager) => {
      const sessionId = manager.createSession();
      manager.updateStatus(sessionId, "idle");

      const session = manager.getSession(sessionId);
      if (session) {
        session.lastActivity = new Date(Date.now() - 6 * 60 * 1000);
      }

      manager.monitorIdleSessions();
      await Bun.sleep(100);

      const updatedSession = manager.getSession(sessionId);
      expect(updatedSession).toBeUndefined();
    });
  });

  it("should start and stop monitoring", async () => {
    await withTestSessionManager(async (manager) => {
      manager.startMonitoring();
      manager.stopMonitoring();
      // No assertions needed - just ensure no errors
    });
  });

  it("should dispose all sessions individually", async () => {
    await withTestSessionManager(async (manager) => {
      const id1 = manager.createSession();
      const id2 = manager.createSession();

      await manager.disposeSession(id1);
      await manager.disposeSession(id2);

      expect(manager.getSessionCount()).toBe(0);
    });
  });
});
