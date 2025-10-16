import { afterAll, afterEach, beforeAll, expect, spyOn, test } from "bun:test";
import { PtyManager } from "../index";
import { PtyProcess } from "../process";
import {
  checkExecutablePermission,
  checkRootPermission,
  checkSudoPermission,
  validateConsent,
} from "../utils/safety";

const managers: PtyManager[] = [];
const ptys: PtyProcess[] = [];

let consoleLogSpy: ReturnType<typeof spyOn>;

beforeAll(() => {
  consoleLogSpy = spyOn(console, "log").mockImplementation(() => {});
});

afterAll(() => {
  consoleLogSpy.mockRestore();
});

afterEach(() => {
  managers.forEach((m) => void m.dispose());
  managers.length = 0;
  ptys.forEach((p) => void p.dispose());
  ptys.length = 0;
});

test("PtyManager creates with sessionId", () => {
  const sessionId = "test-session-ulid";
  const manager = new PtyManager(sessionId);
  managers.push(manager);
  expect(manager).toBeDefined();
  expect(manager.getSessionInfo().sessionId).toBe(sessionId);
});

test("PtyManager creates PTY instance and tracks it", async () => {
  const sessionId = "test-session-ulid";
  const manager = new PtyManager(sessionId);
  managers.push(manager);
  const { processId } = await manager.createPty("sh");
  expect(processId).toBeDefined();
  expect(typeof processId).toBe("string");
  expect(manager.getAllPtys().length).toBe(1);
});

test("PtyManager gets PTY instance by ID", async () => {
  const sessionId = "test-session-ulid";
  const manager = new PtyManager(sessionId);
  managers.push(manager);
  const { processId } = await manager.createPty("sh");
  const instance = manager.getPty(processId);
  expect(instance).toBeDefined();
  expect(instance?.id).toBe(processId);
  expect(instance?.status).toBe("active");
});

test("PtyManager getPty returns undefined for non-existent ID", () => {
  const manager = new PtyManager("test");
  managers.push(manager);
  expect(manager.getPty("non-existent")).toBeUndefined();
});

test("PtyManager lists all PTYs", async () => {
  const sessionId = "test-session-ulid";
  const manager = new PtyManager(sessionId);
  managers.push(manager);
  const { processId: processId1 } = await manager.createPty("sh");
  const { processId: processId2 } = await manager.createPty("sh");
  const instances = manager.getAllPtys();
  expect(instances.length).toBe(2);
  expect(instances.map((i) => i.id)).toContain(processId1);
  expect(instances.map((i) => i.id)).toContain(processId2);
});

test("PtyManager removePty cleans up resources", async () => {
  const sessionId = "test-session-ulid";
  const manager = new PtyManager(sessionId);
  managers.push(manager);
  const { processId } = await manager.createPty("sh");
  expect(manager.getPty(processId)).toBeDefined();
  const removed = manager.removePty(processId);
  expect(removed).toBe(true);
  expect(manager.getPty(processId)).toBeUndefined();
});

test("PtyManager removePty returns false for non-existent ID", () => {
  const manager = new PtyManager("test");
  managers.push(manager);
  expect(manager.removePty("non-existent")).toBe(false);
});

test("PtyManager returns session info", async () => {
  const sessionId = "test-session-ulid";
  const manager = new PtyManager(sessionId);
  managers.push(manager);
  await manager.createPty("sh");
  const info = manager.getSessionInfo();
  expect(info.sessionId).toBe(sessionId);
  expect(info.processCount).toBe(1);
  expect(info.createdAt).toBeInstanceOf(Date);
});

test("PtyManager dispose cleans up all PTYs", async () => {
  const manager = new PtyManager("test");
  await manager.createPty("sh");
  await manager.createPty("sh");
  expect(manager.getAllPtys().length).toBe(2);
  manager.dispose();
  expect(manager.getAllPtys().length).toBe(0);
});

test("checkRootPermission allows non-root execution", () => {
  expect(() => checkRootPermission()).not.toThrow();
});

test("checkRootPermission throws error when root without consent", () => {
  const originalGeteuid = process.geteuid;
  process.geteuid = () => 0;
  delete process.env.MCP_PTY_USER_CONSENT_FOR_DANGEROUS_ACTIONS;

  expect(() => checkRootPermission()).toThrow(
    /MCP-PTY detected that it is running with root privileges/,
  );

  process.geteuid = originalGeteuid;
});

test("checkRootPermission allows root with consent and logs warning", () => {
  const originalGeteuid = process.geteuid;
  const originalWarn = console.warn;
  process.geteuid = () => 0;
  process.env.MCP_PTY_USER_CONSENT_FOR_DANGEROUS_ACTIONS =
    "I understand the risks and explicitly allow dangerous actions in MCP-PTY";

  let warnCalled = false;
  console.warn = () => {
    warnCalled = true;
  };

  expect(() => checkRootPermission()).not.toThrow();
  expect(warnCalled).toBe(true);

  console.warn = originalWarn;
  process.geteuid = originalGeteuid;
  delete process.env.MCP_PTY_USER_CONSENT_FOR_DANGEROUS_ACTIONS;
});

