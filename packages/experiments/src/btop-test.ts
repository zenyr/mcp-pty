import { Terminal } from "@xterm/headless";
import { spawn } from "@zenyr/bun-pty";

/**
 * btop interactive input test
 * Test if control characters are properly sent to btop TUI
 */
const testBtopInput = async () => {
  console.log("=== btop Input Test ===");

  const terminal = new Terminal({
    cols: 120,
    rows: 30,
    convertEol: true,
    allowProposedApi: true,
  });

  const pty = spawn("btop", ["--utf-force", "--tty_on"], {
    name: "xterm-256color",
    cols: terminal.cols,
    rows: terminal.rows,
    cwd: process.cwd(),
    env: {
      ...process.env,
      TERM: "xterm-256color",
      COLORTERM: "truecolor",
      LANG: "en_US.UTF-8",
    } as Record<string, string>,
  });

  console.log(`PTY spawned, writing to fd: ${pty.pid}`);

  let output = "";

  pty.onData((data: string) => {
    output += data;
    terminal.write(data);
  });

  pty.onExit((event) => {
    console.log(`btop exited with code ${event.exitCode}`);
  });

  // Wait for btop to initialize
  await Bun.sleep(2000);

  const printScreen = (label: string) => {
    console.log(`\n${label}:`);

    for (let i = 0; i < terminal.rows; i++) {
      const line = terminal.buffer.active.getLine(i)?.translateToString();
      if (line && line.trim()) {
        const trimmed = line.slice(0, 120);
        console.log(`  [${String(i).padStart(2, "0")}] ${trimmed}`);
      }
    }
  };

  printScreen("Initial screen");

  // Test 1: Send 'm' to open menu
  console.log("\n--- Test 1: Send 'm' for menu ---");
  const mResult = pty.write("m");
  console.log(`Write 'm' returned: ${mResult}`);
  await Bun.sleep(1500);
  printScreen("After 'm'");

  // Test 2: ESC to close menu (if opened)
  console.log("\n--- Test 2: Send ESC ---");
  pty.write("\x1b");
  await Bun.sleep(1000);
  printScreen("After ESC");

  // Test 3: Send 'q' to quit
  console.log("\n--- Test 3: Send 'q' to quit ---");
  pty.write("q");
  await Bun.sleep(1000);

  // Test 4: Send Ctrl+C if still running
  console.log("\n--- Test 4: Send Ctrl+C ---");
  pty.write("\x03");
  await Bun.sleep(1000);
  console.log(
    "After 'm':",
    terminal.buffer.active.getLine(0)?.translateToString(),
  );

  // Test 2: Send 'q' to quit
  console.log("\n--- Test 2: Send 'q' to quit ---");
  pty.write("q");
  await Bun.sleep(1000);

  // Test 3: Send Ctrl+C
  console.log("\n--- Test 3: Send Ctrl+C ---");
  pty.write("\x03");
  await Bun.sleep(1000);

  // Force kill if still running
  pty.kill();
  await Bun.sleep(500);

  console.log("\n=== Test Complete ===");
};

testBtopInput().catch(console.error);
