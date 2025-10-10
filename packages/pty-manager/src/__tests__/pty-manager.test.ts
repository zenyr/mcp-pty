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
  expect(manager.getSession().sessionId).toBe(sessionId);
});

test("PtyManager creates PTY instance and tracks it", () => {
  const sessionId = "test-session-ulid";
  const manager = new PtyManager(sessionId);
  managers.push(manager);
  const processId = manager.createPty("sh");
  expect(processId).toBeDefined();
  expect(typeof processId).toBe("string");
  expect(manager.getAllPtys().length).toBe(1);
});

test("PtyManager gets PTY instance by ID", () => {
  const sessionId = "test-session-ulid";
  const manager = new PtyManager(sessionId);
  managers.push(manager);
  const processId = manager.createPty("sh");
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

test("PtyManager lists all PTYs", () => {
  const sessionId = "test-session-ulid";
  const manager = new PtyManager(sessionId);
  managers.push(manager);
  const processId1 = manager.createPty("sh");
  const processId2 = manager.createPty("sh");
  const instances = manager.getAllPtys();
  expect(instances.length).toBe(2);
  expect(instances.map((i) => i.id)).toContain(processId1);
  expect(instances.map((i) => i.id)).toContain(processId2);
});

test("PtyManager removePty cleans up resources", () => {
  const sessionId = "test-session-ulid";
  const manager = new PtyManager(sessionId);
  managers.push(manager);
  const processId = manager.createPty("sh");
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

test("PtyManager returns session info with instances Map", () => {
  const sessionId = "test-session-ulid";
  const manager = new PtyManager(sessionId);
  managers.push(manager);
  manager.createPty("sh");
  const session = manager.getSession();
  expect(session.sessionId).toBe(sessionId);
  expect(session.instances).toBeDefined();
  expect(session.instances.size).toBe(1);
});

test("PtyManager dispose cleans up all PTYs", () => {
  const manager = new PtyManager("test");
  manager.createPty("sh");
  manager.createPty("sh");
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
  const options = { executable: "cat", args: [], autoDisposeOnExit: true };

  const pty = new PtyProcess(options);
  ptys.push(pty);
  expect(pty.options.executable).toBe("cat");
  expect(pty.options.args).toEqual([]);
  expect(pty.options.autoDisposeOnExit).toBe(true);
  expect(pty.status).toBe("active");
  expect(pty.id).toBeDefined();
  expect(pty.createdAt).toBeInstanceOf(Date);
});

test("PtyProcess writeInput sends data to terminal", () => {
  const pty = new PtyProcess({ executable: "cat" });
  ptys.push(pty);
  expect(() => pty.writeInput("test input")).not.toThrow();
  expect(pty.status).toBe("active");
});

test("PtyProcess writeInput throws when PTY is not active", async () => {
  const pty = new PtyProcess({ executable: "cat" });
  await pty.dispose();
  expect(() => pty.writeInput("test")).toThrow(/is not active/);
});

test("PtyProcess writeInput rejects sudo commands without consent", () => {
  const pty = new PtyProcess({ executable: "sh" });
  ptys.push(pty);
  delete process.env.MCP_PTY_USER_CONSENT_FOR_DANGEROUS_ACTIONS;
  expect(() => pty.writeInput("sudo ls")).toThrow(/sudo command/);
});

test("PtyProcess onOutput registers callback", () => {
  const pty = new PtyProcess({ executable: "cat" });
  ptys.push(pty);
  let callbackFired = false;
  pty.onOutput(() => {
    callbackFired = true;
  });
  expect(callbackFired).toBe(false);
});

test("PtyProcess dispose transitions to terminated state", async () => {
  const pty = new PtyProcess({ executable: "cat" });
  expect(pty.status).toBe("active");
  await pty.dispose();
  expect(pty.status).toBe("terminated");
});

test("PtyProcess dispose is idempotent", async () => {
  const pty = new PtyProcess({ executable: "cat" });
  await pty.dispose();
  expect(pty.status).toBe("terminated");
  await pty.dispose();
  expect(pty.status).toBe("terminated");
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
  const pty = new PtyProcess({
    executable: "echo",
    args: ["test"],
    autoDisposeOnExit: true,
  });
  expect(pty.status).toBe("active");
  await new Promise((resolve) => setTimeout(resolve, 100));
  expect(["terminated", "terminating"]).toContain(pty.status);
});

test("PtyProcess onOutput callback receives output data", async () => {
  const pty = new PtyProcess({ executable: "echo", args: ["hello"] });
  ptys.push(pty);

  const outputs: string[] = [];
  pty.onOutput((output) => {
    outputs.push(output.output);
  });

  await new Promise((resolve) => setTimeout(resolve, 100));
  expect(outputs.length).toBeGreaterThan(0);
  expect(outputs.some((o) => o.includes("hello"))).toBe(true);
});

test("PtyManager tracks process lifecycle through status updates", async () => {
  const manager = new PtyManager("lifecycle-test");
  managers.push(manager);

  const processId = manager.createPty("echo");
  const instance = manager.getPty(processId);
  expect(instance?.status).toBe("active");

  await new Promise((resolve) => setTimeout(resolve, 100));
  const updatedInstance = manager.getPty(processId);
  if (updatedInstance) {
    expect(["active", "terminated"]).toContain(updatedInstance.status);
  }
});

test("PtyProcess graceful shutdown transitions to terminated", async () => {
  const pty = new PtyProcess({ executable: "cat" });
  expect(pty.status).toBe("active");

  await pty.dispose("SIGTERM");
  expect(pty.status).toBe("terminated");
}, 10000);

test("PtyProcess with custom cwd and env options", () => {
  const pty = new PtyProcess({
    executable: "pwd",
    cwd: "/tmp",
    env: { CUSTOM_VAR: "test_value" },
  });
  ptys.push(pty);

  expect(pty.options.cwd).toBe("/tmp");
  if (pty.options.env) {
    expect(pty.options.env.CUSTOM_VAR).toBe("test_value");
  }
});
