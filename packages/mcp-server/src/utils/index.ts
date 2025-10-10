import { sessionManager } from "@pkgs/session-manager";

/**
 * Parse command line arguments
 * @param args command line arguments
 * @returns transport type
 */
export const parseTransportType = (args: string[]): "stdio" | "http" => {
  return args[2] === "http" ? "http" : "stdio";
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

/**
 * Server status logging
 * @param message log message
 */
export const logServer = (message: string): void => {
  console.log(message);
};
