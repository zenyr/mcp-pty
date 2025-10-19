import { parseArgs } from "node:util";
import { logger } from "@pkgs/logger";
import { sessionManager } from "@pkgs/session-manager";

export * from "./config";
export * from "./path";

/**
 * Parse command line arguments
 * @returns parsed options (undefined if not provided)
 */
export const parseCliArgs = () => {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      transport: { type: "string", short: "t" },
      port: { type: "string", short: "p" },
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

 Config file: ~/.config/mcp-pty/config.json (XDG_CONFIG_HOME)
 `);
    process.exit(0);
  }

  const transport = values.transport as "stdio" | "http" | undefined;
  if (transport && transport !== "stdio" && transport !== "http") {
    throw new Error(
      `Invalid transport type: ${transport}. Must be "stdio" or "http".`,
    );
  }

  return {
    transport,
    port: values.port ? Number.parseInt(values.port, 10) : undefined,
  };
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
  const cleanup = async () => {
    const sessions = sessionManager.getAllSessions();
    const cleanupPromise = Promise.allSettled(
      sessions.map((session) => sessionManager.disposeSession(session.id)),
    );
    const timeoutPromise = new Promise((resolve) => setTimeout(resolve, 5000));

    await Promise.race([cleanupPromise, timeoutPromise]);
    process.exit(0);
  };

  process.on("SIGTERM", cleanup);
  process.on("SIGINT", cleanup);
};

/**
 * Server logging utility
 * @param message server message
 */
export const logServer = (message: string): void => {
  logger.info(message);
};

/**
 * Error logging utility
 * @param message error message
 * @param error error object
 */
export const logError = (message: string, error: unknown): void => {
  logger.error(message, error);
};
