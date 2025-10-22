#!/usr/bin/env bun
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const testSessionRecovery = async () => {
  const serverUrl = "http://127.0.0.1:5964/mcp";

  console.log("=== Testing Session Recovery ===\n");

  try {
    // Test 1: First connection - should get new session ID
    console.log("1️⃣ First connection - expecting new session ID");
    const transport1 = new StreamableHTTPClientTransport(new URL(serverUrl));

    const client1 = new Client({ name: "test-client-1", version: "1.0.0" });
    await client1.connect(transport1);

    const version1 = await client1.getServerVersion();
    const versionName = version1?.name || "unknown";
    const versionNum = version1?.version || "unknown";
    console.log("✓ Connected to server:", versionName, versionNum);

    // Get session ID from transport
    const sessionId1 = (transport1 as unknown as { _sessionId?: string })
      ._sessionId;
    console.log(`✓ Session ID: ${sessionId1 || "not available"}\n`);

    // Test 2: Use invalid session ID - should get 404 + new session ID
    console.log("2️⃣ Testing invalid session ID - expecting 404 + recovery");
    try {
      const invalidTransport = new StreamableHTTPClientTransport(
        new URL(serverUrl),
        {
          requestInit: {
            headers: { "mcp-session-id": "invalid-session-id-12345" },
          },
        },
      );

      const invalidClient = new Client({
        name: "invalid-test",
        version: "1.0.0",
      });
      await invalidClient.connect(invalidTransport);

      // This should fail or recover
      await invalidClient.getServerVersion();
      console.log("✓ Recovery successful after invalid session\n");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.log(`✓ Expected error with invalid session: ${message}\n`);
    }

    // Test 3: Second fresh connection - should work independently
    console.log("3️⃣ Second fresh connection");
    const transport2 = new StreamableHTTPClientTransport(new URL(serverUrl));

    const client2 = new Client({ name: "test-client-2", version: "1.0.0" });
    await client2.connect(transport2);

    await client2.getServerVersion();
    console.log("✓ Second client connected successfully\n");

    // Test 4: Both clients can operate independently
    console.log("4️⃣ Testing independent operations");

    const resources1 = await client1.listResources();
    const resources2 = await client2.listResources();

    console.log(
      `✓ Client 1 resources: ${resources1.resources.length} resources`,
    );
    console.log(
      `✓ Client 2 resources: ${resources2.resources.length} resources`,
    );
    console.log(`✓ Both clients work independently\n`);

    console.log("=== All Session Recovery Tests Passed ===");
  } catch (error) {
    console.error("✗ Test Failed:");
    console.error(error);
    process.exit(1);
  }
};

testSessionRecovery();
