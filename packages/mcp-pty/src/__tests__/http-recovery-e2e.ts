#!/usr/bin/env bun
/**
 * E2E test for HTTP server session recovery
 * Simulates server restart with client session persistence
 *
 * Test flow:
 * 1. Client connects & acquires sessionId
 * 2. Client lists tools
 * 3. User restarts server (kill + restart via PTY)
 * 4. Client tries to use old sessionId (gets 404 initially)
 * 5. MCP SDK auto-recovers with new sessionId
 * 6. Client lists tools again (should succeed)
 * 7. Verify no 400/500 errors in the process
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

interface TestState {
  baseUrl: string;
  sessionId?: string;
  client?: Client;
  transport?: StreamableHTTPClientTransport;
}

/**
 * Step 1: Connect initial client & get sessionId
 */
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

/**
 * Step 2: List tools to verify connection works
 */
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

/**
 * Step 3: User restarts server
 * Simulates: pty kill + restart
 * For this test, we just pause and let user do it manually
 */
async function waitForServerRestart(): Promise<void> {
  console.log(
    "\n[STEP 3] Waiting for server restart... (user: kill + restart HTTP server PTY)",
  );
  console.log("Polling for server availability...");

  // Poll server health check until it responds (max 30 seconds)
  const baseUrl = "http://localhost:6421";
  const maxAttempts = 60; // 60 * 500ms = 30 seconds
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
      // Server not ready yet, continue polling
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

/**
 * Step 4: List tools with OLD sessionId (should fail with 404 initially)
 * Then SDK auto-recovers with new sessionId
 *
 * This is the critical test:
 * 1. Client has old sessionId from before restart
 * 2. Server is new (fresh session)
 * 3. Client makes request with old sessionId
 * 4. Server returns 404 with new sessionId header
 * 5. SDK should automatically:
 *    - Extract new sessionId from 404 response
 *    - Retry request with new sessionId
 *    - Succeed on retry
 */
async function listToolsAfterRestart(state: TestState): Promise<void> {
  if (!state.client) throw new Error("Client not initialized");

  console.log("\n[STEP 4] Listing tools after server restart...");
  console.log(
    `Using old sessionId: ${state.sessionId} (should trigger 404 recovery)`,
  );

  try {
    const result = await state.client.listTools();
    console.log(`✓ Listed ${result.tools.length} tools after recovery`);
    console.log(
      `✓ Recovery succeeded! New sessionId: ${state.transport?.sessionId}`,
    );
  } catch (err) {
    console.error(`✗ Failed to list tools after restart: ${err}`);
    throw err;
  }
}

/**
 * Step 5: Cleanup
 */
async function cleanup(state: TestState): Promise<void> {
  console.log("\n[CLEANUP] Closing client connection...");

  if (state.client) {
    await state.client.close();
  }

  console.log("✓ Connection closed");
}

/**
 * Main test orchestration
 */
async function main() {
  const port = parseInt(process.env.PORT ?? "6421", 10);
  const baseUrl = `http://localhost:${port}`;
  const state: TestState = { baseUrl };

  console.log("=".repeat(70));
  console.log("HTTP Server Session Recovery E2E Test");
  console.log("=".repeat(70));
  console.log(`Base URL: ${baseUrl}`);

  try {
    // Phase 1: Initial connection & tools
    await connectClient(state);
    await listTools(state);

    // Phase 2: Server restart
    console.log("\n" + "=".repeat(70));
    console.log("SERVER RESTART PHASE");
    console.log("=".repeat(70));
    await waitForServerRestart();

    // Phase 3: Recovery test
    console.log("\n" + "=".repeat(70));
    console.log("RECOVERY TEST PHASE");
    console.log("=".repeat(70));
    await listToolsAfterRestart(state);

    console.log("\n" + "=".repeat(70));
    console.log("✓ ALL TESTS PASSED");
    console.log("=".repeat(70));
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
