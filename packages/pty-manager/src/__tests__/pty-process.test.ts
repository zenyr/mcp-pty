import { afterAll, afterEach, beforeAll, expect, spyOn, test } from "bun:test";
import { consola } from "consola";
import stripAnsi from "strip-ansi";
import { PtyProcess } from "../process";

const ptys: PtyProcess[] = [];

let consoleLogSpy: ReturnType<typeof spyOn>;

beforeAll(() => {
  // Suppress logs in test environment
  consola.level = 999;
  consoleLogSpy = spyOn(console, "log").mockImplementation(() => {});
});

afterAll(() => {
  consoleLogSpy.mockRestore();
});

afterEach(() => {
  ptys.forEach((p) => void p.dispose());
  ptys.length = 0;
});

// ============================================================================
// Basic PTY Tests
// ============================================================================

test("PtyProcess creates with command string", async () => {
  const pty = new PtyProcess("echo hello");
  ptys.push(pty);
  await pty.ready();
  expect(pty.id).toBeDefined();
  expect(pty.status).toBe("active");
  expect(pty.options.command).toBe("echo hello");
});

test("PtyProcess creates with options object", async () => {
  const pty = new PtyProcess({
    command: "cat",
    cwd: "/tmp",
    env: { TEST_VAR: "test_value" },
  });
  ptys.push(pty);
  await pty.ready();
  expect(pty.options.command).toBe("cat");
  expect(pty.options.cwd).toBe("/tmp");
  expect(pty.options.env?.TEST_VAR).toBe("test_value");
});

test("PtyProcess basic echo command", async () => {
  const pty = new PtyProcess("echo hello");
  ptys.push(pty);
  const output = await pty.toPromise();
  expect(output).toContain("hello");
});

// ============================================================================
// Subscribe Pattern Tests
// ============================================================================

test("PtyProcess subscribe receives data", async () => {
  const pty = new PtyProcess("echo test");
  ptys.push(pty);
  await pty.ready();

  return new Promise<void>((resolve) => {
    let receivedData = false;
    const sub = pty.subscribe({
      onData: (data) => {
        if (data.includes("test")) {
          receivedData = true;
        }
      },
      onError: () => {},
      onComplete: () => {
        expect(receivedData).toBe(true);
        sub.unsubscribe();
        resolve();
      },
    });
  });
});

test("PtyProcess subscribe unsubscribe works", async () => {
  const pty = new PtyProcess("sleep 1");
  ptys.push(pty);
  await pty.ready();

  let dataCount = 0;
  const sub = pty.subscribe({
    onData: () => {
      dataCount++;
    },
    onError: () => {},
    onComplete: () => {},
  });

  sub.unsubscribe();
  await Bun.sleep(100);

  // After unsubscribe, dataCount should not increase
  const countAfterUnsub = dataCount;
  await Bun.sleep(200);
  expect(dataCount).toBe(countAfterUnsub);
});

test("PtyProcess multiple subscribers", async () => {
  const pty = new PtyProcess("echo multi");
  ptys.push(pty);
  await pty.ready();

  return new Promise<void>((resolve) => {
    let sub1Called = false;
    let sub2Called = false;

    const sub1 = pty.subscribe({
      onData: (data) => {
        if (data.includes("multi")) {
          sub1Called = true;
        }
      },
      onError: () => {},
      onComplete: () => {},
    });

    const sub2 = pty.subscribe({
      onData: (data) => {
        if (data.includes("multi")) {
          sub2Called = true;
        }
      },
      onError: () => {},
      onComplete: () => {
        expect(sub1Called).toBe(true);
        expect(sub2Called).toBe(true);
        sub1.unsubscribe();
        sub2.unsubscribe();
        resolve();
      },
    });
  });
});

// ============================================================================
// Write Method Tests
// ============================================================================

test("PtyProcess write plain text", async () => {
  const pty = new PtyProcess("cat");
  ptys.push(pty);
  await pty.ready();

  const result = await pty.write("hello world\n", 500);
  expect(result.screen).toContain("hello world");
  expect(result.cursor).toHaveProperty("x");
  expect(result.cursor).toHaveProperty("y");
  expect(result.exitCode).toBeNull();
});

