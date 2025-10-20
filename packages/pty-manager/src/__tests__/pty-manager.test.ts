import { afterAll, beforeAll, expect, spyOn, test } from "bun:test";
import { withTestPtyManager, withTestPtyProcess } from "../test-utils.ts";

let consoleLogSpy: ReturnType<typeof spyOn>;

beforeAll(() => {
  consoleLogSpy = spyOn(console, "log").mockImplementation(() => {});
});

afterAll(() => {
  consoleLogSpy.mockRestore();
});

test("PtyManager creates with sessionId", async () => {
  await withTestPtyManager("test-session-ulid", async (manager) => {
    expect(manager).toBeDefined();
    expect(manager.getSessionInfo().sessionId).toBe("test-session-ulid");
  });
});

test("PtyManager creates PTY instance and tracks it", async () => {
  await withTestPtyManager("test-session-ulid", async (manager) => {
    const { processId } = await manager.createPty("sh");
    expect(processId).toBeDefined();
    expect(typeof processId).toBe("string");
    expect(manager.getAllPtys().length).toBe(1);
  });
});

test("PtyManager gets PTY instance by ID", async () => {
  await withTestPtyManager("test-session-ulid", async (manager) => {
    const { processId } = await manager.createPty("sh");
    const instance = manager.getPty(processId);
    expect(instance).toBeDefined();
    expect(instance?.id).toBe(processId);
    expect(instance?.status).toBe("active");
  });
});

test("PtyManager getPty returns undefined for non-existent ID", async () => {
  await withTestPtyManager("test", async (manager) => {
    expect(manager.getPty("non-existent")).toBeUndefined();
  });
});

test("PtyManager lists all PTYs", async () => {
  await withTestPtyManager("test-session-ulid", async (manager) => {
    const { processId: processId1 } = await manager.createPty("sh");
    const { processId: processId2 } = await manager.createPty("sh");
    const instances = manager.getAllPtys();
    expect(instances.length).toBe(2);
    expect(instances.map((i) => i.id)).toContain(processId1);
    expect(instances.map((i) => i.id)).toContain(processId2);
  });
});

test("PtyManager removePty cleans up resources", async () => {
  await withTestPtyManager("test-session-ulid", async (manager) => {
    const { processId } = await manager.createPty("sh");
    expect(manager.getPty(processId)).toBeDefined();
    const removed = manager.removePty(processId);
    expect(removed).toBe(true);
    expect(manager.getPty(processId)).toBeUndefined();
  });
});

test("PtyManager removePty returns false for non-existent ID", async () => {
  await withTestPtyManager("test", async (manager) => {
    expect(manager.removePty("non-existent")).toBe(false);
  });
});

test("PtyManager returns session info", async () => {
  await withTestPtyManager("test-session-ulid", async (manager) => {
    await manager.createPty("sh");
    const info = manager.getSessionInfo();
    expect(info.sessionId).toBe("test-session-ulid");
    expect(info.processCount).toBe(1);
    expect(info.createdAt).toBeInstanceOf(Date);
  });
});

test("PtyManager dispose cleans up all PTYs", async () => {
  await withTestPtyManager("test", async (manager) => {
    await manager.createPty("sh");
    await manager.createPty("sh");
    expect(manager.getAllPtys().length).toBe(2);
    manager.dispose();
    expect(manager.getAllPtys().length).toBe(0);
  });
});

test("checkRootPermission allows non-root execution", async () => {
  const { checkRootPermission } = await import("../utils/safety.ts");
  expect(() => checkRootPermission()).not.toThrow();
});

test("checkRootPermission throws error when root without consent", async () => {
  const { checkRootPermission } = await import("../utils/safety.ts");
  const originalGeteuid = process.geteuid;
  process.geteuid = () => 0;
  delete process.env.MCP_PTY_USER_CONSENT_FOR_DANGEROUS_ACTIONS;

  expect(() => checkRootPermission()).toThrow(
    /MCP-PTY detected that it is running with root privileges/,
  );

  process.geteuid = originalGeteuid;
});