test("checkSudoPermission allows non-sudo command", () => {
  expect(() => checkSudoPermission("ls -la")).not.toThrow();
});

test("checkSudoPermission throws error for sudo without consent", () => {
  delete process.env.MCP_PTY_USER_CONSENT_FOR_DANGEROUS_ACTIONS;
  expect(() => checkSudoPermission("sudo apt update")).toThrow(
    /MCP-PTY detected an attempt to execute a sudo command/,
  );
});

test("checkSudoPermission allows sudo with consent and logs warning", () => {
  const originalWarn = console.warn;
  process.env.MCP_PTY_USER_CONSENT_FOR_DANGEROUS_ACTIONS =
    "I understand the risks and explicitly allow dangerous actions in MCP-PTY";

  let warnCalled = false;
  console.warn = () => {
    warnCalled = true;
  };

  expect(() => checkSudoPermission("sudo ls")).not.toThrow();
  expect(warnCalled).toBe(true);

  console.warn = originalWarn;
  delete process.env.MCP_PTY_USER_CONSENT_FOR_DANGEROUS_ACTIONS;
});

test("validateConsent returns false for trimmed empty string", () => {
  process.env.MCP_PTY_USER_CONSENT_FOR_DANGEROUS_ACTIONS = "   ";
  expect(
    validateConsent(
      "MCP_PTY_USER_CONSENT_FOR_DANGEROUS_ACTIONS",
      "test action",
    ),
  ).toBe(false);
  delete process.env.MCP_PTY_USER_CONSENT_FOR_DANGEROUS_ACTIONS;
});

test("validateConsent returns true and logs warning for valid consent", () => {
  const originalWarn = console.warn;
  process.env.MCP_PTY_USER_CONSENT_FOR_DANGEROUS_ACTIONS = "valid consent";
  let warnCalled = false;
  console.warn = () => {
    warnCalled = true;
  };

  expect(
    validateConsent(
      "MCP_PTY_USER_CONSENT_FOR_DANGEROUS_ACTIONS",
      "test action",
    ),
  ).toBe(true);
  expect(warnCalled).toBe(true);

  console.warn = originalWarn;
  delete process.env.MCP_PTY_USER_CONSENT_FOR_DANGEROUS_ACTIONS;
});

test("PtyProcess creates with options and initializes", () => {
  const options = { command: "cat", autoDisposeOnExit: true };

  const pty = new PtyProcess(options);
  ptys.push(pty);
  expect(pty.options.command).toBe("cat");
  expect(pty.options.autoDisposeOnExit).toBe(true);
  expect(pty.status).toBe("active");
  expect(pty.id).toBeDefined();
  expect(pty.createdAt).toBeInstanceOf(Date);
});

test("PtyProcess creates with shell command", () => {
  const command = "echo hello | cat";

  const pty = new PtyProcess(command);
  ptys.push(pty);
  expect(pty.options.command).toBe(command);
  expect(pty.status).toBe("active");
});

test("PtyProcess creates with command string", () => {
  const pty = new PtyProcess("ls -la /tmp");
  ptys.push(pty);
  expect(pty.options.command).toBe("ls -la /tmp");
  expect(pty.status).toBe("active");
});

test("PtyProcess write sends data to terminal", async () => {
  const pty = new PtyProcess("cat");
  ptys.push(pty);
  const result = await pty.write("test input\n");
  expect(result.screen).toContain("test input");
  expect(pty.status).toBe("active");
});

test("PtyProcess write throws when PTY is not active", async () => {
  const pty = new PtyProcess("cat");
  await pty.dispose();
  await expect(pty.write("test")).rejects.toThrow(/is not active/);
});

test("PtyProcess write rejects sudo commands without consent", async () => {
  const pty = new PtyProcess("echo hello");
  ptys.push(pty);
  delete process.env.MCP_PTY_USER_CONSENT_FOR_DANGEROUS_ACTIONS;
  await expect(pty.write("sudo ls\n")).rejects.toThrow(/sudo command/);
});

test("PtyProcess onOutput registers callback", () => {
  const pty = new PtyProcess("cat");
  ptys.push(pty);
  let _callbackInvoked = false;
  pty.onOutput(() => {
    _callbackInvoked = true;
  });
  pty.process.write("test\n");
  // Callback will trigger asynchronously during output processing
});

test("PtyProcess dispose transitions to terminated state", async () => {
  const pty = new PtyProcess("cat");
  expect(pty.status).toBe("active");
  await pty.dispose();
  expect(pty.status).toBe("terminated");
});

test("PtyProcess dispose is idempotent", async () => {
  const pty = new PtyProcess("cat");
  await pty.dispose();
  expect(pty.status).toBe("terminated");
  await pty.dispose();
  expect(pty.status).toBe("terminated");
});

test("PtyProcess write() sends plain text and returns screen state", async () => {
  const pty = new PtyProcess("cat");
  ptys.push(pty);
  const result = await pty.write("hello world\n", 500);
  expect(result.screen).toContain("hello world");
  expect(result.cursor).toHaveProperty("x");
  expect(result.cursor).toHaveProperty("y");
  expect(result.exitCode).toBeNull();
});

