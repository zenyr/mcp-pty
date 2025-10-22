#!/usr/bin/env bun
/**
 * Test: Multiple RPC calls on same session
 * Validates that transport can handle consecutive RPC calls
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

async function main() {
  const port = parseInt(process.env.PORT ?? "6421", 10);
  const baseUrl = `http://localhost:${port}`;

  console.log("=".repeat(70));
  console.log("Multiple RPC Calls on Same Session Test");
  console.log("=".repeat(70));

  try {
    const transport = new StreamableHTTPClientTransport(
      new URL(`${baseUrl}/mcp`),
    );

    const client = new Client({ name: "test-client", version: "1.0.0" });

    console.log("\n[TEST 1] Connecting to server...");
    await client.connect(transport);
    console.log(`✓ Connected. SessionId: ${transport.sessionId}`);

    console.log("\n[TEST 2] First listTools() call...");
    const result1 = await client.listTools();
    console.log(`✓ Listed ${result1.tools.length} tools (1st call)`);

    console.log("\n[TEST 3] Second listTools() call (same session)...");
    const result2 = await client.listTools();
    console.log(`✓ Listed ${result2.tools.length} tools (2nd call)`);

    console.log("\n[TEST 4] Third listTools() call (same session)...");
    const result3 = await client.listTools();
    console.log(`✓ Listed ${result3.tools.length} tools (3rd call)`);

    await client.close();

    console.log("\n" + "=".repeat(70));
    console.log("✓ ALL TESTS PASSED");
    console.log("=".repeat(70));
  } catch (err) {
    console.error("\n✗ TEST FAILED:", err);
    process.exit(1);
  }
}

main();
