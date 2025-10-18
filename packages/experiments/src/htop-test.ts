import { Terminal } from "@xterm/headless";
import { spawn } from "@zenyr/bun-pty";

/**
 * htop input test - simpler than btop
 */
const testHtop = async () => {
  console.log("=== htop Input Test ===");

  const terminal = new Terminal({
    cols: 120,
    rows: 30,
    convertEol: true,
    allowProposedApi: true,
  });

  const pty = spawn("htop", [], {
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
    console.log(`\nhtop exited with code ${event.exitCode}`);
    exited = true;
  });

  await Bun.sleep(2000);

  console.log("\nInitial screen (first 3 lines):");
  for (let i = 0; i < 3; i++) {
    console.log(`  ${terminal.buffer.active.getLine(i)?.translateToString()}`);
  }

  // Test 1: Send 'q' to quit
  console.log("\n--- Sending 'q' to quit ---");
  pty.write("q");
  await Bun.sleep(1000);

  if (!exited) {
    console.log("FAILED: 'q' did not quit htop");
    // Test 2: Try F10 (quit in htop)
    console.log("\n--- Sending F10 (ESC[21~) to quit ---");
    pty.write("\x1b[21~");
    await Bun.sleep(1000);
  }

  if (!exited) {
    console.log("FAILED: F10 did not quit htop either");
    pty.kill();
  } else {
    console.log("SUCCESS: htop quit successfully");
  }

  console.log("\n=== Test Complete ===");
};

testHtop().catch(console.error);
