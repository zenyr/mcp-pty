import { Terminal } from "@xterm/headless";
import { spawn } from "bun-pty";
import { nanoid } from "nanoid";
import type { PtyStatus, TerminalOutput, PtyOptions } from "./types";
import { checkSudoPermission, checkExecutablePermission } from "./utils/safety";

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
  public readonly options: PtyOptions;

  private outputBuffer: string = "";
  private outputCallbacks: ((output: TerminalOutput) => void)[] = [];

  constructor(commandOrOptions: string | PtyOptions) {
    const options =
      typeof commandOrOptions === "string"
        ? { executable: commandOrOptions }
        : commandOrOptions;

    this.id = nanoid();
    this.createdAt = new Date();
    this.lastActivity = new Date();
    this.options = options;

    // 보안 체크: 실행 파일 sudo 여부 확인
    checkExecutablePermission(options.executable);

    // xterm headless 초기화
    this.terminal = new Terminal({
      cols: 80,
      rows: 24,
      allowTransparency: false,
    });

    // bun-pty 프로세스 생성 (직접 프로그램 실행)
    this.process = spawn(options.executable, options.args || [], {
      name: "xterm-256color",
      cols: 80,
      rows: 24,
      cwd: options.cwd || process.cwd(),
      env: { ...process.env, ...options.env } as Record<string, string>,
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

    // 프로세스 종료 처리: autoDisposeOnExit 옵션에 따라 dispose 트리거
    this.process.onExit(({ exitCode, signal }) => {
      this.status = "terminated";
      console.log(
        `PTY ${this.id} exited with code ${exitCode}, signal ${signal}`
      );

      if (this.options.autoDisposeOnExit) {
        this.dispose("SIGTERM").catch(console.error); // 자동 클린업
      }
    });
  }

  /**
   * 인터랙티브 입력 또는 명령 쓰기 (쉘 프롬프트 없이 직접 프로그램에 전달)
   * @param input - 키 입력 또는 명령 문자열 (예: vi 모드에서 'i' 또는 전체 명령)
   */
  public writeInput(input: string): void {
    if (this.status !== "active") {
      throw new Error(`PTY ${this.id} is not active`);
    }

    // sudo 관련 입력 체크 (보안)
    checkSudoPermission(input); // 기존 함수 재사용 (입력에 "sudo" 포함 시)

    this.terminal.write(input + "\n"); // \n으로 엔터 시뮬 (인터랙티브 적합)
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
   * 자원 정리 (Graceful shutdown 포함)
   * @param signal - 종료 신호 (기본: SIGTERM). 3초 후 응답 없으면 SIGKILL로 전환.
   */
  public async dispose(signal: string = "SIGTERM"): Promise<void> {
    if (this.status === "terminated") return;

    this.status = "terminating";

    // Graceful shutdown: SIGTERM 후 3초 타임아웃
    const timeout = 3000;
    const killPromise = new Promise<void>((resolve) => {
      const timer = setTimeout(() => {
        this.process.kill("SIGKILL");
        resolve();
      }, timeout);

      this.process.onExit(() => {
        clearTimeout(timer);
        resolve();
      });

      this.process.kill(signal);
    });

    await killPromise;

    // 추가 클린업
    this.terminal.dispose();
    this.outputBuffer = "";
    this.outputCallbacks = [];
    this.status = "terminated";

    console.log(`PTY ${this.id} disposed successfully`);
  }
}
