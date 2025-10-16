import { createLogger } from "@pkgs/logger";
import { PtyProcess } from "./process";
import type { PtyOptions } from "./types";
import { checkRootPermission } from "./utils/safety";

const logger = createLogger("pty-manager");

/**
 * PTY Manager class
 * Manages PTY instances based on sessionId
 */
export class PtyManager {
  private readonly sessionId: string;
  private readonly sessionCreatedAt: Date;
  private readonly instances = new Map<string, PtyProcess>();

  constructor(sessionId: string) {
    // Check root privilege execution safety
    checkRootPermission();
    this.sessionId = sessionId;
    this.sessionCreatedAt = new Date();
  }

  /**
   * Create new PTY instance and wait for initial output
   * @param commandOrOptions - Command string or PtyOptions
   * @param timeoutMs - Timeout in milliseconds (default: 500ms for command execution + output capture)
   * @returns Object with processId and initial screen content
   */
  public async createPty(
    commandOrOptions: string | PtyOptions,
    timeoutMs = 500,
  ): Promise<{ processId: string; screen: string }> {
    const process = new PtyProcess(commandOrOptions);
    this.instances.set(process.id, process);

    // Wait for shell setup (100ms) + command execution + output
    await new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, timeoutMs);

      // Resolve early only if process exits (command completed)
      process.process.onExit(() => {
        clearTimeout(timer);
        // Delay for final output buffering
        setTimeout(resolve, 50);
      });
    });

    return {
      processId: process.id,
      screen: process.captureBuffer().join("\n").trimEnd(),
    };
  }

  /**
   * Get PTY instance
   */
  public getPty(processId: string): PtyProcess | undefined {
    return this.instances.get(processId);
  }

  /**
   * List all PTY instances
   */
  public getAllPtys(): PtyProcess[] {
    return Array.from(this.instances.values());
  }

  /**
   * Remove PTY instance
   */
  public removePty(processId: string): boolean {
    const process = this.instances.get(processId);
    if (process) {
      process.dispose().catch(logger.error);
      return this.instances.delete(processId);
    }
    return false;
  }

  /**
   * Get session info
   */
  public getSessionInfo() {
    return {
      sessionId: this.sessionId,
      processCount: this.instances.size,
      createdAt: this.sessionCreatedAt,
    };
  }

  /**
   * Dispose all PTYs
   */
  public dispose(): void {
    for (const process of this.instances.values()) {
      process.dispose().catch(logger.error);
    }
    this.instances.clear();
  }
}
