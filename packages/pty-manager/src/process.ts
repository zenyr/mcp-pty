import { createLogger } from "@pkgs/logger";
import { Terminal } from "@xterm/headless";
import type { IExitEvent, IPty } from "bun-pty";
import { spawn } from "bun-pty";
import { nanoid } from "nanoid";
import stripAnsi from "strip-ansi";
import type { PtyOptions, PtyStatus, TerminalOutput } from "./types";
import { checkSudoPermission } from "./utils/safety";

const logger = createLogger("pty-process");

interface Subscription {
  unsubscribe: () => void;
}

/**
 * Individual PTY process management class (bun-pty + xterm/headless)
 *
 * spawn.ts 기반 완전 재작성:
 * - IPty + xterm/headless 통합
 * - Subscribe 패턴으로 이벤트 관리
 * - Promise 변환 (toPromise)
 * - 터미널 버퍼 캡처 (captureBuffer)
 * - 리사이즈 지원 (resize)
 * - 안전한 dispose 처리
 */
export class PtyProcess {
  public readonly id: string;
  public status: PtyStatus = "initializing";
  public readonly terminal: Terminal;
  public readonly createdAt: Date;
  public lastActivity: Date;
  public readonly options: PtyOptions;

  private pty: IPty | null = null;
  private exitCode: number | null = null;
  private outputBuffer = "";
  private subscribers: Array<{
    onData: (data: string) => void;
    onError: (error: Error) => void;
    onComplete: () => void;
  }> = [];
  private initPromise: Promise<void>;
  private isDisposed = false;

  constructor(commandOrOptions: string | PtyOptions) {
    const options =
      typeof commandOrOptions === "string"
        ? { command: commandOrOptions }
        : commandOrOptions;

    this.id = nanoid();
    this.createdAt = new Date();
    this.lastActivity = new Date();
    this.options = options;

    // Security check
    checkSudoPermission(options.command);

    // Initialize xterm headless terminal
    this.terminal = new Terminal({
      cols: 80,
      rows: 24,
      convertEol: true,
      allowProposedApi: true,
    });

    this.initPromise = this.init();
  }

  private async init(): Promise<void> {
    const cmdParts = this.options.command.split(" ");
    const command = cmdParts[0] ?? this.options.command;
    const args = cmdParts.slice(1);

    this.pty = spawn(command, args, {
      name: "xterm-256color",
      cols: this.terminal.cols,
      rows: this.terminal.rows,
      cwd: this.options.cwd || process.cwd(),
      env: { ...process.env, ...this.options.env } as Record<string, string>,
    });

    // PTY output -> xterm and subscribers
    this.pty.onData((data: string) => {
      this.outputBuffer += data;
      this.terminal.write(data);
      this.updateActivity();

      // Notify subscribers with processed output
      const processedData = this.options.ansiStrip ? stripAnsi(data) : data;
      this.subscribers.forEach((sub) => void sub.onData(processedData));
    });

    // PTY exit
    this.pty.onExit((event: IExitEvent) => {
      this.exitCode = event.exitCode;
      this.status = "terminated";
      logger.info(`PTY ${this.id} exited with code ${event.exitCode}`);

      this.subscribers.forEach((sub) => void sub.onComplete());

      if (this.options.autoDisposeOnExit) {
        void this.dispose();
      }
    });

    // xterm -> PTY stdin
    this.terminal.onData((data: string) => {
      this.pty?.write(data);
      this.updateActivity();
    });

    this.status = "active";
  }

  async ready(): Promise<void> {
    await this.initPromise;
  }

  /**
   * Write data to PTY (raw input)
   * @param data - Raw input data (supports text, multiline, ANSI codes)
   * @param waitMs - Wait time for output in milliseconds (default: 1000)
   */
  async write(
    data: string,
    waitMs = 1000,
  ): Promise<{
    screen: string;
    cursor: { x: number; y: number };
    exitCode: number | null;
  }> {
    if (this.status === "terminated" || this.status === "terminating") {
      throw new Error(`PTY ${this.id} is not active`);
    }

    // Security check
    checkSudoPermission(data);

    this.pty?.write(data);
    this.updateActivity();

    // Wait for output
    await Bun.sleep(waitMs);

    return {
      screen: this.getScreenContent(),
      cursor: this.getCursorPosition(),
      exitCode: this.exitCode,
    };
  }

