import { spawn } from "@zenyr/bun-pty";

interface TestResult {
  name: string;
  passed: boolean;
  input?: string;
  outputReceived?: string;
  outputLength?: number;
  packets?: number;
  error?: string;
}

const results: TestResult[] = [];
const HOST = "zblade14";

const logSection = (title: string) => {
  console.log("\n" + "=".repeat(60));
  console.log(`  ${title}`);
  console.log("=".repeat(60));
};

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Test 1: Non-interactive SSH (baseline - should work)
 */
const testNonInteractive = async (): Promise<void> => {
  logSection("Test 1: Non-Interactive SSH (whoami)");

  const command = `ssh ${HOST} whoami`;
  console.log(`Command: ${command}`);

  let output = "";
  let packets = 0;

  const pty = spawn("sh", ["-c", command], {
    name: "xterm-256color",
    cols: 80,
    rows: 24,
  });

  const dataHandler = pty.onData((data) => {
    packets++;
    output += data;
    console.log(
      `[Packet ${packets}] ${data.length} bytes: ${JSON.stringify(data)}`,
    );
  });

  const exitHandler = pty.onExit(({ exitCode }) => {
    console.log(`Exit code: ${exitCode}`);
  });

  await delay(3000);

  dataHandler.dispose();
  exitHandler.dispose();
  pty.kill();

  const passed = output.length > 0 && packets > 0;
  results.push({
    name: "Non-Interactive SSH",
    passed,
    input: command,
    outputReceived: output.trim(),
    outputLength: output.length,
    packets,
  });

  console.log(`✅ Result: ${passed ? "PASS" : "FAIL"}`);
  console.log(`   Output length: ${output.length} bytes`);
  console.log(`   Packets received: ${packets}`);
};

/**
 * Test 2: Interactive SSH with single command
 */
const testInteractiveCommand = async (): Promise<void> => {
  logSection("Test 2: Interactive SSH (single command: whoami)");

  const command = "whoami";
  console.log(`Opening: ssh ${HOST}`);
  console.log(`Sending: ${command}\\n`);

  let output = "";
  let packets = 0;
  let promptSeen = false;
  let commandSent = false;

  const pty = spawn("ssh", [HOST], {
    name: "xterm-256color",
    cols: 80,
    rows: 24,
  });

  const dataHandler = pty.onData((data) => {
    packets++;
    output += data;
    console.log(`[Packet ${packets}] ${data.length} bytes`);

    // Detect shell prompt (C:\Users\zenyr>)
    if (data.includes(">") && !promptSeen) {
      promptSeen = true;
      console.log("   [Prompt detected]");
      setTimeout(() => {
        if (!commandSent) {
          console.log(`   [Sending: ${command}]`);
          pty.write(`${command}\n`);
          commandSent = true;
        }
      }, 500);
    }
  });

  const exitHandler = pty.onExit(({ exitCode }) => {
    console.log(`Exit code: ${exitCode}`);
  });

  // Wait for command execution
  await delay(5000);

  dataHandler.dispose();
  exitHandler.dispose();
  pty.kill();

  const passed = commandSent && output.length > 0;
  results.push({
    name: "Interactive SSH Command",
    passed,
    input: command,
    outputLength: output.length,
    packets,
    error: !commandSent ? "Prompt not detected" : undefined,
  });

  console.log(`✅ Result: ${passed ? "PASS" : "FAIL"}`);
  console.log(`   Command sent: ${commandSent}`);
  console.log(`   Output length: ${output.length} bytes`);
  console.log(`   Packets received: ${packets}`);
};

/**
 * Test 3: Interactive SSH with exit command
 */
const testInteractiveExit = async (): Promise<void> => {
  logSection("Test 3: Interactive SSH (cmd: dir, then exit)");

  console.log(`Opening: ssh ${HOST}`);

  let output = "";
  let packets = 0;
  let promptSeen = false;
  let dirSent = false;
  let exitSent = false;

  const pty = spawn("ssh", [HOST], {
    name: "xterm-256color",
    cols: 80,
    rows: 24,
  });

  const dataHandler = pty.onData((data) => {
    packets++;
    output += data;
    console.log(`[Packet ${packets}] ${data.length} bytes`);

    if (data.includes(">")) {
      if (!dirSent && promptSeen) {
        console.log("   [Sending: dir]");
        pty.write("dir\n");
        dirSent = true;
      } else if (dirSent && !exitSent) {
        console.log("   [Sending: exit]");
        pty.write("exit\n");
        exitSent = true;
      }
      promptSeen = true;
    }
  });

  const exitHandler = pty.onExit(({ exitCode }) => {
    console.log(`Exit code: ${exitCode}`);
  });

  await delay(6000);

  dataHandler.dispose();
  exitHandler.dispose();
  pty.kill();

  const passed = dirSent && exitSent && output.length > 0;
  results.push({
    name: "Interactive SSH Multiple Commands",
    passed,
    outputLength: output.length,
    packets,
    error: !dirSent ? "dir not sent" : !exitSent ? "exit not sent" : undefined,
  });

  console.log(`✅ Result: ${passed ? "PASS" : "FAIL"}`);
  console.log(`   dir sent: ${dirSent}`);
  console.log(`   exit sent: ${exitSent}`);
  console.log(`   Output length: ${output.length} bytes`);
  console.log(`   Packets received: ${packets}`);
};

/**
 * Test 4: PowerShell via SSH
 */
const testPowerShellSSH = async (): Promise<void> => {
  logSection("Test 4: PowerShell via SSH (non-interactive)");

  const command = `ssh ${HOST} pwsh -c "whoami"`;
  console.log(`Command: ${command}`);

  let output = "";
  let packets = 0;

  const pty = spawn("sh", ["-c", command], {
    name: "xterm-256color",
    cols: 80,
    rows: 24,
  });

  const dataHandler = pty.onData((data) => {
    packets++;
    output += data;
    console.log(
      `[Packet ${packets}] ${data.length} bytes: ${JSON.stringify(data)}`,
    );
  });

  const exitHandler = pty.onExit(({ exitCode }) => {
    console.log(`Exit code: ${exitCode}`);
  });

  await delay(3000);

  dataHandler.dispose();
  exitHandler.dispose();
  pty.kill();

  const passed = output.length > 0;
  results.push({
    name: "PowerShell SSH",
    passed,
    outputReceived: output.trim(),
    outputLength: output.length,
    packets,
  });

  console.log(`✅ Result: ${passed ? "PASS" : "FAIL"}`);
  console.log(`   Output: ${output.trim()}`);
};

/**
 * Main test runner
 */
const main = async (): Promise<void> => {
  console.log("\n📋 Windows SSH PTY Test Suite");
  console.log(`   Target: ${HOST}`);
  console.log(`   Started: ${new Date().toISOString()}`);

  try {
    await testNonInteractive();
    await delay(1000);

    await testInteractiveCommand();
    await delay(1000);

    await testInteractiveExit();
    await delay(1000);

    await testPowerShellSSH();
  } catch (error) {
    console.error("❌ Test error:", error);
  }

  // Summary
  logSection("Test Summary");
  console.log("\nResults:");
  for (const result of results) {
    const status = result.passed ? "✅" : "❌";
    console.log(
      `${status} ${result.name}: ${result.outputLength ?? 0} bytes, ${result.packets ?? 0} packets`,
    );
    if (result.error) {
      console.log(`   Error: ${result.error}`);
    }
  }

  const passCount = results.filter((r) => r.passed).length;
  console.log(`\n📊 Summary: ${passCount}/${results.length} tests passed`);
};

main().catch(console.error);
