import { EventEmitter } from "node:events";
import { Terminal } from "@xterm/headless";
import { spawn as ptySpawn } from "bun-pty";

interface Spawn2Options {
  stdin?: AsyncIterable<string> | Iterable<string>;
  encoding?: string;
  echoOutput?: boolean;
  cwd?: string;
  env?: Record<string, string>;
  cols?: number;
  rows?: number;
  onSpawn?: (subprocess: PtySubprocess) => void;
  /** Enable TUI processing with xterm/headless */
  enableTui?: boolean;
  /** Send EOF (Ctrl+D) after stdin is consumed (default: false) */
  sendEof?: boolean;
}

type SpawnListener<T> = (data: T) => void;
type ErrorListener = (error: Error) => void;
type CompleteListener = () => void;

interface SpawnSubscription {
  unsubscribe(): void;
}

/** PTY subprocess type from bun-pty */
type PtySubprocess = ReturnType<typeof ptySpawn>;

/** Error with exit code information */
interface SpawnError extends Error {
  exitCode: number;
  code: number;
}

/** Type guard for SpawnError */
const isSpawnError = (error: unknown): error is SpawnError => {
  return (
    error instanceof Error &&
    "exitCode" in error &&
    typeof (error as SpawnError).exitCode === "number"
  );
};

/** Create a SpawnError from exit code */
const createSpawnError = (message: string, exitCode: number): SpawnError => {
  const error = new Error(message) as SpawnError;
  error.exitCode = exitCode;
  error.code = exitCode;
  return error;
};

/**
 * Spawn2: PTY-based process spawner with xterm/headless TUI processing
 *
 * Features:
 * - bun-pty based PTY support for all processes
 * - xterm/headless integration for TUI processing
 * - Terminal buffer access for advanced rendering
 * - No external dependencies beyond bun-pty and @xterm/headless
 * - RxJS-free Observable pattern
 * - Automatic process cleanup
 * - Dynamic stdin writing
 *
 * Example:
 * ```ts
 * // Basic PTY spawn
 * const spawn = Spawn2.spawn("echo", ["Hello"]);
 * const output = await spawn.toPromise();
 *
 * // TUI-enabled spawn (vi, man, etc.)
 * const tuiSpawn = Spawn2.spawn("vi", ["file.txt"], { enableTui: true });
 * await tuiSpawn.write("iHello\x1b:wq\n");
 * ```
 */
export class Spawn2<T = string> {
  private emitter = new EventEmitter();
  private subprocess: PtySubprocess | null = null;
  private xterm: Terminal | null = null;
  private killed = false;
  private exitCode: number | null = null;
  private cleanupCallbacks: Array<() => void> = [];

  constructor(
    private command: string,
    private args: string[] = [],
    private options: Spawn2Options = {},
  ) {}

  /**
   * Start the spawn process and return a subscription
   */
  subscribe(
    onData: SpawnListener<T>,
    onError?: ErrorListener,
    onComplete?: CompleteListener,
  ): SpawnSubscription {
    if (onData) this.emitter.on("data", onData);
    if (onError) this.emitter.on("error", onError);
    if (onComplete) this.emitter.on("complete", onComplete);

    // Start the process on first subscription
    if (!this.subprocess) {
      this.startProcess();
    }

    return {
      unsubscribe: () => {
        if (onData) this.emitter.off("data", onData);
        if (onError) this.emitter.off("error", onError);
        if (onComplete) this.emitter.off("complete", onComplete);

        // Kill process if no more listeners
        if (this.emitter.listenerCount("data") === 0) {
          this.cleanup();
        }
      },
    };
  }

  /**
   * Convert to Promise
   * Captures all output as a single string
   */
  toPromise(): Promise<string> {
    return new Promise((resolve, reject) => {
      let output = "";

      this.subscribe(
        (data: T) => {
          if (typeof data === "string") {
            output += data;
          }
        },
        (error) => {
          if (isSpawnError(error)) {
            const err = createSpawnError(
              `${output}\n${error.message}`,
              error.exitCode,
            );
            reject(err);
          } else {
            const err = new Error(`${output}\n${error.message}`);
            reject(err);
          }
        },
        () => resolve(output),
      );
    });
  }

  /**
   * Start PTY process with optional xterm/headless TUI processing
   */
  private async startProcess(): Promise<void> {
    const {
      echoOutput = false,
      cols = 80,
      rows = 24,
      enableTui = false,
    } = this.options;

    try {
      // Initialize xterm/headless if TUI processing enabled
      if (enableTui) {
        this.xterm = new Terminal({ cols, rows, allowProposedApi: true });
      }

      // Spawn PTY process
      const ptyProcess = ptySpawn(this.command, this.args, {
        name: "xterm-256color",
        cols,
        rows,
        cwd: this.options.cwd || process.cwd(),
        env: { ...process.env, ...this.options.env } as Record<string, string>,
      });

      this.subprocess = ptyProcess;

      // Notify spawn callback
      if (this.options.onSpawn) {
        this.options.onSpawn(ptyProcess);
      }

      // Handle PTY output
      ptyProcess.onData((data: string) => {
        if (echoOutput) {
          process.stdout.write(data);
        }

        // Process through xterm if TUI enabled
        if (this.xterm) {
          this.xterm.write(data);
          // Emit processed data (can be enhanced to emit buffer snapshots)
          this.emitter.emit("data", data);
        } else {
          // Direct emit for non-TUI mode
          this.emitter.emit("data", data);
        }
      });

      // Handle PTY exit
      ptyProcess.onExit(({ exitCode }) => {
        this.exitCode = exitCode;
        this.checkCompletion();
      });

      // Handle stdin if provided
      if (this.options.stdin) {
        this.writePtyStdin(ptyProcess).catch((error) => {
          this.emitter.emit("error", error);
        });
      }
    } catch (error) {
      this.emitter.emit("error", error);
    }
  }

