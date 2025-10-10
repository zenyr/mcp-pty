import { PtyProcess } from "./process";
import { checkRootPermission } from "./utils/safety";

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
   * Create new PTY instance
   */
  public createPty(command: string): string {
    const process = new PtyProcess(command);
    this.instances.set(process.id, process);
    return process.id;
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
      process.dispose().catch(console.error);
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
      process.dispose().catch(console.error);
    }
    this.instances.clear();
  }
}
