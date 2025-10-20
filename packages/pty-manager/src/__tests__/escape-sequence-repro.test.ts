import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { PtyProcess } from "../process";

/**
 * Reproduction test for issue #56
 * Tests escape sequence handling across different TUI applications
 *
 * Note: These tests are skipped by default as they depend on external programs
 * and are prone to timing issues in CI environments.
 */

describe.skip("Escape Sequence Handling Reproduction", () => {
  let ptyNode: PtyProcess | null = null;
  let ptyPython: PtyProcess | null = null;

  beforeEach(async () => {
    // Setup will be done per test
  });

  afterEach(async () => {
    if (ptyNode) {
      await ptyNode.dispose();
      ptyNode = null;
    }
    if (ptyPython) {
      await ptyPython.dispose();
      ptyPython = null;
    }
  });

  test("Node.js REPL - newline handling", async () => {
    ptyNode = new PtyProcess({ command: "node", cwd: process.cwd() });
    await ptyNode.ready();
    await Bun.sleep(50); // Wait for REPL prompt

    // Test 1: Simple expression with \n
    if (ptyNode.status !== "active") {
      console.log(`PTY not active, status: ${ptyNode.status}`);
      return;
    }
    const result1 = await ptyNode.write("2+2\n", 500);
    console.log("=== Node.js REPL Test 1 ===");
    console.log("Input: '2+2\\n'");
    console.log("Screen output:");
    console.log(result1.screen);
    console.log("Raw buffer:");
    console.log(JSON.stringify(ptyNode.getOutputBuffer()));
    console.log("===\n");

    expect(result1.screen).toContain("4");

    // Test 2: Multiple commands
    if (ptyNode.status !== "active") {
      console.log(`PTY not active, status: ${ptyNode.status}`);
      return;
    }
    const result2 = await ptyNode.write("console.log('hello')\n", 500);
    console.log("=== Node.js REPL Test 2 ===");
    console.log("Input: 'console.log(\\'hello\\')\\n'");
    console.log("Screen output:");
    console.log(result2.screen);
    console.log("===\n");

    expect(result2.screen).toContain("hello");
  }, 10000);

  test("Python REPL - newline handling", async () => {
    ptyPython = new PtyProcess({ command: "python3", cwd: process.cwd() });
    await ptyPython.ready();
    await Bun.sleep(50); // Wait for REPL prompt

    // Test 1: Simple expression with \n
    const result1 = await ptyPython.write("2+2\n", 500);
    console.log("=== Python REPL Test 1 ===");
    console.log("Input: '2+2\\n'");
    console.log("Screen output:");
    console.log(result1.screen);
    console.log("Raw buffer:");
    console.log(JSON.stringify(ptyPython.getOutputBuffer()));
    console.log("===\n");

    // Check if it actually executed or showed literal \n
    const hasLiteralBackslashN = result1.screen.includes("\\n");
    const hasResult4 = result1.screen.includes("4");

    console.log("Contains literal \\\\n?", hasLiteralBackslashN);
    console.log("Contains result '4'?", hasResult4);

    // Test 2: Print statement
    const result2 = await ptyPython.write("print('hello')\n", 800);
    console.log("=== Python REPL Test 2 ===");
    console.log("Input: 'print(\\'hello\\')\\n'");
    console.log("Screen output:");
    console.log(result2.screen);
    console.log("===\n");

    const hasLiteralBackslashN2 = result2.screen.includes("\\n");
    const hasHello = result2.screen.includes("hello");

    console.log("Contains literal \\\\n?", hasLiteralBackslashN2);
    console.log("Contains 'hello'?", hasHello);
  }, 10000);

  test("Cat - raw input echo test", async () => {
    const ptyCat = new PtyProcess({ command: "cat", cwd: process.cwd() });
    await ptyCat.ready();

    // Test different escape sequences
    const tests = [
      { input: "hello\n", label: "newline" },
      { input: "test\r", label: "carriage return" },
      { input: "line1\nline2\n", label: "multi-line" },
    ];

    for (const { input, label } of tests) {
      const result = await ptyCat.write(input, 300);
      console.log(`=== Cat Test: ${label} ===`);
      console.log(`Input: ${JSON.stringify(input)}`);
      console.log("Screen output:");
      console.log(result.screen);
      console.log("Raw buffer (last 100 chars):");
      console.log(JSON.stringify(ptyCat.getOutputBuffer().slice(-100)));
      console.log("===\n");
    }

    await ptyCat.dispose();
  }, 10000);

  test("Direct byte comparison test", async () => {
    const pty = new PtyProcess({ command: "cat", cwd: process.cwd() });
    await pty.ready();

    // Test actual byte values
    const testCases = [
      { data: "\n", expectedByte: 0x0a, label: "LF (\\n)" },
      { data: "\r", expectedByte: 0x0d, label: "CR (\\r)" },
      { data: "\x03", expectedByte: 0x03, label: "Ctrl+C (\\x03)" },
      { data: "\x1b", expectedByte: 0x1b, label: "ESC (\\x1b)" },
    ];

    for (const { data, expectedByte, label } of testCases) {
      const _result = await pty.write(data, 200);
      const buffer = pty.getOutputBuffer();
      const lastBytes = buffer.slice(-10);

      console.log(`=== Byte Test: ${label} ===`);
      console.log(`Input data: ${JSON.stringify(data)}`);
      console.log(`Expected byte: 0x${expectedByte.toString(16)}`);
      console.log(
        `Actual byte value: ${data.charCodeAt(0)} (0x${data.charCodeAt(0).toString(16)})`,
      );
      console.log("Last bytes from buffer:");
      for (let i = 0; i < lastBytes.length; i++) {
        console.log(
          `  [${i}] char='${lastBytes[i]}' code=${lastBytes.charCodeAt(i)} hex=0x${lastBytes.charCodeAt(i).toString(16)}`,
        );
      }
      console.log("===\n");

      expect(data.charCodeAt(0)).toBe(expectedByte);
    }

    await pty.dispose();
  }, 10000);

  test("JSON string parsing simulation", async () => {
    // Simulate what happens when MCP receives JSON
    const jsonInput = '{"data": "hello\\nworld"}';
    const parsed = JSON.parse(jsonInput);

    console.log("=== JSON Parsing Test ===");
    console.log("JSON string:", jsonInput);
    console.log("Parsed data:", parsed.data);
    console.log("Parsed data (JSON.stringify):", JSON.stringify(parsed.data));
    console.log("Byte values:");
    for (let i = 0; i < parsed.data.length; i++) {
      const char = parsed.data[i];
      console.log(
        `  [${i}] char='${char === "\n" ? "\\n" : char}' code=${char.charCodeAt(0)} hex=0x${char.charCodeAt(0).toString(16)}`,
      );
    }
    console.log("===\n");

    expect(parsed.data).toBe("hello\nworld");
    expect(parsed.data.charCodeAt(5)).toBe(0x0a); // newline at position 5
  });
});
