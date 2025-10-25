import { createLogger } from "@pkgs/logger";
import { normalizeCommand } from "@pkgs/normalize-commands";
import { Terminal } from "@xterm/headless";
import type { IExitEvent, IPty } from "@zenyr/bun-pty";
import { spawn } from "@zenyr/bun-pty";
import { nanoid } from "nanoid";
import stripAnsi from "strip-ansi";
import type { PtyOptions, PtyStatus, TerminalOutput } from "./types";
import { checkExecutablePermission, checkSudoPermission } from "./utils/safety";

/**
 * Dangerous ANSI escape sequences (excluding safe color codes)
 */
const DANGEROUS_CONTROL_PATTERNS = [
  /\u001b\[[0-9;]*[Hf]/, // Cursor positioning (potentially dangerous)
  /\u001b\[[0-9;]*[JK]/, // Screen clearing (dangerous)
  /\u001b\[[0-9;]*[r]/, // Scrolling region (dangerous)
  /\u001b\].*\u0007/, // OSC sequences (dangerous)
  /\u001b\[.*[hl]/, // Mode setting (dangerous)
];

/**
 * Dangerous environment variables that can be exploited for attacks
 */
const DANGEROUS_ENV_VARS = [
  "LD_PRELOAD",
  "LD_LIBRARY_PATH",
  "DYLD_INSERT_LIBRARIES", // macOS
  "PYTHONPATH",
  "NODE_PATH",
  "GEM_PATH",
  "PERL5LIB",
  "RUBYLIB",
  "CLASSPATH", // Java
  "PATH", // Potentially dangerous if manipulated
];

/**
 * Sanitize environment variables by removing dangerous ones
 * @param env - Environment variables object
 * @returns Sanitized environment variables
 */
const sanitizeEnv = (env: NodeJS.ProcessEnv): NodeJS.ProcessEnv => {
  const cleaned = { ...env };
  for (const dangerous of DANGEROUS_ENV_VARS) {
    delete cleaned[dangerous];
  }
  return cleaned;
};

/**
 * Validate input data for dangerous control sequences
 * @param data - Input data to validate
 * @throws {Error} if dangerous control sequences detected
 */
const validateInputData = (data: string): void => {
  // Allow basic control characters used for terminal interaction
  const allowedControls = /[\u0003\u0004\u001a\r\n\t]/; // Ctrl+C, Ctrl+D, Ctrl+Z, CR, LF, Tab

  // Allow ANSI color codes (SGR sequences)
  const safeColorCodes = /\u001b\[[0-9;]*m/;

  // Skip validation for single allowed control chars
  if (allowedControls.test(data) && data.length === 1) {
    return;
  }

  // Skip validation for ANSI color codes
  if (safeColorCodes.test(data)) {
    return;
  }

  // Check for dangerous ANSI sequences
  for (const pattern of DANGEROUS_CONTROL_PATTERNS) {
    if (pattern.test(data)) {
      throw new Error(
        `Dangerous control sequence detected in input. Set MCP_PTY_USER_CONSENT_FOR_DANGEROUS_ACTIONS to bypass.`,
      );
    }
  }
};

const logger = createLogger("pty-process");

/**
 * Maximum output buffer size: 64KB
 * Prevents unbounded memory growth for LLM context windows
 */
const MAX_OUTPUT_BUFFER_SIZE = 64 * 1024; // 64KB

interface Subscription {
  unsubscribe: () => void;
}

const normalizePtyOptions = (
  commandOrOptions: string | PtyOptions,
): PtyOptions => {
  return typeof commandOrOptions === "string"
    ? { command: commandOrOptions, cwd: process.cwd() }
    : commandOrOptions;
};

/**
 * Individual PTY process management class (bun-pty + xterm/headless)
 *
 * Complete rewrite based on spawn.ts:
 * - IPty + xterm/headless integration
 * - Event management with subscribe pattern
 * - Promise conversion (toPromise)
 * - Terminal buffer capture (captureBuffer)
 * - Resize support (resize)
 * - Safe dispose handling
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
  private execTimeoutId?: ReturnType<typeof setTimeout>;

  constructor(commandOrOptions: string | PtyOptions) {
    this.id = nanoid();
    this.createdAt = new Date();
    this.lastActivity = new Date();
    this.options = normalizePtyOptions(commandOrOptions);

    // Security check
    checkSudoPermission(this.options.command);

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
    const parsed = JSON.parse(normalizeCommand(this.options.command));
    const command = parsed.command;
    const args = parsed.args;

    // Security check for executable
    checkExecutablePermission(command);

    const sanitizedEnv = sanitizeEnv({ ...process.env, ...this.options.env });
    this.pty = spawn(command, args, {
      name: "xterm-256color",
      cols: this.terminal.cols,
      rows: this.terminal.rows,
      cwd: this.options.cwd || process.cwd(),
      env: sanitizedEnv as Record<string, string>,
    });

    // PTY output -> xterm and subscribers
    this.pty.onData((data: string) => {
      this.outputBuffer += data;

      // Maintain buffer size limit (FIFO - remove oldest when exceeding limit)
      if (this.outputBuffer.length > MAX_OUTPUT_BUFFER_SIZE) {
        const overflow = this.outputBuffer.length - MAX_OUTPUT_BUFFER_SIZE;
        this.outputBuffer = this.outputBuffer.slice(overflow);
      }

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

    // Set execution timeout if specified
    if (this.options.execTimeout) {
      this.execTimeoutId = setTimeout(() => {
        logger.warn(
          `PTY ${this.id} execution timeout (${this.options.execTimeout}ms), disposing`,
        );
        void this.dispose();
      }, this.options.execTimeout);
    }
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
    warning?: string;
  }> {
    if (this.status === "terminated" || this.status === "terminating") {
      throw new Error(`PTY ${this.id} is not active`);
    }

    // Handle empty input gracefully with warning
    if (data.length === 0) {
      logger.warn(`PTY ${this.id}: Empty input received, ignoring`);
      await Bun.sleep(waitMs);
      return {
        screen: this.getScreenContent(),
        cursor: this.getCursorPosition(),
        exitCode: this.exitCode,
        warning: "Empty input ignored - use '\\n' for Enter key",
      };
    }

    // Security checks
    checkSudoPermission(data);
    validateInputData(data);

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
      this.subscribe({
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

    // Reset execution timeout on activity
    if (this.execTimeoutId && this.options.execTimeout) {
      clearTimeout(this.execTimeoutId);
      this.execTimeoutId = setTimeout(() => {
        logger.warn(
          `PTY ${this.id} execution timeout (${this.options.execTimeout}ms), disposing`,
        );
        void this.dispose();
      }, this.options.execTimeout);
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

    // Clear execution timeout
    if (this.execTimeoutId) {
      clearTimeout(this.execTimeoutId);
      this.execTimeoutId = undefined;
    }

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