test("PtyProcess write CJK characters", async () => {
  const pty = new PtyProcess("cat");
  ptys.push(pty);
  await pty.ready();

  const result = await pty.write("안녕하세요 こんにちは 你好\n", 500);
  expect(result.screen).toContain("안녕하세요");
  expect(result.screen).toContain("こんにちは");
  expect(result.screen).toContain("你好");
});

test("PtyProcess write emoji", async () => {
  const pty = new PtyProcess("cat");
  ptys.push(pty);
  await pty.ready();

  const result = await pty.write("Hello 👋 World 🌍\n", 500);
  expect(result.screen).toContain("👋");
  expect(result.screen).toContain("🌍");
});

test("PtyProcess write multiline input", async () => {
  const pty = new PtyProcess("cat");
  ptys.push(pty);
  await pty.ready();

  const result = await pty.write("line1\nline2\nline3\n", 500);
  expect(result.screen).toContain("line1");
  expect(result.screen).toContain("line2");
  expect(result.screen).toContain("line3");
});

test("PtyProcess write control characters", async () => {
  const pty = new PtyProcess("cat");
  ptys.push(pty);
  await pty.ready();

  // Write and then Ctrl+C
  const result = await pty.write("\x03", 500);
  expect(result.screen).toBeDefined();
  expect(result.cursor).toHaveProperty("x");
});

// ============================================================================
// Buffer Capture Tests
// ============================================================================

test("PtyProcess captureBuffer returns array of lines", async () => {
  const pty = new PtyProcess("echo test");
  ptys.push(pty);
  await pty.ready();
  await Bun.sleep(200);

  const buffer = pty.captureBuffer();
  expect(Array.isArray(buffer)).toBe(true);
  expect(buffer.length).toBeGreaterThan(0);
});

test("PtyProcess getOutputBuffer accumulates output", async () => {
  const pty = new PtyProcess("echo accumulate");
  ptys.push(pty);
  await pty.ready();
  await Bun.sleep(200);

  const output = pty.getOutputBuffer();
  expect(output.length).toBeGreaterThan(0);
  expect(output).toContain("accumulate");
});

// ============================================================================
// Terminal Resize Tests
// ============================================================================

test("PtyProcess resize changes terminal dimensions", async () => {
  const pty = new PtyProcess("cat");
  ptys.push(pty);
  await pty.ready();

  expect(pty.terminal.cols).toBe(80);
  expect(pty.terminal.rows).toBe(24);

  pty.resize(120, 40);
  expect(pty.terminal.cols).toBe(120);
  expect(pty.terminal.rows).toBe(40);
});

test("PtyProcess resize throws when not active", async () => {
  const pty = new PtyProcess("cat");
  await pty.ready();
  await pty.dispose();

  expect(() => pty.resize(100, 30)).toThrow(/is not active/);
});

// ============================================================================
// Exit Code Tests
// ============================================================================

test("PtyProcess getExitCode returns null while running", async () => {
  const pty = new PtyProcess("sleep 1");
  ptys.push(pty);
  await pty.ready();

  expect(pty.getExitCode()).toBeNull();
});

test("PtyProcess getExitCode returns code after exit", async () => {
  const pty = new PtyProcess("true");
  ptys.push(pty);
  await pty.ready();
  await Bun.sleep(500);

  const exitCode = pty.getExitCode();
  expect(exitCode).toBe(0);
});

test("PtyProcess non-zero exit code", async () => {
  const pty = new PtyProcess("false");
  ptys.push(pty);

  try {
    await pty.toPromise();
  } catch (err) {
    expect(err).toBeDefined();
    if (err instanceof Error && "exitCode" in err) {
      expect((err as Error & { exitCode: number }).exitCode).not.toBe(0);
    }
  }
});

// ============================================================================
// Error Handling Tests
// ============================================================================

test("PtyProcess handles command not found", async () => {
  const pty = new PtyProcess("cat /nonexistent/file.txt");
  ptys.push(pty);

  try {
    await pty.toPromise();
    expect(pty.getExitCode()).not.toBe(0);
  } catch {
    // Error expected for non-zero exit
    expect(pty.getExitCode()).not.toBe(0);
  }
});

test("PtyProcess write throws when terminated", async () => {
  const pty = new PtyProcess("cat");
  await pty.ready();
  await pty.dispose();

  await expect(pty.write("test")).rejects.toThrow(/is not active/);
});

