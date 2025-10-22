#!/usr/bin/env bun
/**
 * E2E Test Runner: Orchestrates HTTP server + client test with PTY
 *
 * Run from repo root:
 *   bun --cwd=packages/mcp-pty run src/__tests__/e2e-runner.ts
 *
 * Flow:
 * 1. Start HTTP server in PTY (logs visible)
 * 2. Run client test script
 * 3. When client requests restart: kill & restart HTTP server
 * 4. Client test continues (recovery phase)
 * 5. Cleanup
 */

interface TestContext {
  serverProc?: Bun.Subprocess;
  clientOutput?: string;
  errors: string[];
}

const ctx: TestContext = { errors: [] };
const PORT = 6421;
const PKG_ROOT = import.meta.dir + "/../..";

/**
 * Start HTTP server in PTY
 */
async function startServer(): Promise<Bun.Subprocess> {
  console.log("[E2E] Starting HTTP server in PTY...");

  const proc = Bun.spawn({
    cmd: ["bun", "run", `${PKG_ROOT}/src/__tests__/http-server-e2e.ts`],
    cwd: PKG_ROOT,
    env: { ...process.env, PORT: PORT.toString() },
    stdout: "inherit",
    stderr: "inherit",
  });

  await Bun.sleep(1000);
  console.log("[E2E] ✓ Server started");

  return proc;
}

/**
 * Run E2E client test
 */
async function runClientTest(): Promise<boolean> {
  console.log("\n[E2E] Running client test...");

  const proc = Bun.spawn({
    cmd: ["bun", "run", `${PKG_ROOT}/src/__tests__/http-recovery-e2e.ts`],
    cwd: PKG_ROOT,
    env: { ...process.env, PORT: PORT.toString() },
    stdout: "pipe",
    stderr: "pipe",
  });

  let output = "";

  if (proc.stdout) {
    const reader = proc.stdout.getReader();
    const decoder = new TextDecoder();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const text = decoder.decode(value);
        output += text;
        process.stdout.write(text);
      }
    } catch {
      // Stream closed
    }
  }

  if (proc.stderr) {
    const reader = proc.stderr.getReader();
    const decoder = new TextDecoder();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const text = decoder.decode(value);
        output += text;
        process.stderr.write(text);
      }
    } catch {
      // Stream closed
    }
  }

  const exitCode = await proc.exited;
  ctx.clientOutput = output;

  if (exitCode !== 0 || output.includes("TEST FAILED")) {
    ctx.errors.push(`Client test failed (exit code: ${exitCode})`);
    return false;
  }

  return true;
}

/**
 * Main orchestration
 */
async function main() {
  console.log("=".repeat(70));
  console.log("MCP-PTY HTTP Server E2E Recovery Test");
  console.log("=".repeat(70));

  try {
    // Start server
    const serverProc = await startServer();
    ctx.serverProc = serverProc;

    // Run client test
    const success = await runClientTest();

    if (success) {
      console.log("\n" + "=".repeat(70));
      console.log("✓ E2E TEST PASSED");
      console.log("=".repeat(70));
      process.exit(0);
    } else {
      console.log("\n" + "=".repeat(70));
      console.log("✗ E2E TEST FAILED");
      console.log("=".repeat(70));
      ctx.errors.forEach((e) => {
        console.error(`  - ${e}`);
      });
      process.exit(1);
    }
  } catch (err) {
    console.error("[E2E] Fatal error:", err);
    process.exit(1);
  } finally {
    if (ctx.serverProc) {
      try {
        ctx.serverProc.kill();
      } catch {
        // Already stopped
      }
    }
  }
}

main();
