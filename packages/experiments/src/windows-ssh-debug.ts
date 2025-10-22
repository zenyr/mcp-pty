import { spawn } from "@zenyr/bun-pty";

/**
 * Detailed debugging: capture all raw bytes from interactive SSH
 */
const main = async (): Promise<void> => {
  const HOST = "zblade14";

  console.log(`📊 Opening interactive SSH to ${HOST}...`);
  console.log("   Will capture all output with hex dump\n");

  let totalBytes = 0;
  let packetCount = 0;
  const buffers: Buffer[] = [];

  const pty = spawn("ssh", [HOST], {
    name: "xterm-256color",
    cols: 80,
    rows: 24,
  });

  const dataHandler = pty.onData((data) => {
    packetCount++;
    const bytes = Buffer.from(data, "utf8");
    totalBytes += bytes.length;
    buffers.push(bytes);

    console.log(`\n[Packet ${packetCount}] ${bytes.length} bytes:`);
    console.log(`   Raw: ${JSON.stringify(data)}`);
    console.log(`   Hex: ${bytes.toString("hex")}`);
    console.log(`   Has '>': ${data.includes(">")}`);
    console.log(`   Has 'C:\\': ${data.includes("C:\\")}`);
  });

  const exitHandler = pty.onExit(({ exitCode, signal }) => {
    console.log(`\n[EXIT] Code: ${exitCode}, Signal: ${signal}`);
  });

  // Wait for initial prompt
  await new Promise((resolve) => setTimeout(resolve, 2000));

  console.log("\n>>> Sending: whoami");
  pty.write("whoami\n");

  // Wait for response
  await new Promise((resolve) => setTimeout(resolve, 2000));

  console.log("\n>>> Sending: echo TEST123");
  pty.write("echo TEST123\n");

  // Wait for response
  await new Promise((resolve) => setTimeout(resolve, 2000));

  console.log("\n>>> Sending: exit");
  pty.write("exit\n");

  // Wait for exit
  await new Promise((resolve) => setTimeout(resolve, 2000));

  dataHandler.dispose();
  exitHandler.dispose();
  pty.kill();

  // Summary
  console.log("\n" + "=".repeat(60));
  console.log("Summary");
  console.log("=".repeat(60));
  console.log(`Total bytes received: ${totalBytes}`);
  console.log(`Total packets: ${packetCount}`);
  console.log(
    `Average packet size: ${Math.round(totalBytes / packetCount)} bytes`,
  );

  // Dump full output
  const fullOutput = Buffer.concat(buffers).toString("utf8");
  console.log("\nFull output (cleaned):");
  console.log(fullOutput.replace(/\r\r/g, "\r"));
};

main().catch(console.error);