test("checkRootPermission allows root with consent and logs warning", async () => {
  const { checkRootPermission } = await import("../utils/safety.ts");
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

test("checkSudoPermission allows non-sudo command", async () => {
  const { checkSudoPermission } = await import("../utils/safety.ts");
  expect(() => checkSudoPermission("ls -la")).not.toThrow();
});

test("checkSudoPermission throws error for sudo without consent", async () => {
  const { checkSudoPermission } = await import("../utils/safety.ts");
  delete process.env.MCP_PTY_USER_CONSENT_FOR_DANGEROUS_ACTIONS;
  expect(() => checkSudoPermission("sudo apt update")).toThrow(
    /MCP-PTY detected an attempt to execute a sudo command/,
  );
});

test("checkSudoPermission allows sudo with consent and logs warning", async () => {
  const { checkSudoPermission } = await import("../utils/safety.ts");
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

test("validateConsent returns false for trimmed empty string", async () => {
  const { validateConsent } = await import("../utils/safety.ts");
  process.env.MCP_PTY_USER_CONSENT_FOR_DANGEROUS_ACTIONS = "   ";
  expect(
    validateConsent(
      "MCP_PTY_USER_CONSENT_FOR_DANGEROUS_ACTIONS",
      "test action",
    ),
  ).toBe(false);
  delete process.env.MCP_PTY_USER_CONSENT_FOR_DANGEROUS_ACTIONS;
});

test("validateConsent returns true and logs warning for valid consent", async () => {
  const { validateConsent } = await import("../utils/safety.ts");
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

test("PtyProcess creates with options and initializes", async () => {
  await withTestPtyProcess(
    { command: "cat", cwd: process.cwd(), autoDisposeOnExit: true },
    async (pty) => {
      expect(pty.options.command).toBe("cat");
      expect(pty.options.autoDisposeOnExit).toBe(true);
      expect(pty.status).toBe("active");
      expect(pty.id).toBeDefined();
      expect(pty.createdAt).toBeInstanceOf(Date);
    },
  );
});

test("PtyProcess creates with shell command", async () => {
  await withTestPtyProcess("echo hello | cat", async (pty) => {
    expect(pty.options.command).toBe("echo hello | cat");
    expect(pty.status).toBe("active");
  });
});

test("PtyProcess creates with command string", async () => {
  await withTestPtyProcess("ls -la /tmp", async (pty) => {
    expect(pty.options.command).toBe("ls -la /tmp");
    expect(pty.status).toBe("active");
  });
});

test("PtyProcess write sends data to terminal", async () => {
  await withTestPtyProcess("cat", async (pty) => {
    const result = await pty.write("test input\n");
    expect(result.screen).toContain("test input");
    expect(pty.status).toBe("active");
  });
});

test("PtyProcess write throws when PTY is not active", async () => {
  await withTestPtyProcess("cat", async (pty) => {
    await pty.dispose();
    await expect(pty.write("test")).rejects.toThrow(/is not active/);
  });
});

test("PtyProcess write rejects sudo commands without consent", async () => {
  await withTestPtyProcess("echo hello", async (pty) => {
    delete process.env.MCP_PTY_USER_CONSENT_FOR_DANGEROUS_ACTIONS;
    await expect(pty.write("sudo ls\n")).rejects.toThrow(/sudo command/);
  });
});

test("PtyProcess onOutput registers callback", async () => {
  await withTestPtyProcess("cat", async (pty) => {
    pty.onOutput(() => {
      // callback test
    });
    await pty.write("test\n");
    // Just ensure no errors occur
  });
});

test("PtyProcess dispose transitions to terminated state", async () => {
  await withTestPtyProcess("cat", async (pty) => {
    expect(pty.status).toBe("active");
    await pty.dispose();
    expect(pty.status).toBe("terminated");
  });
});

test("PtyProcess dispose is idempotent", async () => {
  await withTestPtyProcess("cat", async (pty) => {
    await pty.dispose();
    expect(pty.status).toBe("terminated");
    await pty.dispose();
    expect(pty.status).toBe("terminated");
  });
});

test("PtyProcess write() sends plain text and returns screen state", async () => {
  await withTestPtyProcess("cat", async (pty) => {
    const result = await pty.write("hello world\n", 500);
    expect(result.screen).toContain("hello world");
    expect(result.cursor).toHaveProperty("x");
    expect(result.cursor).toHaveProperty("y");
    expect(result.exitCode).toBeNull();
  });
});

test("PtyProcess write() handles CJK characters", async () => {
  await withTestPtyProcess("cat", async (pty) => {
    const result = await pty.write("안녕하세요\n", 500);
    expect(result.screen).toContain("안녕하세요");
  });
});

test("PtyProcess write() handles Emoji", async () => {
  await withTestPtyProcess("cat", async (pty) => {
    const result = await pty.write("Hello 👋🌍\n", 500);
    expect(result.screen).toContain("👋");
    expect(result.screen).toContain("🌍");
  });
});

test("PtyProcess write() handles multiline input", async () => {
  await withTestPtyProcess("cat", async (pty) => {
    const result = await pty.write("line1\nline2\nline3\n", 500);
    expect(result.screen).toContain("line1");
    expect(result.screen).toContain("line2");
    expect(result.screen).toContain("line3");
  });
});

test("PtyProcess write() handles Ctrl+C (\\x03)", async () => {
  await withTestPtyProcess("cat", async (pty) => {
    const result = await pty.write("\x03", 500);
    expect(result.screen).toBeDefined();
    expect(result.cursor).toHaveProperty("x");
    expect(result.cursor).toHaveProperty("y");
  });
});

test("PtyProcess write() throws when PTY is not active", async () => {
  await withTestPtyProcess("cat", async (pty) => {
    await pty.dispose();
    await expect(pty.write("test")).rejects.toThrow(/is not active/);
  });
});

test("PtyProcess write() rejects sudo commands without consent", async () => {
  await withTestPtyProcess("sh", async (pty) => {
    delete process.env.MCP_PTY_USER_CONSENT_FOR_DANGEROUS_ACTIONS;
    await expect(pty.write("sudo ls\n")).rejects.toThrow(/sudo command/);
  });
});

test("checkExecutablePermission allows non-sudo executable", async () => {
  const { checkExecutablePermission } = await import("../utils/safety.ts");
  expect(() => checkExecutablePermission("vi")).not.toThrow();
  expect(() => checkExecutablePermission("sh")).not.toThrow();
});

test("checkExecutablePermission throws error for sudo executable without consent", async () => {
  const { checkExecutablePermission } = await import("../utils/safety.ts");
  delete process.env.MCP_PTY_USER_CONSENT_FOR_DANGEROUS_ACTIONS;
  expect(() => checkExecutablePermission("sudo")).toThrow(
    /MCP-PTY detected an attempt to execute a sudo command/,
  );
  expect(() => checkExecutablePermission("/usr/bin/sudo")).toThrow();
});

test("checkExecutablePermission allows sudo executable with consent", async () => {
  const { checkExecutablePermission } = await import("../utils/safety.ts");
  const originalWarn = console.warn;
  process.env.MCP_PTY_USER_CONSENT_FOR_DANGEROUS_ACTIONS =
    "I understand the risks and explicitly allow dangerous actions in MCP-PTY";

  let warnCalled = false;
  console.warn = () => {
    warnCalled = true;
  };

  expect(() => checkExecutablePermission("sudo")).not.toThrow();
  expect(warnCalled).toBe(true);

  console.warn = originalWarn;
  delete process.env.MCP_PTY_USER_CONSENT_FOR_DANGEROUS_ACTIONS;
});

test("PtyProcess autoDisposeOnExit triggers cleanup on process exit", async () => {
  await withTestPtyProcess(
    { command: "true", cwd: process.cwd(), autoDisposeOnExit: true },
    async (pty) => {
      expect(pty.status).toBe("active");
      await Bun.sleep(50);
      expect(["terminated", "terminating"]).toContain(pty.status);
    },
  );
});

test("PtyProcess onOutput callback receives output data", async () => {
  await withTestPtyProcess("echo hello", async (pty) => {
    await Bun.sleep(10);
    const buffer = pty.getOutputBuffer();
    expect(buffer.length).toBeGreaterThan(0);
  });
});

test("PtyManager tracks process lifecycle through status updates", async () => {
  await withTestPtyManager("lifecycle-test", async (manager) => {
    const { processId } = await manager.createPty("sleep 0.05");
    const instance = manager.getPty(processId);
    expect(["active", "terminated"]).toContain(instance?.status ?? "");

    await Bun.sleep(10);
    const updatedInstance = manager.getPty(processId);
    if (updatedInstance) {
      expect(["active", "terminated"]).toContain(updatedInstance.status);
    }
  });
});

test("PtyProcess graceful shutdown transitions to terminated", async () => {
  await withTestPtyProcess("cat", async (pty) => {
    expect(pty.status).toBe("active");
    await pty.dispose("SIGTERM");
    expect(pty.status).toBe("terminated");
  });
}, 10000);

test("PtyProcess with custom cwd and env options", async () => {
  await withTestPtyProcess(
    { command: "cat", cwd: "/tmp", env: { CUSTOM_VAR: "test_value" } },
    async (pty) => {
      expect(pty.options.cwd).toBe("/tmp");
      if (pty.options.env) {
        expect(pty.options.env.CUSTOM_VAR).toBe("test_value");
      }
    },
  );
});
