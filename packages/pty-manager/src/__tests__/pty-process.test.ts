import { afterAll, beforeAll, expect, spyOn, test } from "bun:test";
import { consola } from "consola";
import stripAnsi from "strip-ansi";
import { withTestPtyProcess } from "../test-utils";

let consoleLogSpy: ReturnType<typeof spyOn>;

beforeAll(() => {
  consola.level = 999;
  consoleLogSpy = spyOn(console, "log").mockImplementation(() => {});
});

afterAll(() => {
  consoleLogSpy.mockRestore();
});

// ============================================================================
// Basic PTY Tests
// ============================================================================

test("PtyProcess creates with command string", async () => {
  await withTestPtyProcess("echo hello", async (pty) => {
    await pty.ready();
    expect(pty.id).toBeDefined();
    expect(pty.status).toBe("active");
    expect(pty.options.command).toBe("echo hello");
  });
});

test("PtyProcess creates with options object", async () => {
  await withTestPtyProcess(
    { command: "cat", cwd: "/tmp", env: { TEST_VAR: "test_value" } },
    async (pty) => {
      await pty.ready();
      expect(pty.options.command).toBe("cat");
      expect(pty.options.cwd).toBe("/tmp");
      expect(pty.options.env?.TEST_VAR).toBe("test_value");
    },
  );
});

test("PtyProcess basic echo command", async () => {
  await withTestPtyProcess("echo hello", async (pty) => {
    const output = await pty.toPromise();
    expect(output).toContain("hello");
  });
});

// ============================================================================
// Subscribe Pattern Tests
// ============================================================================

