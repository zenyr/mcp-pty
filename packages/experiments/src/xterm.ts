import { appendFile } from "node:fs/promises";
import { Terminal } from "@xterm/headless";
import type { IPty } from "bun-pty";
import { spawn } from "bun-pty";

/**
 * Helper function to log to file
 */
const logToFile = async (filePath: string, message: string) => {
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] ${message}\n`;
  await appendFile(filePath, logEntry);
};

/**
 * TUI app (man) test: xterm.js integration, terminal sizing, search support check
 */
const testTuiMan = async () => {
  const logFile = "xterm.tui.log";

  // Initialize log file
  await Bun.write(Bun.file(logFile), "");

  await logToFile(logFile, "=== Starting TUI Man Test ===");

  // Create xterm.js terminal
  const xterm = new Terminal({ cols: 80, rows: 24, allowProposedApi: true });

  // Run man ls with bun-pty (PTY support)
  const pty: IPty = spawn("man", ["ls"], {
    name: "xterm-256color",
    cols: 80,
    rows: 24,
    env: process.env as Record<string, string>,
  });

  await logToFile(logFile, "man ls started with bun-pty (cols=80 rows=24)");

  // Capture output with onData
  pty.onData((data: string) => {
    xterm.write(data);
  });

  // Wait for initial output
  await new Promise((resolve) => setTimeout(resolve, 2000));

  // Capture first screen
  const captureScreen = (label: string): string => {
    const buffer = xterm.buffer.active;
    let screenText = `${label}\n`;
    for (let i = 0; i < Math.min(buffer.length, 24); i++) {
      const line = buffer.getLine(i);
      if (line) {
        screenText += `${line.translateToString()}\n`;
      }
    }
    return screenText;
  };

  const initialScreen = captureScreen("Initial Screen:");
  await logToFile(logFile, initialScreen);

  // Input /SYNOPSIS search
  await logToFile(logFile, "Sending /SYNOPSIS for search");
  pty.write("/SYNOPSIS\n");
  await new Promise((resolve) => setTimeout(resolve, 1000));

  // Capture screen after search
  const searchedScreen = captureScreen("After /SYNOPSIS search:");
  await logToFile(logFile, searchedScreen);

  // Exit with q input
  await logToFile(logFile, "Sending 'q' to exit");
  pty.write("q\n");

  // Wait for exit with onExit
  await new Promise((resolve) => {
    pty.onExit(({ exitCode, signal }) => {
      logToFile(
        logFile,
        `Process ended with exit code: ${exitCode}, signal: ${signal}`,
      );
      resolve(void 0);
    });
  });

  await logToFile(logFile, "=== TUI Man Test Ended ===");
};

// Execute
if (import.meta.main) {
  testTuiMan().catch(console.error);
}

export { testTuiMan };
