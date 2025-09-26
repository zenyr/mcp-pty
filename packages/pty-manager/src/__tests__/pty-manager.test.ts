import { test, expect } from "bun:test";
import { PtyManager } from "../index";

test("PtyManager creates with sessionId", () => {
  const sessionId = "test-session-ulid";
  const manager = new PtyManager(sessionId);
  expect(manager).toBeDefined();
});

test("PtyManager creates PTY instance", () => {
  const sessionId = "test-session-ulid";
  const manager = new PtyManager(sessionId);
  const processId = manager.createPty();
  expect(processId).toBeDefined();
  expect(typeof processId).toBe("string");
});

test("PtyManager gets PTY instance", () => {
  const sessionId = "test-session-ulid";
  const manager = new PtyManager(sessionId);
  const processId = manager.createPty();
  const instance = manager.getPty(processId);
  expect(instance).toBeDefined();
  expect(instance?.id).toBe(processId);
});

test("PtyManager lists all PTYs", () => {
  const sessionId = "test-session-ulid";
  const manager = new PtyManager(sessionId);
  const processId1 = manager.createPty();
  const processId2 = manager.createPty();
  const instances = manager.getAllPtys();
  expect(instances.length).toBe(2);
  expect(instances.map((i) => i.id)).toContain(processId1);
  expect(instances.map((i) => i.id)).toContain(processId2);
});

test("PtyManager removes PTY instance", () => {
  const sessionId = "test-session-ulid";
  const manager = new PtyManager(sessionId);
  const processId = manager.createPty();
  expect(manager.getPty(processId)).toBeDefined();
  const removed = manager.removePty(processId);
  expect(removed).toBe(true);
  expect(manager.getPty(processId)).toBeUndefined();
});

test("PtyManager returns session info", () => {
  const sessionId = "test-session-ulid";
  const manager = new PtyManager(sessionId);
  const session = manager.getSession();
  expect(session.sessionId).toBe(sessionId);
  expect(session.instances).toBeDefined();
});
