import { spawn } from "@zenyr/bun-pty";

const main = async (): Promise<void> => {
  const HOST = "zblade14";

  console.log(`📊 Opening interactive SSH to ${HOST}...`);
  console.log("   Waiting longer for command responses\n");

  let totalBytes = 0;
  let packetCount = 0;
  let firstCommandSent = false;

  const pty = spawn("ssh", [HOST], {
    name: "xterm-256color",
    cols: 80,
    rows: 24,
  });

  const dataHandler = pty.onData((data) => {
    packetCount++;
    totalBytes += data.length;

    const preview =
      data.length > 50
        ? `${JSON.stringify(data.substring(0, 50))}...`
        : JSON.stringify(data);

    console.log(`[Packet ${packetCount}] ${data.length} bytes: ${preview}`);

    // Check if we got command output
    if (firstCommandSent && data.includes("zenyr")) {
      console.log("   ✓ Got response after whoami!");
    }
  });

  const exitHandler = pty.onExit(({ exitCode }) => {
    console.log(`\n[EXIT] Code: ${exitCode}`);
  });

  // Wait for initial prompt
  console.log("⏳ Waiting 2s for initial prompt...");
  await new Promise((resolve) => setTimeout(resolve, 2000));

  console.log("\n>>> Sending: whoami\\n");
  pty.write("whoami\n");
  firstCommandSent = true;

  // Wait longer for response
  console.log("⏳ Waiting 3s for whoami response...");
  await new Promise((resolve) => setTimeout(resolve, 3000));

  console.log("\n>>> Sending: dir C:\\\\Users\\n");
  pty.write("dir C:\\Users\n");

  // Wait for response
  console.log("⏳ Waiting 3s for dir response...");
  await new Promise((resolve) => setTimeout(resolve, 3000));

  console.log("\n>>> Sending: exit\\n");
  pty.write("exit\n");

  // Wait for exit
  console.log("⏳ Waiting 2s for exit...");
  await new Promise((resolve) => setTimeout(resolve, 2000));

  dataHandler.dispose();
  exitHandler.dispose();
  pty.kill();

  console.log("\n" + "=".repeat(60));
  console.log(`Total: ${totalBytes} bytes in ${packetCount} packets`);
  console.log("=".repeat(60));
};

main().catch(console.error);
