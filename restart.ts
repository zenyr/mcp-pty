import { $ } from "bun";

const main = async () => {
  try {
    // Step 1: Stop PM2 process 0
    console.log("Stopping PM2 process 0 (MCP-PTY HTTP)...");
    await $`pm2 stop 0`.quiet();
    console.log("✓ PM2 process stopped");

    // Step 2: Wait for port 1234 to be released
    console.log("Waiting for port 1234 to be released...");
    let portFree = false;
    let attempts = 0;
    const maxAttempts = 30; // 30 seconds max wait

    while (!portFree && attempts < maxAttempts) {
      const { exitCode } = await $`lsof -i :1234`.nothrow().quiet();
      portFree = exitCode !== 0;

      if (!portFree) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        attempts++;
        process.stdout.write(".");
      }
    }

    if (!portFree) {
      throw new Error("Port 1234 did not become free within 30 seconds");
    }

    console.log("\n✓ Port 1234 is now free");

    // Step 3: Start PM2 process again
    console.log("Starting PM2 process 0...");
    await $`pm2 start 0`.quiet();
    console.log("✓ PM2 process started");

    console.log("\n✅ Restart completed successfully");
  } catch (err) {
    console.error(
      "❌ Error during restart:",
      err instanceof Error ? err.message : err,
    );
    process.exit(1);
  }
};

if (import.meta.main) {
  main().catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
  });
}
