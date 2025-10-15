import { createLogger } from "@pkgs/logger";
import { Terminal } from "@xterm/headless";
import { spawn } from "bun-pty";
import { nanoid } from "nanoid";
import type { PtyOptions, PtyStatus, TerminalOutput } from "./types";
import { parseCommand } from "./utils/command";
import { checkExecutablePermission, checkSudoPermission } from "./utils/safety";

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
    const options = parseCommand(commandOrOptions);

    this.id = nanoid();
    this.createdAt = new Date();
    this.lastActivity = new Date();
    this.options = options;

    // Security check: Verify if executable is sudo
    checkExecutablePermission(options.executable);

    // Initialize xterm headless
    this.terminal = new Terminal({
      cols: 80,
      rows: 24,
      allowTransparency: false,
    });

    // Create bun-pty process
    let executable = options.executable;
    let args = options.args || [];

    if (options.shellMode) {
      // Execute via interactive shell for better PTY compatibility
      // bash -c doesn't flush stdout for builtin commands in PTY mode
      const shell = "/bin/bash";
      executable = shell;
      args = ["--norc", "--noprofile"];
      // Store command to send after shell starts
      (this as { _pendingCommand?: string })._pendingCommand = [
        options.executable,
        ...(options.args || []),
      ].join(" ");
    }

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

    const pendingCommand = (this as { _pendingCommand?: string })
      ._pendingCommand;

    // Process output -> terminal
    this.process.onData((data: string) => {
      this.terminal.write(data);

      if (pendingCommand) {
        // Send command on first data chunk (shell is ready)
        if (!this.outputBuffer) {
          setTimeout(() => {
            this.process.write(`${pendingCommand}; exit\n`);
          }, 50);
        }
      }

      // Add all output without filtering
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
   * Register output callback
   */
  public onOutput(callback: (output: TerminalOutput) => void): void {
    this.outputCallbacks.push(callback);
  }

  /**
   * Notify output
   */
  private notifyOutput(output: string): void {
    const terminalOutput: TerminalOutput = {
      processId: this.id,
      output,
      ansiStripped: false, // TODO: ANSI strip option
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
