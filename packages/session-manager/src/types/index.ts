/**
 * Session ID type. ULID-based string.
 */
export type SessionId = string;

/**
 * Session status type.
 * - initializing: Session initializing
 * - active: Active state, PTY commands executable
 * - idle: Idle state, no commands executed
 * - terminating: Terminating
 * - terminated: Fully terminated
 */
export type SessionStatus =
  | "initializing"
  | "active"
  | "idle"
  | "terminating"
  | "terminated";

/**
 * PTY instance reference type. Represents processId.
 */
export type PtyInstanceReference = string;

/**
 * Session interface.
 */
export interface Session {
  /** Unique session ID */
  readonly id: SessionId;
  /** Current session status */
  status: SessionStatus;
  /** Session creation time */
  readonly createdAt: Date;
  /** Last activity time */
  lastActivity: Date;
  /** Set of processIds of connected PTY instances */
  ptyInstances: Set<PtyInstanceReference>;
  /** Additional metadata (expand as needed) */
  metadata?: Record<string, unknown>;
}

/**
 * PTY binding interface. Used when binding PTY to session.
 */
export interface PtyBinding {
  /** Session ID */
  sessionId: SessionId;
  /** PTY processId */
  processId: PtyInstanceReference;
}

/**
 * Session event type.
 */
export type SessionEvent =
  | { type: "created"; sessionId: SessionId }
  | {
      type: "statusChanged";
      sessionId: SessionId;
      from: SessionStatus;
      to: SessionStatus;
    }
  | { type: "ptyBound"; sessionId: SessionId; processId: PtyInstanceReference }
  | {
      type: "ptyUnbound";
      sessionId: SessionId;
      processId: PtyInstanceReference;
    }
  | { type: "terminated"; sessionId: SessionId };