// ============================================================================
// ANSI Strip Tests
// ============================================================================

test("PtyProcess with ansiStrip option", async () => {
  const pty = new PtyProcess({
    command: 'echo -e "\\x1b[31mRed Text\\x1b[0m"',
    cwd: process.cwd(),
    ansiStrip: true,
  });
  ptys.push(pty);

  return new Promise<void>((resolve) => {
    const sub = pty.subscribe({
      onData: (data) => {
        const stripped = stripAnsi(data);
        // Data should already be stripped
        expect(data).toBe(stripped);
      },
      onError: () => {},
      onComplete: () => {
        sub.unsubscribe();
        resolve();
      },
    });
  });
});

// ============================================================================
// Output Callback Tests
// ============================================================================

test("PtyProcess onOutput callback receives structured output", async () => {
  const pty = new PtyProcess("echo callback");
  ptys.push(pty);
  await pty.ready();

  return new Promise<void>((resolve) => {
    let callbackInvoked = false;
    pty.onOutput((output) => {
      if (output.output.includes("callback")) {
        callbackInvoked = true;
        expect(output.processId).toBe(pty.id);
        expect(output.timestamp).toBeInstanceOf(Date);
        expect(typeof output.ansiStripped).toBe("boolean");
      }
    });

    setTimeout(() => {
      expect(callbackInvoked).toBe(true);
      resolve();
    }, 500);
  });
});

// ============================================================================
// Dispose Tests
// ============================================================================

test("PtyProcess dispose transitions to terminated", async () => {
  const pty = new PtyProcess("cat");
  await pty.ready();
  expect(pty.status).toBe("active");

  await pty.dispose();
  expect(pty.status).toBe("terminated");
});

test("PtyProcess dispose is idempotent", async () => {
  const pty = new PtyProcess("cat");
  await pty.ready();

  await pty.dispose();
  expect(pty.status).toBe("terminated");

  await pty.dispose();
  expect(pty.status).toBe("terminated");
});

test("PtyProcess dispose with SIGKILL", async () => {
  const pty = new PtyProcess("sleep 10");
  await pty.ready();

  await pty.dispose("SIGKILL");
  expect(pty.status).toBe("terminated");
}, 10000);

// ============================================================================
// Auto Dispose Tests
// ============================================================================

test("PtyProcess autoDisposeOnExit option", async () => {
  const pty = new PtyProcess({
    command: "true",
    cwd: process.cwd(),
    autoDisposeOnExit: true,
  });

  await pty.ready();
  await Bun.sleep(600);

  expect(["terminated", "terminating"]).toContain(pty.status);
});

// ============================================================================
// Running State Tests
// ============================================================================

test("PtyProcess isRunning returns correct state", async () => {
  const pty = new PtyProcess("sleep 1");
  ptys.push(pty);
  await pty.ready();

  expect(pty.isRunning()).toBe(true);

  await pty.dispose();
  expect(pty.isRunning()).toBe(false);
});

// ============================================================================
// Activity Tracking Tests
// ============================================================================

test("PtyProcess tracks lastActivity on write", async () => {
  const pty = new PtyProcess("cat");
  ptys.push(pty);
  await pty.ready();

  const before = pty.lastActivity;
  await Bun.sleep(100);
  await pty.write("test\n", 100);
  const after = pty.lastActivity;

  expect(after.getTime()).toBeGreaterThan(before.getTime());
});

// ============================================================================
// Command Normalization Tests
// ============================================================================

test("PtyProcess normalizes simple command", async () => {
  const pty = new PtyProcess("echo normalized");
  ptys.push(pty);
  const output = await pty.toPromise();
  expect(output).toContain("normalized");
});

test("PtyProcess normalizes pipeline command", async () => {
  const pty = new PtyProcess("echo hello | grep h");
  ptys.push(pty);
  const output = await pty.toPromise();
  expect(output).toContain("hello");
});

test("PtyProcess normalizes command with redirection", async () => {
  const pty = new PtyProcess("echo test > /tmp/test.txt && cat /tmp/test.txt");
  ptys.push(pty);
  const output = await pty.toPromise();
  expect(output).toContain("test");
});
