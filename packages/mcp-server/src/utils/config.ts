import { existsSync } from "node:fs";
import { join } from "node:path";
import { createLogger } from "@pkgs/logger";

const logger = createLogger("config");

/**
 * XDG Base Directory specification compliant config path resolver
 * @see https://specifications.freedesktop.org/basedir-spec/latest/
 */
export const getConfigDir = (): string => {
  const xdgConfig = process.env.XDG_CONFIG_HOME;
  const home = process.env.HOME ?? process.env.USERPROFILE;

  if (!home) {
    logger.warn("HOME or USERPROFILE environment variable not found");
    return ".config/mcp-pty";
  }

  return xdgConfig
    ? join(xdgConfig, "mcp-pty")
    : join(home, ".config", "mcp-pty");
};

/**
 * Configuration schema
 */
export type McpPtyConfig = {
  /**
   * Transport type: stdio or http
   * @default "stdio"
   */
  transport?: "stdio" | "http";
  /**
   * HTTP server port (only for http transport)
   * @default 3000
   */
  port?: number;
  /**
   * Deactivate MCP resources (use tools instead)
   * @default false
   */
  deactivateResources?: boolean;
};

/**
 * Load configuration from XDG config directory
 * Falls back to environment variables if config file not found
 * @returns resolved configuration
 */
export const loadConfig = async (): Promise<McpPtyConfig> => {
  const configDir = getConfigDir();
  const configPath = join(configDir, "config.json");

  // Try loading from file
  if (existsSync(configPath)) {
    try {
      const file = Bun.file(configPath);
      const config = await file.json();
      // logger.info(`Loaded config from ${configPath}`);
      return config;
    } catch (error) {
      // logger.warn(`Failed to parse config file: ${configPath}`, error);
    }
  }

  // Fallback to environment variables
  const config: McpPtyConfig = {
    deactivateResources: process.env.MCP_PTY_DEACTIVATE_RESOURCES === "true",
  };

  // logger.info("Using default configuration (no config file found)");
  return config;
};