  /**
   * Extract current screen content from terminal buffer
   */
  private getScreenContent(): string {
    const buffer = this.terminal.buffer.active;
    const lines: string[] = [];

    for (let i = 0; i < buffer.length; i++) {
      const line = buffer.getLine(i);
      if (line) {
        lines.push(line.translateToString(true));
      }
    }

    return lines.join("\n").trimEnd();
  }

  /**
   * Get current cursor position
   */
  private getCursorPosition(): { x: number; y: number } {
    return {
      x: this.terminal.buffer.active.cursorX,
      y: this.terminal.buffer.active.cursorY,
    };
  }

  /**
   * Capture current terminal buffer
   */
  captureBuffer(): string[] {
    const buffer = this.terminal.buffer.active;
    const lines: string[] = [];

    for (let i = 0; i < buffer.length; i++) {
      const line = buffer.getLine(i);
      if (line) {
        lines.push(line.translateToString());
      }
    }

    return lines;
  }

  /**
   * Get raw output buffer
   */
  getOutputBuffer(): string {
    return this.outputBuffer;
  }

  /**
   * Get exit code
   */
  getExitCode(): number | null {
    return this.exitCode;
  }

  /**
   * Check if running
   */
  isRunning(): boolean {
    return this.status !== "terminated" && this.status !== "terminating";
  }

  /**
   * Subscribe to process events
   */
  subscribe(params: {
    onData: (data: string) => void;
    onError: (error: Error) => void;
    onComplete: () => void;
  }): Subscription {
    const subscriber = {
      onData: params.onData,
      onError: params.onError,
      onComplete: params.onComplete,
    };
    this.subscribers.push(subscriber);

    return {
      unsubscribe: () => {
        const index = this.subscribers.indexOf(subscriber);
        if (index > -1) {
          this.subscribers.splice(index, 1);
        }
      },
    };
  }

  /**
   * Convert to Promise
   */
  async toPromise(): Promise<string> {
    await this.ready();
    return new Promise<string>((resolve, reject) => {
      const _sub = this.subscribe({
        onData: () => {}, // data는 outputBuffer에 누적
        onError: (err) => {
          this.dispose();
          reject(err);
        },
        onComplete: () => {
          this.dispose();
          if (this.exitCode !== null && this.exitCode !== 0) {
            const error = new Error(
              `Process exited with code ${this.exitCode}`,
            ) as Error & { exitCode: number };
            error.exitCode = this.exitCode;
            reject(error);
          } else {
            resolve(this.outputBuffer);
          }
        },
      });
    });
  }

  /**
   * Register output callback
   */
  onOutput(callback: (output: TerminalOutput) => void): void {
    this.subscribe({
      onData: (data) => {
        const terminalOutput: TerminalOutput = {
          processId: this.id,
          output: data,
          ansiStripped: this.options.ansiStrip ?? false,
          timestamp: new Date(),
        };
        callback(terminalOutput);
      },
      onError: () => {},
      onComplete: () => {},
    });
  }

  /**
   * Update activity time
   */
  private updateActivity(): void {
    this.lastActivity = new Date();
    if (this.status === "idle") {
      this.status = "active";
    }
  }

  /**
   * Resize terminal
   */
  resize(cols: number, rows: number): void {
    if (!this.isRunning()) {
      throw new Error(`PTY ${this.id} is not active`);
    }

    this.terminal.resize(cols, rows);
    this.pty?.resize(cols, rows);
    this.updateActivity();
  }

  /**
   * Dispose resources
   */
  async dispose(signal = "SIGTERM"): Promise<void> {
    if (this.isDisposed) return;

    this.isDisposed = true;
    this.status = "terminating";
    this.subscribers = [];

    if (this.pty) {
      // Only kill if process is still running
      if (this.exitCode === null) {
        try {
          this.pty.kill(signal);

          // Wait for graceful exit or force kill after 3s
          await Promise.race([
            new Promise<void>((resolve) => {
              this.pty?.onExit(() => resolve());
            }),
            Bun.sleep(3000).then(() => {
              logger.warn(
                `PTY ${this.id} did not exit gracefully, sending SIGKILL`,
              );
              this.pty?.kill("SIGKILL");
            }),
          ]);
        } catch {
          // Ignore errors
        }
      }
      this.pty = null;
    }

    try {
      this.terminal.dispose();
    } catch {
      // Ignore errors during terminal disposal
    }

    this.status = "terminated";
    logger.info(`PTY ${this.id} disposed successfully`);
  }
}