  /**
   * Write to stdin for PTY process
   */
  private async writePtyStdin(ptyProcess: PtySubprocess): Promise<void> {
    if (!this.options.stdin) return;

    try {
      for await (const data of this.options.stdin) {
        ptyProcess.write(data);
      }
      // Send EOF (Ctrl+D) only if explicitly requested
      if (this.options.sendEof) {
        ptyProcess.write("\x04");
      }
    } catch (_error) {
      if (!this.killed) {
        throw _error;
      }
    }
  }

  /**
   * Check if process is complete
   */
  private checkCompletion(): void {
    if (this.exitCode === null) {
      return;
    }

    if (this.killed) {
      return;
    }

    this.killed = true;

    // Exit code 0 or 143 (SIGTERM) are considered successful
    if (this.exitCode === 0 || this.exitCode === 143) {
      this.emitter.emit("complete");
    } else {
      const error = createSpawnError(
        `Failed with exit code: ${this.exitCode}`,
        this.exitCode,
      );
      this.emitter.emit("error", error);
    }
  }

  /**
   * Cleanup resources and kill process
   */
  private cleanup(): void {
    if (this.killed) return;

    this.killed = true;

    if (this.subprocess) {
      try {
        this.subprocess.kill("SIGTERM");
      } catch (_error) {
        // Process might already be dead
      }
    }

    // Dispose xterm if exists
    if (this.xterm) {
      try {
        this.xterm.dispose();
      } catch (_error) {
        // Ignore disposal errors
      }
    }

    // Run cleanup callbacks
    for (const callback of this.cleanupCallbacks) {
      try {
        callback();
      } catch (_error) {
        // Ignore cleanup errors
      }
    }
  }

  /**
   * Add cleanup callback
   */
  onCleanup(callback: () => void): void {
    this.cleanupCallbacks.push(callback);
  }

  /**
   * Write data to stdin of running process
   * @param data - String data to write to stdin
   * @returns Promise that resolves when data is written
   * @throws Error if process is not running or stdin is not available
   */
  async write(data: string): Promise<void> {
    if (!this.subprocess) {
      throw new Error("Process not started yet");
    }

    if (this.killed) {
      throw new Error("Process already terminated");
    }

    try {
      this.subprocess.write(data);
    } catch (error) {
      throw new Error(
        `Failed to write to stdin: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Detach from the process while keeping it running
   * @returns The subprocess object for manual management if needed
   */
  detach(): PtySubprocess | null {
    if (!this.subprocess) {
      throw new Error("Process not started yet");
    }

    // Remove all event listeners
    this.emitter.removeAllListeners();

    const subprocess = this.subprocess;

    // Clear internal references but keep process alive
    this.subprocess = null;

    return subprocess;
  }

  /**
   * Check if the process is still running
   */
  isRunning(): boolean {
    return this.subprocess !== null && !this.killed;
  }

  /**
   * Get the underlying subprocess object
   */
  getSubprocess(): PtySubprocess | null {
    return this.subprocess;
  }

  /**
   * Get xterm terminal instance (if TUI enabled)
   */
  getTerminal(): Terminal | null {
    return this.xterm;
  }

  /**
   * Resize PTY terminal
   * @param cols - Number of columns
   * @param rows - Number of rows
   */
  resize(cols: number, rows: number): void {
    if (!this.subprocess) {
      throw new Error("Process not started yet");
    }

    this.subprocess.resize(cols, rows);

    // Also resize xterm if exists
    if (this.xterm) {
      this.xterm.resize(cols, rows);
    }
  }

  /**
   * Capture current terminal buffer (TUI mode only)
   * @returns Array of lines from terminal buffer
   */
  captureBuffer(): string[] {
    if (!this.xterm) {
      throw new Error("captureBuffer() only works with enableTui: true");
    }

    const buffer = this.xterm.buffer.active;
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
   * Static factory method
   */
  static spawn(
    command: string,
    args: string[] = [],
    options: Spawn2Options = {},
  ): Spawn2<string> {
    return new Spawn2<string>(command, args, options);
  }

  /**
   * Convenience method: spawn and convert to promise
   */
  static async spawnPromise(
    command: string,
    args: string[] = [],
    options: Spawn2Options = {},
  ): Promise<string> {
    const spawn = Spawn2.spawn(command, args, options);
    return spawn.toPromise();
  }
}
