import type {
  Session,
  SessionId,
  SessionStatus,
  PtyInstanceReference,
  SessionEvent,
} from "./types/index.ts";
import { generateSessionId } from "./utils/ulid.ts";
import { consola } from "consola";
import { PtyManager } from "@pkgs/pty-manager";

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
    const id = generateSessionId();
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
    consola.info(`Session created: ${id}`);

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
    consola.info(`Session deleted: ${id}`);

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
    consola.debug(`Session status changed: ${id} ${from} -> ${status}`);

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
    consola.debug(`PTY bound to session: ${id} -> ${processId}`);

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
      consola.debug(`PTY unbound from session: ${id} -> ${processId}`);
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
        consola.error("Event listener error:", error);
      }
    }
  }

  /**
   * Terminate session. Change to terminating status then terminated.
   */
  terminateSession(id: SessionId): boolean {
    const session = this.sessions.get(id);
    if (!session || session.status === "terminated") return false;

    this.updateStatus(id, "terminating");
    // TODO: Add PTY instance cleanup logic (when integrating pty-manager)
    this.updateStatus(id, "terminated");

    return true;
  }

  /**
   * Monitor idle sessions and terminate after 5 minutes.
   */
  monitorIdleSessions(): void {
    const now = Date.now();
    const idleTimeout = 5 * 60 * 1000; // 5 minutes

    for (const session of this.sessions.values()) {
      if (
        session.status === "idle" &&
        now - session.lastActivity.getTime() > idleTimeout
      ) {
        this.terminateSession(session.id);
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
    consola.info("Session monitoring started");
  }

  /**
   * Stop idle session monitoring.
   */
  stopMonitoring(): void {
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = undefined;
      consola.info("Session monitoring stopped");
    }
  }

  /**
   * Clean up all sessions and stop monitoring.
   * Used for graceful shutdown.
   */
  cleanup(): void {
    this.stopMonitoring();

    for (const session of this.sessions.values()) {
      if (session.status !== "terminated") {
        this.terminateSession(session.id);
      }
    }

    this.sessions.clear();
    this.ptyManagers.clear();
    this.eventListeners.clear();
    consola.info("Session manager cleanup completed");
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
