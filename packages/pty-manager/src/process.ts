import { EventEmitter } from "node:events";
import { createLogger } from "@pkgs/logger";
import { Terminal } from "@xterm/headless";
import { spawn } from "bun-pty";
import { nanoid } from "nanoid";
import stripAnsi from "strip-ansi";
import type { PtyOptions, PtyStatus, TerminalOutput } from "./types";
import { checkSudoPermission } from "./utils/safety";

const logger = createLogger("pty-process");

type DataListener = (data: string) => void;
type ErrorListener = (error: Error) => void;
type ExitListener = (exitCode: number) => void;

interface Subscription {
  unsubscribe: () => void;
}

/**
 * PTY 프로세스 에러 (exitCode 포함)
 */
interface PtyError extends Error {
  exitCode: number;
  code: number;
}

/**
 * Type guard for PtyError
 */
const isPtyError = (error: unknown): error is PtyError => {
  return (
    error instanceof Error &&
    "exitCode" in error &&
    typeof (error as PtyError).exitCode === "number"
  );
};

/**
 * Create PtyError
 */
const createPtyError = (message: string, exitCode: number): PtyError => {
  const error = new Error(message) as PtyError;
  error.exitCode = exitCode;
  error.code = exitCode;
  return error;
};

/**
 * Individual PTY process management class (bun-pty + xterm/headless)
 *
 * spawn2.ts 패턴 완전 적용:
 * - PS1/마커 클렌징 로직 제거 (롱러닝 프로세스 부적합)
 * - 순수 PTY 입출력 스트림 기반
 * - EventEmitter 기반 이벤트 관리
 * - Subscribe/Unsubscribe 메모리 누수 방지
 * - Promise 변환 (toPromise)
 * - Cleanup callbacks
 * - Detach 지원 (백그라운드 실행)
 * - Resize 지원
 * - 안전한 dispose 처리
 *
 * xterm/headless 사용:
 * - 터미널 버퍼 관리 및 커서 위치 추적
 * - 화면 상태 정확한 캡처
 * - TUI 프로그램 지원 (vi, man, htop 등)
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
  private emitter = new EventEmitter();
  private cleanupCallbacks: Array<() => void> = [];
  private exitCode: number | null = null;

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
      allowTransparency: false,
      allowProposedApi: true,
    });

    // Spawn interactive PTY shell for session management
    // Commands are written via .write() after shell initialization
    this.process = spawn("/bin/sh", [], {
      name: "xterm-256color",
      cols: 80,
      rows: 24,
      cwd: options.cwd || process.cwd(),
      env: { ...process.env, ...options.env } as Record<string, string>,
    });

    this.setupStreams();
    this.status = "active";

    // Initialize shell and execute command asynchronously
    this.initializeShell(options).catch((err) => {
      logger.error(`Failed to initialize shell: ${err}`);
      this.emitter.emit("error", err);
      this.status = "terminated";
    });
  }

  /**
   * Initialize shell and execute initial command
   */
  private async initializeShell(options: PtyOptions): Promise<void> {
    // Wait for shell prompt
    await Bun.sleep(100);

    // Execute command
    this.process.write(`${options.command}\n`);

    // Auto-exit if requested
    if (options.autoDisposeOnExit) {
      await Bun.sleep(50);
      this.process.write("exit\n");
    }
  }

  /**
   * Setup streams (spawn2.ts pattern)
   */
  private setupStreams(): void {
    // Terminal input -> process
    this.terminal.onData((data) => {
      this.process.write(data);
      this.updateActivity();
    });

    // Process output -> terminal + buffer
    this.process.onData((data: string) => {
      this.terminal.write(data); // Write to terminal for screen state
      this.outputBuffer += data;
      this.notifyOutput(data);
      this.emitter.emit("data", data);
      this.updateActivity();
    });

    // Process exit handling
    this.process.onExit(({ exitCode, signal }) => {
      this.exitCode = exitCode;
      this.status = "terminated";
      logger.info(
        `PTY ${this.id} exited with code ${exitCode}, signal ${signal}`,
      );

      this.emitter.emit("exit", exitCode);

      if (this.options.autoDisposeOnExit) {
        this.dispose("SIGTERM").catch(logger.error);
      }
    });
  }

  /**
   * Write data to PTY (raw input)
   * @param data - Raw input data (supports text, multiline, ANSI codes)
   * @param waitMs - Wait time for output in milliseconds (default: 1000)
   */
  public async write(
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

    // Write directly to process
    this.process.write(data);
    this.updateActivity();

    // Wait for output or early return on exit
    let capturedExitCode: number | null = null;
    await Promise.race([
      Bun.sleep(waitMs),
      new Promise<void>((resolve) => {
        const handler = (event: { exitCode: number }) => {
          capturedExitCode = event.exitCode;
          resolve();
        };
        this.process.onExit(handler);
      }),
    ]);

    return {
      screen: this.getScreenContent(),
      cursor: this.getCursorPosition(),
      exitCode: capturedExitCode ?? this.exitCode,
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
        lines.push(line.translateToString(true)); // trimRight=true
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
   * Capture current terminal buffer (TUI mode)
   * @returns Array of lines from terminal buffer
   */
  public captureBuffer(): string[] {
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
   * Register output callback
   */
  public onOutput(callback: (output: TerminalOutput) => void): void {
    this.outputCallbacks.push(callback);
  }

  /**
   * Notify output to callbacks
   */
  private notifyOutput(output: string): void {
    const ansiStripped = this.options.ansiStrip ?? false;
    const processedOutput = ansiStripped ? stripAnsi(output) : output;

    const terminalOutput: TerminalOutput = {
      processId: this.id,
      output: processedOutput,
      ansiStripped,
      timestamp: new Date(),
    };
    this.outputCallbacks.forEach((cb) => void cb(terminalOutput));
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
   * Get raw output buffer (all data received)
   */
  public getOutputBuffer(): string {
    return this.outputBuffer;
  }

  /**
   * Subscribe to process events (data, error, exit)
   * RxJS-like pattern for better event management
   */
  public subscribe(
    onData?: DataListener,
    onError?: ErrorListener,
    onExit?: ExitListener,
  ): Subscription {
    if (onData) this.emitter.on("data", onData);
    if (onError) this.emitter.on("error", onError);
    if (onExit) this.emitter.on("exit", onExit);

    return {
      unsubscribe: () => {
        if (onData) this.emitter.off("data", onData);
        if (onError) this.emitter.off("error", onError);
        if (onExit) this.emitter.off("exit", onExit);

        // Cleanup if no more listeners
        if (this.emitter.listenerCount("data") === 0) {
          this.dispose("SIGTERM").catch(logger.error);
        }
      },
    };
  }

  /**
   * Convert to Promise (captures all output as a single string)
   * Similar to Spawn2.toPromise()
   */
  public toPromise(): Promise<string> {
    return new Promise((resolve, reject) => {
      let output = "";

      this.subscribe(
        (data: string) => {
          output += data;
        },
        (error) => {
          if (isPtyError(error)) {
            const err = createPtyError(
              `${output}\n${error.message}`,
              error.exitCode,
            );
            reject(err);
          } else {
            reject(new Error(`${output}\n${error.message}`));
          }
        },
        (exitCode) => {
          if (exitCode === 0 || exitCode === 143) {
            resolve(output);
          } else {
            const error = createPtyError(
              `Process failed with exit code: ${exitCode}`,
              exitCode,
            );
            reject(error);
          }
        },
      );
    });
  }

  /**
   * Add cleanup callback (executed on dispose)
   */
  public onCleanup(callback: () => void): void {
    this.cleanupCallbacks.push(callback);
  }

  /**
   * Detach from the process while keeping it running
   * This removes all listeners and returns the process
   */
  public detach(): ReturnType<typeof spawn> {
    if (this.status === "terminated" || this.status === "terminating") {
      throw new Error(`PTY ${this.id} already terminated`);
    }

    // Remove all event listeners
    this.emitter.removeAllListeners();

    // Clear callbacks
    this.outputCallbacks = [];
    this.cleanupCallbacks = [];

    logger.info(`PTY ${this.id} detached`);

    return this.process;
  }

  /**
   * Check if the process is still running
   */
  public isRunning(): boolean {
    return this.status !== "terminated" && this.status !== "terminating";
  }

  /**
   * Get the exit code if process has exited
   */
  public getExitCode(): number | null {
    return this.exitCode;
  }

  /**
   * Resize terminal
   */
  public resize(cols: number, rows: number): void {
    if (!this.isRunning()) {
      throw new Error(`PTY ${this.id} is not active`);
    }

    this.terminal.resize(cols, rows);
    this.process.resize(cols, rows);
    this.updateActivity();
  }

  /**
   * Dispose resources (includes graceful shutdown)
   * @param signal - Termination signal (default: SIGTERM). Switches to SIGKILL after 3 seconds if no response.
   */
  public async dispose(signal = "SIGTERM"): Promise<void> {
    if (this.status === "terminated") return;

    this.status = "terminating";

    // Run cleanup callbacks
    for (const callback of this.cleanupCallbacks) {
      try {
        callback();
      } catch (err) {
        logger.error(`Cleanup callback error: ${err}`);
      }
    }

    // Graceful shutdown: Timeout 3 seconds after SIGTERM
    const timeout = 3000;
    const killPromise = new Promise<void>((resolve) => {
      const timer = setTimeout(() => {
        logger.warn(`PTY ${this.id} did not exit gracefully, sending SIGKILL`);
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

    // Additional cleanup
    this.terminal.dispose();
    this.outputBuffer = "";
    this.outputCallbacks = [];
    this.cleanupCallbacks = [];
    this.emitter.removeAllListeners();
    this.status = "terminated";

    logger.info(`PTY ${this.id} disposed successfully`);
  }
}
