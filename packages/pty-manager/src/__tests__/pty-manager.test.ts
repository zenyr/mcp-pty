import { expect, test } from "bun:test";
import { PtyManager } from "../index";
import { checkRootPermission } from "../utils/safety";

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

test("checkRootPermission allows non-root execution", () => {
  // 루트가 아닌 경우 정상 동작
  expect(() => checkRootPermission()).not.toThrow();
});

test("checkRootPermission throws error when root without consent", () => {
  // 루트를 시뮬레이션하기 위해 geteuid 재할당
  const originalGeteuid = process.geteuid;
  process.geteuid = () => 0; // 루트로 설정

  // 환경 변수 없음
  delete process.env.MCP_PTY_ALLOW_ROOT;

  expect(() => checkRootPermission()).toThrow(
    /MCP-PTY detected that it is running with root privileges/
  );

  // 복원
  process.geteuid = originalGeteuid;
});

test("checkRootPermission allows root with consent", () => {
  const originalGeteuid = process.geteuid;
  process.geteuid = () => 0;

  process.env.MCP_PTY_ALLOW_ROOT =
    "I understand the risks and explicitly allow MCP-PTY to run with root privileges";

  expect(() => checkRootPermission()).not.toThrow();

  // 복원
  process.geteuid = originalGeteuid;
  delete process.env.MCP_PTY_ALLOW_ROOT;
});
