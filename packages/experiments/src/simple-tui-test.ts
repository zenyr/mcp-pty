import { Terminal } from "@xterm/headless";
import { spawn } from "@zenyr/bun-pty";

/**
 * Simple TUI test with 'less' command
 * less is simpler than btop and should respond to 'q'
 */
const testLess = async () => {
  console.log("=== Testing 'less' TUI ===");

  const terminal = new Terminal({
    cols: 80,
    rows: 24,
    convertEol: true,
    allowProposedApi: true,
  });

  // Create a temp file
  const tmpFile = "/tmp/test-tui-input.txt";
  await Bun.write(
    tmpFile,
    Array.from({ length: 100 }, (_, i) => `Line ${i + 1}`).join("\n"),
  );

  const pty = spawn("less", [tmpFile], {
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
    console.log(`\nless exited with code ${event.exitCode}`);
    exited = true;
  });

  await Bun.sleep(1000);

  console.log("\nInitial screen (first 5 lines):");
  for (let i = 0; i < 5; i++) {
    console.log(`  ${terminal.buffer.active.getLine(i)?.translateToString()}`);
  }

  // Test 1: Send 'q' to quit
  console.log("\n--- Sending 'q' to quit ---");
  pty.write("q");
  await Bun.sleep(500);

  if (!exited) {
    console.log("FAILED: 'q' did not quit less");
    pty.kill();
  } else {
    console.log("SUCCESS: 'q' successfully quit less");
  }

  console.log("\n=== Test Complete ===");
};

testLess().catch(console.error);
