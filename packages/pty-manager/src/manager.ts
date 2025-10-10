import { PtyProcess } from "./process";
import type { PtyInstance, PtySession } from "./types";
import { checkRootPermission } from "./utils/safety";

/**
 * PTY Manager 클래스
 * sessionId를 기반으로 PTY 인스턴스들을 관리
 */
export class PtyManager {
  private readonly sessionId: string;
  private readonly instances = new Map<string, PtyInstance>();

  constructor(sessionId: string) {
    // 루트 권한 실행 안전장치 체크
    checkRootPermission();
    this.sessionId = sessionId;
  }

  /**
   * 새 PTY 인스턴스 생성
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

    // 상태 변경 모니터링 (간단히)
    process.process.onExit(() => {
      instance.status = "terminated";
    });

    return process.id;
  }

  /**
   * PTY 인스턴스 가져오기
   */
  public getPty(processId: string): PtyInstance | undefined {
    return this.instances.get(processId);
  }

  /**
   * 모든 PTY 인스턴스 목록
   */
  public getAllPtys(): PtyInstance[] {
    return Array.from(this.instances.values());
  }

  /**
   * PTY 인스턴스 삭제
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
   * 세션 정보
   */
  public getSession(): PtySession {
    return {
      sessionId: this.sessionId,
      instances: this.instances,
      createdAt: new Date(), // TODO: 세션 생성 시간 관리
    };
  }

  /**
   * 모든 PTY 정리
   */
  public dispose(): void {
    for (const instance of this.instances.values()) {
      instance.process.kill();
      instance.terminal.dispose();
    }
    this.instances.clear();
  }
}
