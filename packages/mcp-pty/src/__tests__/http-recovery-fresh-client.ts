#!/usr/bin/env bun
/**
 * E2E test: verify server restart + fresh client works
 * (baseline test - no recovery needed)
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

async function main() {
  const port = parseInt(process.env.PORT ?? "6421", 10);
  const baseUrl = `http://localhost:${port}`;

  console.log("=".repeat(70));
  console.log("Fresh Client Connection Test (after server restart)");
  console.log("=".repeat(70));

  try {
    console.log("\n[TEST] Connecting fresh client to restarted server...");

    const transport = new StreamableHTTPClientTransport(
      new URL(`${baseUrl}/mcp`),
    );

    const client = new Client({ name: "fresh-client", version: "1.0.0" });

    await client.connect(transport);
    console.log(`✓ Connected with sessionId: ${transport.sessionId}`);

    console.log("\n[TEST] Listing tools...");
    const result = await client.listTools();
    console.log(`✓ Listed ${result.tools.length} tools`);

    await client.close();

    console.log("\n" + "=".repeat(70));
    console.log("✓ FRESH CLIENT TEST PASSED");
    console.log("=".repeat(70));
  } catch (err) {
    console.error("\n" + "=".repeat(70));
    console.error("✗ FRESH CLIENT TEST FAILED");
    console.error("=".repeat(70));
    console.error("Error:", err);
    process.exit(1);
  }
}

main();
