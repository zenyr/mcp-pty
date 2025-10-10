import { parseArgs } from "node:util";
import { sessionManager } from "@pkgs/session-manager";

/**
 * Parse command line arguments
 * @returns parsed options
 */
export const parseCliArgs = () => {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      transport: { type: "string", short: "t", default: "stdio" },
      port: { type: "string", short: "p", default: "3000" },
      help: { type: "boolean", short: "h", default: false },
    },
    strict: true,
    allowPositionals: false,
  });

  if (values.help) {
    process.stdout.write(`
 Usage: mcp-pty [options]

 Options:
   -t, --transport <type>  Transport type: stdio (default) or http
   -p, --port <port>       HTTP server port (default: 3000)
   -h, --help              Show this help message
 `);
    process.exit(0);
  }

  const transport = values.transport as "stdio" | "http";
  if (transport !== "stdio" && transport !== "http") {
    throw new Error(
      `Invalid transport type: ${transport}. Must be "stdio" or "http".`,
    );
  }

  return { transport, port: Number.parseInt(values.port as string, 10) };
};

/**
 * Initialize server and start monitoring
 */
export const initializeServer = (): void => {
  sessionManager.startMonitoring();
};

/**
 * Setup graceful shutdown
 */
export const setupGracefulShutdown = (): void => {
  const cleanup = () => {
    sessionManager.cleanup();
    process.exit(0);
  };

  process.on("SIGTERM", cleanup);
  process.on("SIGINT", cleanup);
};

/**
 * Error logging utility
 * @param message error message
 * @param error error object
 */
export const logError = (message: string, error: unknown): void => {
  console.error(`${message}:`, error);
};
