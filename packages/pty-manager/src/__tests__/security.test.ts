import { afterAll, afterEach, beforeAll, expect, spyOn, test } from "bun:test";
import { consola } from "consola";
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
// PTY Write Input Validation Tests
// ============================================================================

test("should allow Ctrl+C (0x03)", async () => {
  const pty = new PtyProcess("cat");
  ptys.push(pty);
  await pty.ready();

  await expect(pty.write("\x03", 100)).resolves.toBeDefined();
});

test("should allow Ctrl+D (0x04)", async () => {
  const pty = new PtyProcess("cat");
  ptys.push(pty);
  await pty.ready();

  await expect(pty.write("\x04", 100)).resolves.toBeDefined();
});

test("should allow Ctrl+Z (0x1a)", async () => {
  const pty = new PtyProcess("cat");
  ptys.push(pty);
  await pty.ready();

  await expect(pty.write("\x1a", 100)).resolves.toBeDefined();
});

test("should allow ANSI color codes", async () => {
  const pty = new PtyProcess("cat");
  ptys.push(pty);
  await pty.ready();

  // Red color code
  await expect(pty.write("\x1b[31m", 100)).resolves.toBeDefined();
});

test("should allow normal text input", async () => {
  const pty = new PtyProcess("cat");
  ptys.push(pty);
  await pty.ready();

  await expect(pty.write("hello world\n", 100)).resolves.toBeDefined();
});

test("should allow newline and tab", async () => {
  const pty = new PtyProcess("cat");
  ptys.push(pty);
  await pty.ready();

  await expect(pty.write("line1\nline2\ttab", 100)).resolves.toBeDefined();
});

test("should block cursor positioning sequences", async () => {
  const pty = new PtyProcess("cat");
  ptys.push(pty);
  await pty.ready();

  await expect(pty.write("\x1b[10;10H", 100)).rejects.toThrow(
    /Dangerous control sequence/,
  );
});

test("should block screen clearing sequences", async () => {
  const pty = new PtyProcess("cat");
  ptys.push(pty);
  await pty.ready();

  await expect(pty.write("\x1b[2J", 100)).rejects.toThrow(
    /Dangerous control sequence/,
  );
});

test("should block OSC sequences", async () => {
  const pty = new PtyProcess("cat");
  ptys.push(pty);
  await pty.ready();

  await expect(pty.write("\x1b]0;Title\x07", 100)).rejects.toThrow(
    /Dangerous control sequence/,
  );
});

test("should block mode setting sequences", async () => {
  const pty = new PtyProcess("cat");
  ptys.push(pty);
  await pty.ready();

  await expect(pty.write("\x1b[?1h", 100)).rejects.toThrow(
    /Dangerous control sequence/,
  );
});

// ============================================================================
// Executable Permission Tests
// ============================================================================

test("should allow normal commands", async () => {
  const pty = new PtyProcess("echo hello");
  ptys.push(pty);

  await pty.ready();
  expect(pty.status).toBe("active");
});

test("should allow cat command", async () => {
  const pty = new PtyProcess("cat");
  ptys.push(pty);

  await pty.ready();
  expect(pty.status).toBe("active");
});

test("should allow ls command", async () => {
  const pty = new PtyProcess("ls");
  ptys.push(pty);

  await pty.ready();
  expect(pty.status).toBe("active");
});
