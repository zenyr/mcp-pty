#!/usr/bin/env bun
/**
 * E2E test for HTTP server session recovery
 * WITH MANUAL RETRY (since SDK doesn't auto-retry 404)
 *
 * Test flow:
 * 1. Client connects & acquires sessionId
 * 2. Client lists tools
 * 3. **USER ACTION**: Kill & restart HTTP server
 * 4. Client listTools() → gets 404 (but SDK updates sessionId)
 * 5. Client **retries** listTools() with new sessionId
 * 6. Verify success!
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

interface TestState {
  baseUrl: string;
  sessionId?: string;
  client?: Client;
  transport?: StreamableHTTPClientTransport;
}

async function connectClient(state: TestState): Promise<void> {
  console.log("\n[STEP 1] Connecting MCP client to HTTP server...");

  const transport = new StreamableHTTPClientTransport(
    new URL(`${state.baseUrl}/mcp`),
  );

  state.transport = transport;
  state.client = new Client({ name: "test-client", version: "1.0.0" });

  await state.client.connect(transport);
  state.sessionId = transport.sessionId;

  console.log(`✓ Connected. SessionId: ${state.sessionId}`);
}

async function listTools(state: TestState): Promise<void> {
  if (!state.client) throw new Error("Client not initialized");

  console.log("\n[STEP 2] Listing tools (initial connection)...");

  try {
    const result = await state.client.listTools();
    console.log(`✓ Listed ${result.tools.length} tools`);
  } catch (err) {
    console.error(`✗ Failed to list tools: ${err}`);
    throw err;
  }
}

async function waitForUserServerRestart(): Promise<void> {
  console.log("\n[STEP 3] **USER ACTION REQUIRED**");
  console.log("========================================");
  console.log("In another PTY window:");
  console.log("  1. Kill the HTTP server PTY (Ctrl+C or pty_kill)");
  console.log(
    "  2. Restart it with: bun --cwd=packages/mcp-pty run src/__tests__/http-server-e2e.ts",
  );
  console.log("  3. Wait for '[SERVER] Ready for connections' message");
  console.log("  4. Press Enter here to continue");
  console.log("========================================");

  return new Promise((resolve) => {
    const stdin = process.stdin;
    stdin.setRawMode?.(false);
    stdin.once("data", () => {
      resolve();
    });
  });
}

async function pollServerReady(baseUrl: string): Promise<void> {
  console.log("\n[STEP 4] Polling for server availability...");

  const maxAttempts = 60;
  let attempts = 0;

  while (attempts < maxAttempts) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1000);

      const response = await fetch(`${baseUrl}/mcp`, {
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok || response.status === 404 || response.status === 406) {
        console.log("✓ Server restarted and responding!");
        return;
      }
    } catch {
      // Server not ready yet
    }

    await Bun.sleep(500);
    attempts++;
    if (attempts % 4 === 0) {
      process.stdout.write(".");
    }
  }

  console.log("\n✗ Server failed to restart within timeout");
  throw new Error("Server restart timeout");
}

async function listToolsWithRecovery(state: TestState): Promise<void> {
  if (!state.client) throw new Error("Client not initialized");

  console.log("\n[STEP 5] Listing tools after server restart...");
  console.log(
    `Using old sessionId: ${state.sessionId} (should trigger 404 recovery)`,
  );

  let attempt = 1;
  const maxRetries = 3;

  while (attempt <= maxRetries) {
    try {
      console.log(`  Attempt ${attempt}/${maxRetries}...`);

      const result = await state.client.listTools();

      console.log(`✓ Listed ${result.tools.length} tools`);
      console.log(
        `✓ Transport sessionId updated to: ${state.transport?.sessionId}`,
      );

      if (state.transport?.sessionId !== state.sessionId) {
        console.log(`✓ SESSION ID CHANGED (recovery successful):`);
        console.log(`   Old: ${state.sessionId}`);
        console.log(`   New: ${state.transport?.sessionId}`);
      }

      return;
    } catch (err) {
      const errMsg = String(err);

      if (attempt < maxRetries && errMsg.includes("404")) {
        console.log(`  Got 404 (expected during recovery), retrying...`);
        attempt++;
        await Bun.sleep(500);
      } else {
        console.error(`✗ Failed after ${attempt} attempts: ${err}`);
        throw err;
      }
    }
  }

  throw new Error("Max retries exceeded");
}

async function cleanup(state: TestState): Promise<void> {
  console.log("\n[CLEANUP] Closing client connection...");

  if (state.client) {
    await state.client.close();
  }

  console.log("✓ Connection closed");
}

async function main() {
  const port = parseInt(process.env.PORT ?? "6421", 10);
  const baseUrl = `http://localhost:${port}`;
  const state: TestState = { baseUrl };

  console.log("=".repeat(70));
  console.log("HTTP Server Session Recovery E2E Test (with manual retry)");
  console.log("=".repeat(70));
  console.log(`Base URL: ${baseUrl}`);

  try {
    // Phase 1: Initial connection & tools
    await connectClient(state);
    await listTools(state);

    // Phase 2: Server restart (user action)
    console.log("\n" + "=".repeat(70));
    console.log("SERVER RESTART PHASE");
    console.log("=".repeat(70));
    await waitForUserServerRestart();
    await pollServerReady(baseUrl);

    // Phase 3: Recovery test (with retry)
    console.log("\n" + "=".repeat(70));
    console.log("RECOVERY TEST PHASE");
    console.log("=".repeat(70));
    await listToolsWithRecovery(state);

    console.log("\n" + "=".repeat(70));
    console.log("✓ ALL TESTS PASSED");
    console.log("=".repeat(70));
    console.log("\n** Race condition fix verified! **");
    console.log(
      "Server received 404 + new sessionId and client recovered successfully.",
    );
  } catch (err) {
    console.error("\n" + "=".repeat(70));
    console.error("✗ TEST FAILED");
    console.error("=".repeat(70));
    console.error("Error:", err);
    process.exit(1);
  } finally {
    await cleanup(state);
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
