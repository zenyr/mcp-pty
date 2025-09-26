/**
 * 세션 ID 타입. ULID 기반의 문자열입니다.
 */
export type SessionId = string;

/**
 * 세션 상태 타입.
 * - initializing: 세션 초기화 중
 * - active: 활성 상태, PTY 명령 실행 가능
 * - idle: 유휴 상태, 명령이 실행되지 않은 상태
 * - terminating: 종료 중
 * - terminated: 완전히 종료됨
 */
export type SessionStatus =
  | "initializing"
  | "active"
  | "idle"
  | "terminating"
  | "terminated";

/**
 * PTY 인스턴스 참조 타입. processId를 나타냅니다.
 */
export type PtyInstanceReference = string;

/**
 * 세션 인터페이스.
 */
export interface Session {
  /** 세션 고유 ID */
  readonly id: SessionId;
  /** 현재 세션 상태 */
  status: SessionStatus;
  /** 세션 생성 시간 */
  readonly createdAt: Date;
  /** 마지막 활동 시간 */
  lastActivity: Date;
  /** 연결된 PTY 인스턴스들의 processId 집합 */
  ptyInstances: Set<PtyInstanceReference>;
  /** 추가 메타데이터 (필요시 확장) */
  metadata?: Record<string, unknown>;
}

/**
 * PTY 바인딩 인터페이스. 세션에 PTY를 바인딩할 때 사용.
 */
export interface PtyBinding {
  /** 세션 ID */
  sessionId: SessionId;
  /** PTY processId */
  processId: PtyInstanceReference;
}

/**
 * 세션 이벤트 타입.
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
