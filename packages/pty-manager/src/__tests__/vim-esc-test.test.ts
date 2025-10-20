import { describe, expect, test } from "bun:test";
import { PtyProcess } from "../process";

/**
 * Deep dive into vim ESC key handling
 */

describe("Vim ESC Key Handling", () => {
  test("vim insert mode - ESC key with \\x1b", async () => {
    let pty: PtyProcess | null = null;
    try {
      pty = new PtyProcess({ command: "vim -u NONE", cwd: process.cwd() });
      await pty.ready();
      await Bun.sleep(1000); // Wait for vim to start

      // Safety check: ensure pty is still active
      if (!pty || pty.status !== "active") {
        console.log("Vim failed to start or process terminated");
        return;
      }

      console.log("=== Initial vim screen ===");
      console.log(pty.captureBuffer().join("\n"));
      console.log("===\n");

      // Enter insert mode with 'i'
      if (!pty || pty.status !== "active") return;
      const insertMode = await pty.write("i", 300);
      console.log("=== After pressing 'i' (insert mode) ===");
      console.log(insertMode.screen);
      console.log("===\n");

      // Type some text
      if (!pty || pty.status !== "active") return;
      const textInput = await pty.write("hello world", 300);
      console.log("=== After typing 'hello world' ===");
      console.log(textInput.screen);
      console.log("===\n");

      // Try ESC with \x1b
      if (!pty || pty.status !== "active") return;
      const escResult = await pty.write("\x1b", 500);
      console.log("=== After ESC (\\x1b) ===");
      console.log(escResult.screen);
      console.log("Raw buffer (last 200 chars):");
      console.log(JSON.stringify(pty.getOutputBuffer().slice(-200)));
      console.log("===\n");

      // Check if still in insert mode by looking for -- INSERT --
      const hasInsertMode = escResult.screen.includes("-- INSERT --");
      console.log("Still in INSERT mode?", hasInsertMode);
      console.log("Expected: false (should have exited insert mode)");

      // Try command mode - quit without saving
      if (!pty || pty.status !== "active") return;
      const quitResult = await pty.write(":q!\n", 500);
      console.log("=== After :q! ===");
      console.log("Exit code:", quitResult.exitCode);
      console.log("===\n");
    } finally {
      if (pty) {
        await pty.dispose();
      }
    }
  }, 15000);

  test("Compare different ESC representations", async () => {
    const testCases = [
      { label: "\\x1b (hex escape)", data: "\x1b" },
      { label: "\\u001b (unicode escape)", data: "\u001b" },
      { label: "String.fromCharCode(27)", data: String.fromCharCode(27) },
      { label: "Raw byte 0x1b", data: "\x1b" },
    ];

    for (const { label, data } of testCases) {
      console.log(`=== Testing: ${label} ===`);
      console.log(
        `Byte value: ${data.charCodeAt(0)} (0x${data.charCodeAt(0).toString(16)})`,
      );
      console.log(`String length: ${data.length}`);
      console.log(`JSON.stringify: ${JSON.stringify(data)}`);
      console.log("===\n");

      expect(data.charCodeAt(0)).toBe(0x1b);
      expect(data.length).toBe(1);
    }
  });

  test("MCP JSON payload simulation", async () => {
    // Simulate what Claude/LLM would send via MCP
    const mcpPayloads = [
      {
        label: "Newline in JSON",
        json: '{"data": "echo test\\n"}',
        expectedByte: 0x0a,
        expectedChar: "\n",
      },
      {
        label: "ESC in JSON",
        json: '{"data": "\\u001b"}',
        expectedByte: 0x1b,
        expectedChar: "\x1b",
      },
      {
        label: "Ctrl+C in JSON",
        json: '{"data": "\\u0003"}',
        expectedByte: 0x03,
        expectedChar: "\x03",
      },
    ];

    for (const { label, json, expectedByte, expectedChar } of mcpPayloads) {
      console.log(`=== ${label} ===`);
      console.log(`MCP JSON: ${json}`);

      const parsed = JSON.parse(json);
      console.log(`Parsed data: ${JSON.stringify(parsed.data)}`);
      console.log(
        `Byte value: ${parsed.data.charCodeAt(parsed.data.length - 1)}`,
      );
      console.log(`Expected: ${expectedByte} (0x${expectedByte.toString(16)})`);
      console.log("===\n");

      expect(parsed.data).toContain(expectedChar);
    }
  });
});
