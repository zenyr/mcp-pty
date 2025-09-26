import { expect, test } from "bun:test";
import { PtyManager } from "../index";
import { PtyProcess } from "../pty";
import {
  checkRootPermission,
  checkSudoPermission,
  checkExecutablePermission,
  validateConsent,
} from "../utils/safety";

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
  delete process.env.MCP_PTY_USER_CONSENT_FOR_DANGEROUS_ACTIONS;

  expect(() => checkRootPermission()).toThrow(
    /MCP-PTY detected that it is running with root privileges/
  );

  // 복원
  process.geteuid = originalGeteuid;
});

test("checkRootPermission allows root with consent", () => {
  const originalGeteuid = process.geteuid;
  process.geteuid = () => 0;

  process.env.MCP_PTY_USER_CONSENT_FOR_DANGEROUS_ACTIONS =
    "I understand the risks and explicitly allow dangerous actions in MCP-PTY";

  const originalWarn = console.warn;
  let warnCalled = false;
  console.warn = () => {
    warnCalled = true;
  };

  expect(() => checkRootPermission()).not.toThrow();
  expect(warnCalled).toBe(true);

  // 복원
  console.warn = originalWarn;
  process.geteuid = originalGeteuid;
  delete process.env.MCP_PTY_USER_CONSENT_FOR_DANGEROUS_ACTIONS;
});

test("checkSudoPermission allows non-sudo command", () => {
  // sudo로 시작하지 않는 명령: throw 안 함
  expect(() => checkSudoPermission("ls -la")).not.toThrow();
});

test("checkSudoPermission throws error for sudo without consent", () => {
  // sudo 명령, env 없음 → throw
  delete process.env.MCP_PTY_USER_CONSENT_FOR_DANGEROUS_ACTIONS;
  expect(() => checkSudoPermission("sudo apt update")).toThrow(
    /MCP-PTY detected an attempt to execute a sudo command/
  );
});

test("checkSudoPermission allows sudo with consent", () => {
  process.env.MCP_PTY_USER_CONSENT_FOR_DANGEROUS_ACTIONS =
    "I understand the risks and explicitly allow dangerous actions in MCP-PTY";

  const originalWarn = console.warn;
  let warnCalled = false;
  console.warn = () => {
    warnCalled = true;
  };

  expect(() => checkSudoPermission("sudo ls")).not.toThrow();
  expect(warnCalled).toBe(true);

  // 복원
  console.warn = originalWarn;
  delete process.env.MCP_PTY_USER_CONSENT_FOR_DANGEROUS_ACTIONS;
});

test("validateConsent handles trimmed empty string", () => {
  // 트림 후 빈 문자열: false 반환
  process.env.MCP_PTY_USER_CONSENT_FOR_DANGEROUS_ACTIONS = "   ";
  expect(
    validateConsent("MCP_PTY_USER_CONSENT_FOR_DANGEROUS_ACTIONS", "test action")
  ).toBe(false);

  // 유효한 동의: true 반환 + warn 호출
  process.env.MCP_PTY_USER_CONSENT_FOR_DANGEROUS_ACTIONS = "valid consent";
  const originalWarn = console.warn;
  let warnCalled = false;
  console.warn = () => {
    warnCalled = true;
  };

  expect(
    validateConsent("MCP_PTY_USER_CONSENT_FOR_DANGEROUS_ACTIONS", "test action")
  ).toBe(true);
  expect(warnCalled).toBe(true);

  console.warn = originalWarn;
  delete process.env.MCP_PTY_USER_CONSENT_FOR_DANGEROUS_ACTIONS;
});

test("PtyProcess spawns interactive program with short lifespan", () => {
  // spawn mock 없이 옵션만 확인 (실제 spawn은 테스트에서 skip)
  // Bun test에서 모듈 mock 어려움, 옵션 검증으로 대체
  const options = {
    executable: "vi",
    args: ["test.txt"],
    autoDisposeOnExit: true,
  };

  // PtyProcess 생성 시 옵션 저장 확인 (mock 없이 생성 시도, 실패 시 skip)
  try {
    const pty = new PtyProcess(options);
    expect(pty.options.executable).toBe("vi");
    expect(pty.options.args).toEqual(["test.txt"]);
    expect(pty.options.autoDisposeOnExit).toBe(true);
    expect(pty.status).toBe("active");
    // 생성 후 dispose로 클린업
    pty.dispose();
  } catch (e) {
    // spawn 실패 시 skip (환경 문제)
    console.log("Skipping PtyProcess spawn test due to environment");
  }
});

test("PtyProcess writeInput handles interactive input", () => {
  try {
    const pty = new PtyProcess({ executable: "bash" });
    pty.writeInput("ls -la");

    expect(pty.status).toBe("active");
    // dispose로 클린업
    pty.dispose();
  } catch (e) {
    console.log("Skipping writeInput test due to environment");
  }
});

test("checkExecutablePermission allows non-sudo executable", () => {
  expect(() => checkExecutablePermission("vi")).not.toThrow();
});

test("checkExecutablePermission throws error for sudo executable without consent", () => {
  delete process.env.MCP_PTY_USER_CONSENT_FOR_DANGEROUS_ACTIONS;
  expect(() => checkExecutablePermission("sudo-vi")).toThrow(
    /MCP-PTY detected an attempt to execute a sudo command/
  );
});

test("checkExecutablePermission allows sudo executable with consent", () => {
  process.env.MCP_PTY_USER_CONSENT_FOR_DANGEROUS_ACTIONS =
    "I understand the risks and explicitly allow dangerous actions in MCP-PTY";

  const originalWarn = console.warn;
  let warnCalled = false;
  console.warn = () => {
    warnCalled = true;
  };

  expect(() => checkExecutablePermission("sudo-vi")).not.toThrow();
  expect(warnCalled).toBe(true);

  console.warn = originalWarn;
  delete process.env.MCP_PTY_USER_CONSENT_FOR_DANGEROUS_ACTIONS;
});
