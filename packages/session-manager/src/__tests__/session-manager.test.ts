import { describe, it, expect, beforeEach } from "bun:test";
import { SessionManager } from "../index.ts";

describe("SessionManager", () => {
  let manager: SessionManager;

  beforeEach(() => {
    manager = new SessionManager();
  });

  it("should create a new session", () => {
    const sessionId = manager.createSession();
    expect(sessionId).toBeDefined();
    expect(typeof sessionId).toBe("string");
    expect(sessionId.length).toBeGreaterThan(0);
  });

  it("should get a session by id", () => {
    const sessionId = manager.createSession();
    const session = manager.getSession(sessionId);
    expect(session).toBeDefined();
    expect(session?.id).toBe(sessionId);
    expect(session?.status).toBe("initializing");
  });

  it("should return undefined for non-existent session", () => {
    const session = manager.getSession("non-existent");
    expect(session).toBeUndefined();
  });

  it("should update session status", () => {
    const sessionId = manager.createSession();
    const success = manager.updateStatus(sessionId, "active");
    expect(success).toBe(true);

    const session = manager.getSession(sessionId);
    expect(session?.status).toBe("active");
  });

  it("should not update status for non-existent session", () => {
    const success = manager.updateStatus("non-existent", "active");
    expect(success).toBe(false);
  });

  it("should add PTY to session", () => {
    const sessionId = manager.createSession();
    const processId = "test-process-1";

    const success = manager.addPty(sessionId, processId);
    expect(success).toBe(true);

    const session = manager.getSession(sessionId);
    expect(session?.ptyInstances.has(processId)).toBe(true);
  });

  it("should remove PTY from session", () => {
    const sessionId = manager.createSession();
    const processId = "test-process-1";

    manager.addPty(sessionId, processId);
    const success = manager.removePty(sessionId, processId);
    expect(success).toBe(true);

    const session = manager.getSession(sessionId);
    expect(session?.ptyInstances.has(processId)).toBe(false);
  });

  it("should delete a session", () => {
    const sessionId = manager.createSession();
    const success = manager.deleteSession(sessionId);
    expect(success).toBe(true);

    const session = manager.getSession(sessionId);
    expect(session).toBeUndefined();
  });

  it("should not delete non-existent session", () => {
    const success = manager.deleteSession("non-existent");
    expect(success).toBe(false);
  });

  it("should get all sessions", () => {
    const id1 = manager.createSession();
    const id2 = manager.createSession();
    const sessions = manager.getAllSessions();

    expect(sessions.length).toBe(2);
    expect(sessions.map((s) => s.id)).toContain(id1);
    expect(sessions.map((s) => s.id)).toContain(id2);
  });

  it("should count sessions", () => {
    expect(manager.getSessionCount()).toBe(0);
    manager.createSession();
    expect(manager.getSessionCount()).toBe(1);
  });

  it("should terminate a session", () => {
    const sessionId = manager.createSession();
    const success = manager.terminateSession(sessionId);
    expect(success).toBe(true);

    const session = manager.getSession(sessionId);
    expect(session?.status).toBe("terminated");
  });

  it("should monitor idle sessions", () => {
    const sessionId = manager.createSession();
    manager.updateStatus(sessionId, "idle");

    // lastActivity를 과거로 설정
    const session = manager.getSession(sessionId);
    if (session) {
      session.lastActivity = new Date(Date.now() - 6 * 60 * 1000); // 6분 전
    }

    manager.monitorIdleSessions();

    const updatedSession = manager.getSession(sessionId);
    expect(updatedSession?.status).toBe("terminated");
  });

  it("should start and stop monitoring", () => {
    manager.startMonitoring();
    expect(manager["monitorInterval"]).toBeDefined();

    manager.stopMonitoring();
    expect(manager["monitorInterval"]).toBeUndefined();
  });

  it("should cleanup all sessions", () => {
    manager.createSession();
    manager.createSession();

    manager.cleanup();

    expect(manager.getSessionCount()).toBe(0);
    expect(manager["monitorInterval"]).toBeUndefined();
  });
});
