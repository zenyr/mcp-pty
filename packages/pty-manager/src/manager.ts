import { PtyProcess } from "./process";
import type { PtyInstance, PtySession } from "./types";
import { checkRootPermission } from "./utils/safety";

/**
 * PTY Manager class
 * Manages PTY instances based on sessionId
 */
export class PtyManager {
  private readonly sessionId: string;
  private readonly instances = new Map<string, PtyInstance>();

  constructor(sessionId: string) {
    // Check root privilege execution safety
    checkRootPermission();
    this.sessionId = sessionId;
  }

  /**
   * Create new PTY instance
   */
  public createPty(command: string): string {
    const process = new PtyProcess(command);
    const instance: PtyInstance = {
      id: process.id,
      status: process.status,
      terminal: process.terminal,
      process: process.process,
      createdAt: process.createdAt,
      lastActivity: process.lastActivity,
    };

    this.instances.set(process.id, instance);

    // Monitor status changes (simply)
    process.process.onExit(() => {
      instance.status = "terminated";
    });

    return process.id;
  }

  /**
   * Get PTY instance
   */
  public getPty(processId: string): PtyInstance | undefined {
    return this.instances.get(processId);
  }

  /**
   * List all PTY instances
   */
  public getAllPtys(): PtyInstance[] {
    return Array.from(this.instances.values());
  }

  /**
   * Remove PTY instance
   */
  public removePty(processId: string): boolean {
    const instance = this.instances.get(processId);
    if (instance) {
      instance.process.kill();
      instance.terminal.dispose();
      return this.instances.delete(processId);
    }
    return false;
  }

  /**
   * Get session info
   */
  public getSession(): PtySession {
    return {
      sessionId: this.sessionId,
      instances: this.instances,
      createdAt: new Date(), // TODO: Manage session creation time
    };
  }

  /**
   * Dispose all PTYs
   */
  public dispose(): void {
    for (const instance of this.instances.values()) {
      instance.process.kill();
      instance.terminal.dispose();
    }
    this.instances.clear();
  }
}
