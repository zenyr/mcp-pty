import { consola } from "consola";

/**
 * Logger class for centralized logging
 */
export class Logger {
  private readonly scope?: string;

  constructor(scope?: string) {
    this.scope = scope;
  }

  /**
   * Log info message
   */
  info(message: string, ...args: unknown[]): void {
    if (this.scope) {
      consola.info(`[${this.scope}] ${message}`, ...args);
    } else {
      consola.info(message, ...args);
    }
  }

  /**
   * Log error message
   */
  error(message: string, error?: unknown, ...args: unknown[]): void {
    if (this.scope) {
      consola.error(`[${this.scope}] ${message}`, error, ...args);
    } else {
      consola.error(message, error, ...args);
    }
  }

  /**
   * Log warning message
   */
  warn(message: string, ...args: unknown[]): void {
    if (this.scope) {
      consola.warn(`[${this.scope}] ${message}`, ...args);
    } else {
      consola.warn(message, ...args);
    }
  }

  /**
   * Log debug message
   */
  debug(message: string, ...args: unknown[]): void {
    if (this.scope) {
      consola.debug(`[${this.scope}] ${message}`, ...args);
    } else {
      consola.debug(message, ...args);
    }
  }

  /**
   * Log success message
   */
  success(message: string, ...args: unknown[]): void {
    if (this.scope) {
      consola.success(`[${this.scope}] ${message}`, ...args);
    } else {
      consola.success(message, ...args);
    }
  }
}

// Default logger instance
export const logger = new Logger();

// Scoped loggers
export const createLogger = (scope: string): Logger => new Logger(scope);
