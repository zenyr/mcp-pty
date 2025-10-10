import type { Terminal } from "@xterm/headless";
import type { IPty } from "bun-pty";

/**
 * PTY Manager 타입 정의
 * MCP 프로토콜에 대한 의존 없이 순수한 PTY 관리용 타입
 */

/**
 * PTY 프로세스 상태
 */
export type PtyStatus =
  | "initializing"
  | "active"
  | "idle"
  | "terminating"
  | "terminated";

export interface PtyInstance {
  /** 프로세스 고유 ID (nanoid 기반) */
  id: string;
  /** 현재 상태 */
  status: PtyStatus;
  /** xterm headless 터미널 인스턴스 */
  terminal: Terminal;
  /** bun-pty 프로세스 인스턴스 */
  process: IPty;
  /** 생성 시각 */
  createdAt: Date;
  /** 마지막 활동 시각 */
  lastActivity: Date;
}

/**
 * PTY 세션 인터페이스
 * 하나의 세션에 속한 모든 PTY 인스턴스를 관리
 */
export interface PtySession {
  /** 세션 고유 ID (ULID, session-manager에서 전달) */
  sessionId: string;
  /** processId -> PtyInstance 매핑 */
  instances: Map<string, PtyInstance>;
  /** 세션 생성 시각 */
  createdAt: Date;
}

/**
 * 터미널 출력 인터페이스
 */
export interface TerminalOutput {
  /** 출력이 발생한 프로세스 ID */
  processId: string;
  /** 출력 내용 */
  output: string;
  /** ANSI 시퀀스 제거 여부 */
  ansiStripped?: boolean;
  /** 출력 시각 */
  timestamp: Date;
}

/**
 * PtyProcess 생성 옵션 인터페이스
 */
export interface PtyOptions {
  /** 실행할 프로그램 (예: "vi", "bash") */
  executable: string;
  /** 프로그램에 전달할 인자 */
  args?: string[];
  /** 작업 디렉토리 */
  cwd?: string;
  /** 환경 변수 오버라이드 */
  env?: Record<string, string>;
  /** 프로그램 종료 시 자동 dispose 여부 (인터랙티브 프로그램용) */
  autoDisposeOnExit?: boolean;
}