test("PtyProcess subscribe receives data", async () => {
  await withTestPtyProcess("echo test", async (pty) => {
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
});

test("PtyProcess subscribe unsubscribe works", async () => {
  await withTestPtyProcess("sleep 1", async (pty) => {
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

    const countAfterUnsub = dataCount;
    await Bun.sleep(200);
    expect(dataCount).toBe(countAfterUnsub);
  });
});

test("PtyProcess multiple subscribers", async () => {
  await withTestPtyProcess("echo multi", async (pty) => {
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
});

// ============================================================================
// Write Method Tests
// ============================================================================

test("PtyProcess write plain text", async () => {
  await withTestPtyProcess("cat", async (pty) => {
    await pty.ready();

    const result = await pty.write("hello world\n", 500);
    expect(result.screen).toContain("hello world");
    expect(result.cursor).toHaveProperty("x");
    expect(result.cursor).toHaveProperty("y");
    expect(result.exitCode).toBeNull();
  });
});

test("PtyProcess write CJK characters", async () => {
  await withTestPtyProcess("cat", async (pty) => {
    await pty.ready();

    const result = await pty.write("안녕하세요 こんにちは 你好\n", 500);
    expect(result.screen).toContain("안녕하세요");
    expect(result.screen).toContain("こんにちは");
    expect(result.screen).toContain("你好");
  });
});

test("PtyProcess write emoji", async () => {
  await withTestPtyProcess("cat", async (pty) => {
    await pty.ready();

    const result = await pty.write("Hello 👋 World 🌍\n", 500);
    expect(result.screen).toContain("👋");
    expect(result.screen).toContain("🌍");
  });
});

test("PtyProcess write multiline input", async () => {
  await withTestPtyProcess("cat", async (pty) => {
    await pty.ready();

    const result = await pty.write("line1\nline2\nline3\n", 500);
    expect(result.screen).toContain("line1");
    expect(result.screen).toContain("line2");
    expect(result.screen).toContain("line3");
  });
});

test("PtyProcess write control characters", async () => {
  await withTestPtyProcess("cat", async (pty) => {
    await pty.ready();

    const result = await pty.write("\x03", 500);
    expect(result.screen).toBeDefined();
    expect(result.cursor).toHaveProperty("x");
  });
});

test("PtyProcess write empty string should not throw", async () => {
  await withTestPtyProcess("cat", async (pty) => {
    await pty.ready();

    const result = await pty.write("", 100);
    expect(result.screen).toBeDefined();
    expect(result.cursor).toHaveProperty("x");
    expect(result.exitCode).toBeNull();
    expect(result.warning).toBe(
      "Empty input ignored - use '\\n' for Enter key",
    );
  });
});

test("PtyProcess write newline only should work", async () => {
  await withTestPtyProcess("cat", async (pty) => {
    await pty.ready();

    const result = await pty.write("\n", 100);
    expect(result.screen).toBeDefined();
    expect(result.cursor).toHaveProperty("x");
    expect(result.exitCode).toBeNull();
  });
});

test("PtyProcess write multiple newlines should work", async () => {
  await withTestPtyProcess("cat", async (pty) => {
    await pty.ready();

    const result = await pty.write("\n\n\n", 200);
    expect(result.screen).toBeDefined();
    expect(result.cursor).toHaveProperty("x");
    expect(result.exitCode).toBeNull();
  });
});

// ============================================================================
// Buffer Capture Tests
// ============================================================================

test("PtyProcess captureBuffer returns array of lines", async () => {
  await withTestPtyProcess("echo test", async (pty) => {
    await pty.ready();
    await Bun.sleep(200);

    const buffer = pty.captureBuffer();
    expect(Array.isArray(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(0);
  });
});

test("PtyProcess getScreenContent captures current screen", async () => {
  await withTestPtyProcess("echo accumulate", async (pty) => {
    await pty.ready();
    await Bun.sleep(200);

    const screen = pty.getScreenContent();
    expect(screen.length).toBeGreaterThan(0);
    expect(screen).toContain("accumulate");
  });
});

// ============================================================================
// Terminal Resize Tests
// ============================================================================

test("PtyProcess resize changes terminal dimensions", async () => {
  await withTestPtyProcess("cat", async (pty) => {
    await pty.ready();

    expect(pty.terminal.cols).toBe(80);
    expect(pty.terminal.rows).toBe(24);

    pty.resize(120, 40);
    expect(pty.terminal.cols).toBe(120);
    expect(pty.terminal.rows).toBe(40);
  });
});

test("PtyProcess resize throws when not active", async () => {
  await withTestPtyProcess("cat", async (pty) => {
    await pty.ready();
    await pty.dispose();

    expect(() => pty.resize(100, 30)).toThrow(/is not active/);
  });
});

// ============================================================================
// Exit Code Tests
// ============================================================================

test("PtyProcess getExitCode returns null while running", async () => {
  await withTestPtyProcess("sleep 1", async (pty) => {
    await pty.ready();
    expect(pty.getExitCode()).toBeNull();
  });
});

test("PtyProcess getExitCode returns code after exit", async () => {
  await withTestPtyProcess("true", async (pty) => {
    await pty.ready();
    await Bun.sleep(500);

    const exitCode = pty.getExitCode();
    expect(exitCode).toBe(0);
  });
});

test("PtyProcess non-zero exit code", async () => {
  await withTestPtyProcess("false", async (pty) => {
    try {
      await pty.toPromise();
    } catch (err) {
      expect(err).toBeDefined();
      if (err instanceof Error && "exitCode" in err) {
        expect((err as Error & { exitCode: number }).exitCode).not.toBe(0);
      }
    }
  });
});

// ============================================================================
// Error Handling Tests
// ============================================================================

test("PtyProcess handles command not found", async () => {
  await withTestPtyProcess("cat /nonexistent/file.txt", async (pty) => {
    try {
      await pty.toPromise();
      expect(pty.getExitCode()).not.toBe(0);
    } catch {
      expect(pty.getExitCode()).not.toBe(0);
    }
  });
}, 10000);

test("PtyProcess write throws when terminated", async () => {
  await withTestPtyProcess("cat", async (pty) => {
    await pty.ready();
    await pty.dispose();

    expect(pty.write("test")).rejects.toThrow(/is not active/);
  });
});

// ============================================================================
// ANSI Strip Tests
// ============================================================================

test("PtyProcess with ansiStrip option", async () => {
  await withTestPtyProcess(
    {
      command: 'echo -e "\\x1b[31mRed Text\\x1b[0m"',
      cwd: process.cwd(),
      ansiStrip: true,
    },
    async (pty) => {
      return new Promise<void>((resolve) => {
        const sub = pty.subscribe({
          onData: (data) => {
            const stripped = stripAnsi(data);
            expect(data).toBe(stripped);
          },
          onError: () => {},
          onComplete: () => {
            sub.unsubscribe();
            resolve();
          },
        });
      });
    },
  );
}, 10000);

// ============================================================================
// Output Callback Tests
// ============================================================================

test("PtyProcess onOutput callback receives structured output", async () => {
  await withTestPtyProcess("echo callback", async (pty) => {
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
});

// ============================================================================
// Dispose Tests
// ============================================================================

test("PtyProcess dispose transitions to terminated", async () => {
  await withTestPtyProcess("cat", async (pty) => {
    await pty.ready();
    expect(pty.status).toBe("active");

    await pty.dispose();
    expect(pty.status).toBe("terminated");
  });
});

test("PtyProcess dispose is idempotent", async () => {
  await withTestPtyProcess("cat", async (pty) => {
    await pty.ready();

    await pty.dispose();
    expect(pty.status).toBe("terminated");

    await pty.dispose();
    expect(pty.status).toBe("terminated");
  });
});

test("PtyProcess dispose with SIGKILL", async () => {
  await withTestPtyProcess("sleep 10", async (pty) => {
    await pty.ready();

    await pty.dispose("SIGKILL");
    expect(pty.status).toBe("terminated");
  });
}, 10000);

// ============================================================================
// Auto Dispose Tests
// ============================================================================

test("PtyProcess autoDisposeOnExit option", async () => {
  await withTestPtyProcess(
    { command: "true", cwd: process.cwd(), autoDisposeOnExit: true },
    async (pty) => {
      await pty.ready();
      await Bun.sleep(600);

      expect(["terminated", "terminating"]).toContain(pty.status);
    },
  );
});

// ============================================================================
// Running State Tests
// ============================================================================

test("PtyProcess isRunning returns correct state", async () => {
  await withTestPtyProcess("sleep 1", async (pty) => {
    await pty.ready();

    expect(pty.isRunning()).toBe(true);

    await pty.dispose();
    expect(pty.isRunning()).toBe(false);
  });
});

// ============================================================================
// Activity Tracking Tests
// ============================================================================

test("PtyProcess tracks lastActivity on write", async () => {
  await withTestPtyProcess("cat", async (pty) => {
    await pty.ready();

    const before = pty.lastActivity;
    await Bun.sleep(100);
    await pty.write("test\n", 100);
    const after = pty.lastActivity;

    expect(after.getTime()).toBeGreaterThan(before.getTime());
  });
});

// ============================================================================
// Command Normalization Tests
// ============================================================================

test("PtyProcess normalizes simple command", async () => {
  await withTestPtyProcess("echo normalized", async (pty) => {
    const output = await pty.toPromise();
    expect(output).toContain("normalized");
  });
});

test("PtyProcess normalizes pipeline command", async () => {
  await withTestPtyProcess("echo hello | grep h", async (pty) => {
    const output = await pty.toPromise();
    expect(output).toContain("hello");
  });
}, 10000);

test("PtyProcess normalizes command with redirection", async () => {
  await withTestPtyProcess(
    "echo test > /tmp/test.txt && cat /tmp/test.txt",
    async (pty) => {
      const output = await pty.toPromise();
      expect(output).toContain("test");
    },
  );
});
