import { Terminal } from "@xterm/headless";
import { spawn } from "@zenyr/bun-pty";

/**
 * vim input test - classic TUI app
 */
const testVim = async () => {
  console.log("=== vim Input Test ===");

  const terminal = new Terminal({
    cols: 80,
    rows: 24,
    convertEol: true,
    allowProposedApi: true,
  });

  const pty = spawn("vim", ["-u", "NONE"], {
    name: "xterm-256color",
    cols: terminal.cols,
    rows: terminal.rows,
    cwd: process.cwd(),
    env: { ...process.env, TERM: "xterm-256color" } as Record<string, string>,
  });

  pty.onData((data: string) => {
    terminal.write(data);
  });

  let exited = false;
  pty.onExit((event) => {
    console.log(`\nvim exited with code ${event.exitCode}`);
    exited = true;
  });

  await Bun.sleep(1000);

  console.log("\nInitial screen (last 3 lines):");
  for (let i = 21; i < 24; i++) {
    console.log(
      `  [${i}] ${terminal.buffer.active.getLine(i)?.translateToString()}`,
    );
  }

  // Test 1: Enter insert mode with 'i'
  console.log("\n--- Sending 'i' to enter insert mode ---");
  pty.write("i");
  await Bun.sleep(500);
  console.log("After 'i' (last line):");
  console.log(`  ${terminal.buffer.active.getLine(23)?.translateToString()}`);

  // Test 2: Type some text
  console.log("\n--- Typing 'hello' ---");
  pty.write("hello");
  await Bun.sleep(500);
  console.log("After typing (first line):");
  console.log(`  ${terminal.buffer.active.getLine(0)?.translateToString()}`);

  // Test 3: ESC to normal mode
  console.log("\n--- Sending ESC to return to normal mode ---");
  pty.write("\x1b");
  await Bun.sleep(500);

  // Test 4: Quit with :q!
  console.log("\n--- Sending ':q!' to quit ---");
  pty.write(":q!\n");
  await Bun.sleep(1000);

  if (!exited) {
    console.log("FAILED: vim did not quit");
    pty.kill();
  } else {
    console.log("SUCCESS: vim quit successfully");
  }

  console.log("\n=== Test Complete ===");
};

testVim().catch(console.error);
