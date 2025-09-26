import { Terminal } from "@xterm/headless";
import { spawn } from "bun-pty";
import { nanoid } from "nanoid";
import type { PtyStatus, TerminalOutput } from "./types";
import { checkSudoPermission } from "./utils/safety";

/**
 * 개별 PTY 프로세스 관리 클래스
 */
export class PtyProcess {
  public readonly id: string;
  public status: PtyStatus = "initializing";
  public readonly terminal: Terminal;
  public readonly process: ReturnType<typeof spawn>;
  public readonly createdAt: Date;
  public lastActivity: Date;

  private outputBuffer: string = "";
  private outputCallbacks: ((output: TerminalOutput) => void)[] = [];

  constructor(shell: string = "bash") {
    this.id = nanoid();
    this.createdAt = new Date();
    this.lastActivity = new Date();

    // xterm headless 초기화
    this.terminal = new Terminal({
      cols: 80,
      rows: 24,
      allowTransparency: false,
    });

    // bun-pty 프로세스 생성
    this.process = spawn(shell, [], {
      name: "xterm-256color",
      cols: 80,
      rows: 24,
      cwd: process.cwd(),
      env: process.env as Record<string, string>,
    });

    this.setupStreams();
    this.status = "active";
  }

  /**
   * 스트림 설정
   */
  private setupStreams(): void {
    // 터미널 입력 -> 프로세스
    this.terminal.onData((data) => {
      this.process.write(data);
      this.updateActivity();
    });

    // 프로세스 출력 -> 터미널
    this.process.onData((data: string) => {
      this.terminal.write(data);
      this.outputBuffer += data;
      this.notifyOutput(data);
      this.updateActivity();
    });

    // 프로세스 종료 처리
    this.process.onExit(({ exitCode, signal }) => {
      this.status = "terminated";
      console.log(
        `PTY ${this.id} exited with code ${exitCode}, signal ${signal}`
      );
    });
  }

  /**
   * 명령 실행
   */
  public writeCommand(command: string): void {
    if (this.status !== "active") {
      throw new Error(`PTY ${this.id} is not active`);
    }

    checkSudoPermission(command);

    this.terminal.write(command + "\n");
    this.updateActivity();
  }

  /**
   * 출력 콜백 등록
   */
  public onOutput(callback: (output: TerminalOutput) => void): void {
    this.outputCallbacks.push(callback);
  }

  /**
   * 출력 알림
   */
  private notifyOutput(output: string): void {
    const terminalOutput: TerminalOutput = {
      processId: this.id,
      output,
      ansiStripped: false, // TODO: ANSI strip 옵션
      timestamp: new Date(),
    };
    this.outputCallbacks.forEach((cb) => cb(terminalOutput));
  }

  /**
   * 활동 시간 업데이트
   */
  private updateActivity(): void {
    this.lastActivity = new Date();
    if (this.status === "idle") {
      this.status = "active";
    }
  }

  /**
   * 프로세스 종료
   */
  public kill(signal: string = "SIGTERM"): void {
    this.status = "terminating";
    this.process.kill(signal);
  }

  /**
   * 정리
   */
  public dispose(): void {
    this.terminal.dispose();
    this.kill();
  }
}
