import { createLogger } from "@pkgs/logger";
import { Terminal } from "@xterm/headless";
import { spawn } from "bun-pty";
import { nanoid } from "nanoid";
import stripAnsi from "strip-ansi";
import type { PtyOptions, PtyStatus, TerminalOutput } from "./types";
import { checkSudoPermission } from "./utils/safety";

const logger = createLogger("pty-process");

/**
 * Individual PTY process management class
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
        ? { command: commandOrOptions }
        : commandOrOptions;

    this.id = nanoid();
    this.createdAt = new Date();
    this.lastActivity = new Date();
    this.options = options;

    // Security check: Verify if command contains sudo
    checkSudoPermission(options.command);

    // Initialize xterm headless
    this.terminal = new Terminal({
      cols: 80,
      rows: 24,
      allowTransparency: false,
      allowProposedApi: true,
    });

    // Always execute through shell for security and predictability
    const shell = Bun.env.SHELL || "/bin/sh";
    const executable = shell;
    const args = ["-c", options.command];

    this.process = spawn(executable, args, {
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
   * Setup streams
   */
  private setupStreams(): void {
    // Terminal input -> process
    this.terminal.onData((data) => {
      this.process.write(data);
      this.updateActivity();
    });

    // Process output -> terminal
    this.process.onData((data: string) => {
      this.terminal.write(data);
      this.outputBuffer += data;
      this.notifyOutput(data);
      this.updateActivity();
    });

    // Process exit handling: Trigger dispose based on autoDisposeOnExit option
    this.process.onExit(({ exitCode, signal }) => {
      this.status = "terminated";
      logger.info(
        `PTY ${this.id} exited with code ${exitCode}, signal ${signal}`,
      );

      if (this.options.autoDisposeOnExit) {
        this.dispose("SIGTERM").catch(logger.error); // Automatic cleanup
      }
    });
  }

  /**
   * Write interactive input or command (pass directly to program without shell prompt)
   * @param input - Key input or command string (e.g., 'i' in vi mode or full command)
   */
  public writeInput(input: string): void {
    if (this.status !== "active") {
      throw new Error(`PTY ${this.id} is not active`);
    }

    // Check sudo-related input (security)
    checkSudoPermission(input); // Reuse existing function (when input contains "sudo")

    this.terminal.write(`${input}\n`); // Simulate enter with \n (suitable for interactive)
    this.updateActivity();
  }

  /**
   * Write data to PTY and return terminal state after waiting
   * @param data - Raw input data (supports text, multiline, ANSI codes like \x03 for Ctrl+C)
   * @param waitMs - Wait time for output in milliseconds (default: 1000)
   * @returns Terminal screen content, cursor position, and exit code
   */
  public async write(
    data: string,
    waitMs = 1000,
  ): Promise<{
    screen: string;
    cursor: { x: number; y: number };
    exitCode: number | null;
  }> {
    if (this.status !== "active") {
      throw new Error(`PTY ${this.id} is not active`);
    }

    // Security check
    checkSudoPermission(data);

    // Write to terminal (terminal.onData will forward to process)
    this.terminal.write(data);
    this.updateActivity();

    // Wait for output or early return on exit
    let exitCode: number | null = null;
    await Promise.race([
      Bun.sleep(waitMs),
      new Promise<void>((resolve) => {
        this.process.onExit((event) => {
          exitCode = event.exitCode;
          resolve();
        });
      }),
    ]);

    return {
      screen: this.getScreenContent(),
      cursor: this.getCursorPosition(),
      exitCode: exitCode ?? (this.status === "terminated" ? 0 : null),
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
   * Register output callback
   */
  public onOutput(callback: (output: TerminalOutput) => void): void {
    this.outputCallbacks.push(callback);
  }

  /**
   * Notify output
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
   * Get output buffer
   */
  public getOutputBuffer(): string {
    return this.outputBuffer;
  }

  /**
   * Dispose resources (includes graceful shutdown)
   * @param signal - Termination signal (default: SIGTERM). Switches to SIGKILL after 3 seconds if no response.
   */
  public async dispose(signal: string = "SIGTERM"): Promise<void> {
    if (this.status === "terminated") return;

    this.status = "terminating";

    // Graceful shutdown: Timeout 3 seconds after SIGTERM
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

    // Additional cleanup
    this.terminal.dispose();
    this.outputBuffer = "";
    this.outputCallbacks = [];
    this.status = "terminated";

    logger.info(`PTY ${this.id} disposed successfully`);
  }
}
