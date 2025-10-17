import { createLogger } from "@pkgs/logger";
import { PtyManager } from "@pkgs/pty-manager";
import { ulid } from "ulid";
import type {
  PtyInstanceReference,
  Session,
  SessionEvent,
  SessionId,
  SessionStatus,
} from "./types/index.ts";

const logger = createLogger("session-manager");

/**
 * Session manager class.
 * Manages session creation, retrieval, deletion, and PTY binding.
 */
export class SessionManager {
  private sessions = new Map<SessionId, Session>();
  private eventListeners = new Set<(event: SessionEvent) => void>();
  private monitorInterval?: ReturnType<typeof setInterval>;
  private ptyManagers = new Map<SessionId, PtyManager>();

  /**
   * Create new session.
   */
  createSession(): SessionId {
    const id = ulid();
    const session: Session = {
      id,
      status: "initializing",
      createdAt: new Date(),
      lastActivity: new Date(),
      ptyInstances: new Set(),
    };

    this.sessions.set(id, session);
    this.ptyManagers.set(id, new PtyManager(id));
    this.emitEvent({ type: "created", sessionId: id });
    logger.info(`Session created: ${id}`);

    return id;
  }

  /**
   * Retrieve session.
   */
  getSession(id: SessionId): Session | undefined {
    return this.sessions.get(id);
  }

  /**
   * Retrieve all sessions.
   */
  getAllSessions(): Session[] {
    return Array.from(this.sessions.values());
  }

  /**
   * Delete session.
   */
  deleteSession(id: SessionId): boolean {
    const session = this.sessions.get(id);
    if (!session) return false;

    this.ptyManagers.get(id)?.dispose();
    this.ptyManagers.delete(id);
    this.sessions.delete(id);
    this.emitEvent({ type: "terminated", sessionId: id });
    logger.info(`Session deleted: ${id}`);

    return true;
  }

  /**
   * Update session status.
   */
  updateStatus(id: SessionId, status: SessionStatus): boolean {
    const session = this.sessions.get(id);
    if (!session) return false;

    const from = session.status;
    session.status = status;
    session.lastActivity = new Date();

    this.emitEvent({ type: "statusChanged", sessionId: id, from, to: status });
    logger.debug(`Session status changed: ${id} ${from} -> ${status}`);

    return true;
  }

  /**
   * Bind PTY instance to session.
   */
  addPty(id: SessionId, processId: PtyInstanceReference): boolean {
    const session = this.sessions.get(id);
    if (!session) return false;

    session.ptyInstances.add(processId);
    session.lastActivity = new Date();

    this.emitEvent({ type: "ptyBound", sessionId: id, processId });
    logger.debug(`PTY bound to session: ${id} -> ${processId}`);

    return true;
  }

  /**
   * Remove PTY instance from session.
   */
  removePty(id: SessionId, processId: PtyInstanceReference): boolean {
    const session = this.sessions.get(id);
    if (!session) return false;

    const removed = session.ptyInstances.delete(processId);
    if (removed) {
      session.lastActivity = new Date();
      this.emitEvent({ type: "ptyUnbound", sessionId: id, processId });
      logger.debug(`PTY unbound from session: ${id} -> ${processId}`);
    }

    return removed;
  }

  /**
   * Add event listener.
   */
  addEventListener(listener: (event: SessionEvent) => void): void {
    this.eventListeners.add(listener);
  }

  /**
   * Remove event listener.
   */
  removeEventListener(listener: (event: SessionEvent) => void): void {
    this.eventListeners.delete(listener);
  }

  /**
   * Emit event.
   */
  private emitEvent(event: SessionEvent): void {
    for (const listener of this.eventListeners) {
      try {
        listener(event);
      } catch (error) {
        logger.error("Event listener error:", error);
      }
    }
  }

  /**
   * Gracefully dispose session with SIGTERM and timeout fallback.
   * - Sends SIGTERM to all PTY processes
   * - Waits up to 3s for graceful exit
   * - Falls back to terminateSession() if timeout
   * - Cleans up session from memory
   */
  async disposeSession(id: SessionId): Promise<boolean> {
    const session = this.sessions.get(id);
    if (!session) return false;

    this.updateStatus(id, "terminating");
    logger.info(`Disposing session gracefully: ${id}`);

    const ptyManager = this.ptyManagers.get(id);
    if (ptyManager) {
      const ptys = ptyManager.getAllPtys();
      const gracefulTimeout = 3000;

      try {
        // Try graceful disposal (SIGTERM)
        await Promise.race([
          Promise.all(ptys.map((pty) => pty.dispose("SIGTERM"))),
          Bun.sleep(gracefulTimeout).then(() => {
            logger.warn(
              `Session ${id} graceful disposal timeout, forcing termination`,
            );
            return this.terminateSession(id);
          }),
        ]);
      } catch (error) {
        logger.error(`Error during graceful disposal of session ${id}:`, error);
        return this.terminateSession(id);
      }

      this.ptyManagers.delete(id);
    }

    this.sessions.delete(id);
    this.emitEvent({ type: "terminated", sessionId: id });
    logger.info(`Session disposed: ${id}`);

    return true;
  }

  /**
   * Forcefully terminate session immediately with SIGKILL.
   * - Sends SIGKILL to all PTY processes (no graceful exit)
   * - Immediately cleans up all resources
   * - Use when disposeSession() fails or immediate cleanup needed
   */
  terminateSession(id: SessionId): boolean {
    const session = this.sessions.get(id);
    if (!session) return false;

    logger.warn(`Force terminating session: ${id}`);
    this.updateStatus(id, "terminating");

    const ptyManager = this.ptyManagers.get(id);
    if (ptyManager) {
      const ptys = ptyManager.getAllPtys();
      // Force kill all PTYs synchronously
      for (const pty of ptys) {
        pty.dispose("SIGKILL").catch(() => {
          // Ignore errors during force kill
        });
      }
      this.ptyManagers.delete(id);
    }

    this.sessions.delete(id);
    this.updateStatus(id, "terminated");
    this.emitEvent({ type: "terminated", sessionId: id });
    logger.info(`Session terminated forcefully: ${id}`);

    return true;
  }

  /**
   * Monitor idle sessions and dispose after 5 minutes.
   */
  monitorIdleSessions(): void {
    const now = Date.now();
    const idleTimeout = 5 * 60 * 1000; // 5 minutes

    for (const session of this.sessions.values()) {
      if (
        session.status === "idle" &&
        now - session.lastActivity.getTime() > idleTimeout
      ) {
        void this.disposeSession(session.id);
      }
    }
  }

  /**
   * Start idle session monitoring. Checks every minute.
   */
  startMonitoring(): void {
    if (this.monitorInterval) return; // Already running

    this.monitorInterval = setInterval(() => {
      this.monitorIdleSessions();
    }, 60 * 1000); // Every minute
    logger.info("Session monitoring started");
  }

  /**
   * Stop idle session monitoring.
   */
  stopMonitoring(): void {
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = undefined;
      logger.info("Session monitoring stopped");
    }
  }

  /**
   * Return session count.
   */
  getSessionCount(): number {
    return this.sessions.size;
  }

  /**
   * Get PTY manager for session.
   */
  getPtyManager(sessionId: SessionId): PtyManager | undefined {
    return this.ptyManagers.get(sessionId);
  }
}

// Default instance export
export const sessionManager = new SessionManager();