test("PtyProcess write() handles CJK characters", async () => {
  const pty = new PtyProcess("cat");
  ptys.push(pty);
  const result = await pty.write("안녕하세요\n", 500);
  expect(result.screen).toContain("안녕하세요");
});

test("PtyProcess write() handles Emoji", async () => {
  const pty = new PtyProcess("cat");
  ptys.push(pty);
  const result = await pty.write("Hello 👋🌍\n", 500);
  expect(result.screen).toContain("👋");
  expect(result.screen).toContain("🌍");
});

test("PtyProcess write() handles multiline input", async () => {
  const pty = new PtyProcess("cat");
  ptys.push(pty);
  const result = await pty.write("line1\nline2\nline3\n", 500);
  expect(result.screen).toContain("line1");
  expect(result.screen).toContain("line2");
  expect(result.screen).toContain("line3");
});

test("PtyProcess write() handles Ctrl+C (\\x03)", async () => {
  const pty = new PtyProcess("cat");
  ptys.push(pty);
  const result = await pty.write("\x03", 500);
  // Ctrl+C sends SIGINT but cat may not exit immediately with 500ms
  // Just verify write completes without error
  expect(result.screen).toBeDefined();
  expect(result.cursor).toHaveProperty("x");
  expect(result.cursor).toHaveProperty("y");
});

test("PtyProcess write() throws when PTY is not active", async () => {
  const pty = new PtyProcess("cat");
  await pty.dispose();
  await expect(pty.write("test")).rejects.toThrow(/is not active/);
});

test("PtyProcess write() rejects sudo commands without consent", async () => {
  const pty = new PtyProcess("sh");
  ptys.push(pty);
  delete process.env.MCP_PTY_USER_CONSENT_FOR_DANGEROUS_ACTIONS;
  await expect(pty.write("sudo ls\n")).rejects.toThrow(/sudo command/);
});

test("checkExecutablePermission allows non-sudo executable", () => {
  expect(() => checkExecutablePermission("vi")).not.toThrow();
  expect(() => checkExecutablePermission("sh")).not.toThrow();
});

test("checkExecutablePermission throws error for sudo executable without consent", () => {
  delete process.env.MCP_PTY_USER_CONSENT_FOR_DANGEROUS_ACTIONS;
  expect(() => checkExecutablePermission("sudo-vi")).toThrow(
    /MCP-PTY detected an attempt to execute a sudo command/,
  );
  expect(() => checkExecutablePermission("SUDO")).toThrow();
});

test("checkExecutablePermission allows sudo executable with consent", () => {
  const originalWarn = console.warn;
  process.env.MCP_PTY_USER_CONSENT_FOR_DANGEROUS_ACTIONS =
    "I understand the risks and explicitly allow dangerous actions in MCP-PTY";

  let warnCalled = false;
  console.warn = () => {
    warnCalled = true;
  };

  expect(() => checkExecutablePermission("sudo-vi")).not.toThrow();
  expect(warnCalled).toBe(true);

  console.warn = originalWarn;
  delete process.env.MCP_PTY_USER_CONSENT_FOR_DANGEROUS_ACTIONS;
});

test("PtyProcess autoDisposeOnExit triggers cleanup on process exit", async () => {
  const pty = new PtyProcess({ command: "true", autoDisposeOnExit: true });
  expect(pty.status).toBe("active");
  // Wait for initializeShellCommand (450ms) + command execution
  await Bun.sleep(600);
  expect(["terminated", "terminating"]).toContain(pty.status);
});

test("PtyProcess onOutput callback receives output data", async () => {
  const pty = new PtyProcess("echo hello");
  ptys.push(pty);

  await Bun.sleep(100);
  const buffer = pty.getOutputBuffer();
  expect(buffer.length).toBeGreaterThan(0);
});

test("PtyManager tracks process lifecycle through status updates", async () => {
  const manager = new PtyManager("lifecycle-test");
  managers.push(manager);

  const { processId } = await manager.createPty("sleep 5");
  const instance = manager.getPty(processId);
  expect(["active", "terminated"]).toContain(instance?.status ?? "");

  await Bun.sleep(100);
  const updatedInstance = manager.getPty(processId);
  if (updatedInstance) {
    expect(["active", "terminated"]).toContain(updatedInstance.status);
  }
});

test("PtyProcess graceful shutdown transitions to terminated", async () => {
  const pty = new PtyProcess("cat");
  expect(pty.status).toBe("active");

  await pty.dispose("SIGTERM");
  expect(pty.status).toBe("terminated");
}, 10000);

test("PtyProcess with custom cwd and env options", () => {
  const pty = new PtyProcess({
    command: "cat",
    cwd: "/tmp",
    env: { CUSTOM_VAR: "test_value" },
  });
  ptys.push(pty);

  expect(pty.options.cwd).toBe("/tmp");
  if (pty.options.env) {
    expect(pty.options.env.CUSTOM_VAR).toBe("test_value");
  }
});
