import type {
  Session,
  SessionId,
  SessionStatus,
  PtyInstanceReference,
  SessionEvent,
} from "./types/index.ts";
import { generateSessionId } from "./utils/ulid.ts";
import { consola } from "consola";

/**
 * 세션 관리자 클래스.
 * 세션의 생성, 조회, 삭제 및 PTY 바인딩을 관리합니다.
 */
export class SessionManager {
  private sessions = new Map<SessionId, Session>();
  private eventListeners = new Set<(event: SessionEvent) => void>();
  private monitorInterval?: Timer;

  /**
   * 새로운 세션을 생성합니다.
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
    this.emitEvent({ type: "created", sessionId: id });
    consola.info(`Session created: ${id}`);

    return id;
  }

  /**
   * 세션을 조회합니다.
   */
  getSession(id: SessionId): Session | undefined {
    return this.sessions.get(id);
  }

  /**
   * 모든 세션을 조회합니다.
   */
  getAllSessions(): Session[] {
    return Array.from(this.sessions.values());
  }

  /**
   * 세션을 삭제합니다.
   */
  deleteSession(id: SessionId): boolean {
    const session = this.sessions.get(id);
    if (!session) return false;

    this.sessions.delete(id);
    this.emitEvent({ type: "terminated", sessionId: id });
    consola.info(`Session deleted: ${id}`);

    return true;
  }

  /**
   * 세션 상태를 업데이트합니다.
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
   * PTY 인스턴스를 세션에 바인딩합니다.
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
   * PTY 인스턴스를 세션에서 제거합니다.
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
   * 이벤트 리스너를 추가합니다.
   */
  addEventListener(listener: (event: SessionEvent) => void): void {
    this.eventListeners.add(listener);
  }

  /**
   * 이벤트 리스너를 제거합니다.
   */
  removeEventListener(listener: (event: SessionEvent) => void): void {
    this.eventListeners.delete(listener);
  }

  /**
   * 이벤트를 방출합니다.
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
   * 세션을 종료합니다. terminating 상태로 변경 후 terminated로.
   */
  terminateSession(id: SessionId): boolean {
    const session = this.sessions.get(id);
    if (!session || session.status === "terminated") return false;

    this.updateStatus(id, "terminating");
    // TODO: PTY 인스턴스 정리 로직 추가 (pty-manager 연동 시)
    this.updateStatus(id, "terminated");

    return true;
  }

  /**
   * idle 세션들을 모니터링하고 5분 후 종료합니다.
   */
  monitorIdleSessions(): void {
    const now = Date.now();
    const idleTimeout = 5 * 60 * 1000; // 5분

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
   * idle 세션 모니터링을 시작합니다. 1분마다 체크합니다.
   */
  startMonitoring(): void {
    if (this.monitorInterval) return; // 이미 실행 중

    this.monitorInterval = setInterval(() => {
      this.monitorIdleSessions();
    }, 60 * 1000); // 1분마다
    consola.info("Session monitoring started");
  }

  /**
   * idle 세션 모니터링을 중지합니다.
   */
  stopMonitoring(): void {
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = undefined;
      consola.info("Session monitoring stopped");
    }
  }

  /**
   * 모든 세션을 정리하고 모니터링을 중지합니다.
   * Graceful shutdown을 위해 사용합니다.
   */
  cleanup(): void {
    this.stopMonitoring();

    for (const session of this.sessions.values()) {
      if (session.status !== "terminated") {
        this.terminateSession(session.id);
      }
    }

    this.sessions.clear();
    this.eventListeners.clear();
    consola.info("Session manager cleanup completed");
  }

  /**
   * 세션 수를 반환합니다.
   */
  getSessionCount(): number {
    return this.sessions.size;
  }
}

// 기본 인스턴스 export
export const sessionManager = new SessionManager();
