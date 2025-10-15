import { spawn as ptySpawn } from "bun-pty";
import { EventEmitter } from "node:events";

interface OutputEvent {
  source: "stdout" | "stderr";
  text: string;
}

interface SpawnOptions {
  stdin?: AsyncIterable<string> | Iterable<string>;
  split?: boolean;
  encoding?: string;
  detached?: boolean;
  echoOutput?: boolean;
  cwd?: string;
  env?: Record<string, string>;
  usePty?: boolean; // New option to enable PTY mode
  cols?: number; // Terminal columns for PTY
  rows?: number; // Terminal rows for PTY
  onSpawn?: (subprocess: PtySubprocess | BunSubprocess) => void;
}

type SpawnListener<T> = (data: T) => void;
type ErrorListener = (error: Error) => void;
type CompleteListener = () => void;

interface SpawnSubscription {
  unsubscribe(): void;
}

/**
 * PTY subprocess type from bun-pty
 */
type PtySubprocess = ReturnType<typeof ptySpawn>;

/**
 * Bun subprocess type definition
 * This matches Bun.spawn() return type
 */
type BunSubprocess = ReturnType<typeof Bun.spawn>;

/**
 * Error with exit code information
 */
interface SpawnError extends Error {
  exitCode: number;
  code: number;
}

/**
 * Type guard for OutputEvent
 */
function isOutputEvent(data: unknown): data is OutputEvent {
  return (
    typeof data === "object" &&
    data !== null &&
    "source" in data &&
    "text" in data &&
    (data.source === "stdout" || data.source === "stderr") &&
    typeof data.text === "string"
  );
}

/**
 * Type guard for SpawnError
 */
function isSpawnError(error: unknown): error is SpawnError {
  return (
    error instanceof Error &&
    "exitCode" in error &&
    typeof (error as SpawnError).exitCode === "number"
  );
}

/**
 * Create a SpawnError from exit code
 */
function createSpawnError(message: string, exitCode: number): SpawnError {
  const error = new Error(message) as SpawnError;
  error.exitCode = exitCode;
  error.code = exitCode;
  return error;
}

/**
 * Improved Spawn class with bun-pty support
 * Features:
 * - PTY support for interactive terminal programs
 * - No external dependencies (RxJS-free)
 * - AsyncSubject-like behavior for complete output capture
 * - Automatic process cleanup on unsubscribe
 * - Safe text transformation with fallback
 * - Split/non-split output modes
 * - Background execution support
 * - Dynamic stdin writing
 * - Process detachment
 */
export class Spawn<T = OutputEvent | string> {
  private emitter = new EventEmitter();
  private subprocess: PtySubprocess | BunSubprocess | null = null;
  private killed = false;
  private stdoutClosed = false;
  private stderrClosed = false;
  private exitCode: number | null = null;
  private cleanupCallbacks: Array<() => void> = [];
  private isPty = false;

  constructor(
    private command: string,
    private args: string[] = [],
    private options: SpawnOptions = {},
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
   * Convert to Promise (like oFA function)
   * Captures all output as a single string
   */
  toPromise(): Promise<string> {
    return new Promise((resolve, reject) => {
      let output = "";

      this.subscribe(
        (data: T) => {
          if (typeof data === "string") {
            output += data;
          } else if (isOutputEvent(data)) {
            output += data.text;
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
   * Convert to Promise with split output (stdout/stderr separated)
   */
  toSplitPromise(): Promise<{ stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
      let stdout = "";
      let stderr = "";

      this.subscribe(
        (data: T) => {
          if (isOutputEvent(data)) {
            if (data.source === "stdout") {
              stdout += data.text;
            } else if (data.source === "stderr") {
              stderr += data.text;
            }
          }
        },
        (error) => {
          const errorMessage = `${stdout}${stderr ? `\n${stderr}` : ""}\n${error.message}`;
          if (isSpawnError(error)) {
            const err = createSpawnError(errorMessage, error.exitCode);
            reject(err);
          } else {
            reject(new Error(errorMessage));
          }
        },
        () => resolve({ stdout, stderr }),
      );
    });
  }

  /**
   * Start the spawn process (with PTY or standard subprocess)
   */
  private async startProcess(): Promise<void> {
    const {
      encoding = "utf8",
      echoOutput = false,
      split = false,
      usePty = false,
      cols = 80,
      rows = 24,
    } = this.options;

    try {
      if (usePty) {
        // Use bun-pty for PTY mode
        this.isPty = true;
        await this.startPtyProcess(encoding, echoOutput, split, cols, rows);
      } else {
        // Use standard Bun.spawn
        this.isPty = false;
        await this.startStandardProcess(encoding, echoOutput, split);
      }
    } catch (error) {
      this.emitter.emit("error", error);
    }
  }

  /**
   * Start PTY process using bun-pty
   */
  private async startPtyProcess(
    encoding: string,
    echoOutput: boolean,
    split: boolean,
    cols: number,
    rows: number,
  ): Promise<void> {
    // bun-pty spawn signature: spawn(command, args, options)
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

      // Emit data based on split mode
      if (split) {
        // PTY doesn't distinguish stdout/stderr, so always mark as stdout
        this.emitter.emit("data", { source: "stdout", text: data });
      } else {
        this.emitter.emit("data", data);
      }

      this.stdoutClosed = false; // Keep alive while receiving data
    });

    // Handle PTY exit
    ptyProcess.onExit(({ exitCode, signal }) => {
      this.exitCode = exitCode;
      this.stdoutClosed = true;
      this.stderrClosed = true; // PTY doesn't have separate stderr
      this.checkCompletion();
    });

    // Handle stdin if provided
    if (this.options.stdin) {
      this.writePtyStdin(ptyProcess).catch((error) => {
        this.emitter.emit("error", error);
      });
    }
  }

  /**
   * Start standard process using Bun.spawn
   */
  private async startStandardProcess(
    encoding: string,
    echoOutput: boolean,
    split: boolean,
  ): Promise<void> {
    // Spawn process using Bun
    // Note: Bun.spawn doesn't support detached option directly
    const subprocess = Bun.spawn([this.command, ...this.args], {
      stdio: ["pipe", "pipe", "pipe"],
      cwd: this.options.cwd,
      env: this.options.env,
    });
    this.subprocess = subprocess;

    // Notify spawn callback
    if (this.options.onSpawn) {
      this.options.onSpawn(this.subprocess);
    }

    // Process chunk safely (like H function in Z31)
    const processChunk = (
      source: "stdout" | "stderr",
      chunk: Uint8Array,
    ): void => {
      if (chunk.length < 1) return;

      // Echo output if requested
      if (echoOutput) {
        const target = source === "stdout" ? process.stdout : process.stderr;
        target.write(chunk);
      }

      // Safe text transformation with fallback
      let text: string;
      try {
        text = new TextDecoder(encoding).decode(chunk);
      } catch (_error) {
        text = `<< Lost chunk of process output for ${this.command} - length was ${chunk.length} >>`;
      }

      // Emit data based on split mode
      if (split) {
        this.emitter.emit("data", { source, text });
      } else {
        this.emitter.emit("data", text);
      }
    };

    // Handle stdout (check if it's a stream)
    if (
      typeof this.subprocess.stdout !== "number" &&
      this.subprocess.stdout instanceof ReadableStream
    ) {
      this.readStream(this.subprocess.stdout, "stdout", processChunk).finally(
        () => {
          this.stdoutClosed = true;
          this.checkCompletion();
        },
      );
    } else {
      this.stdoutClosed = true;
    }

    // Handle stderr (check if it's a stream)
    if (
      typeof this.subprocess.stderr !== "number" &&
      this.subprocess.stderr instanceof ReadableStream
    ) {
      this.readStream(this.subprocess.stderr, "stderr", processChunk).finally(
        () => {
          this.stderrClosed = true;
          this.checkCompletion();
        },
      );
    } else {
      this.stderrClosed = true;
    }

    // Handle stdin if provided
    if (this.options.stdin && this.subprocess.stdin) {
      this.writeStdin().catch((error) => {
        this.emitter.emit("error", error);
      });
    }

    // Handle process exit
    this.subprocess.exited
      .then((code: number) => {
        this.exitCode = code;
        this.checkCompletion();
      })
      .catch((error: Error) => {
        this.killed = true;
        this.emitter.emit("error", error);
      });
  }

  /**
   * Read from a stream asynchronously
   */
  private async readStream(
    stream: ReadableStream<Uint8Array>,
    source: "stdout" | "stderr",
    processChunk: (source: "stdout" | "stderr", chunk: Uint8Array) => void,
  ): Promise<void> {
    try {
      const reader = stream.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        processChunk(source, value);
      }
    } catch (error) {
      if (!this.killed) {
        this.emitter.emit("error", error);
      }
    }
  }

  /**
   * Write to stdin from provided iterable (standard process)
   */
  private async writeStdin(): Promise<void> {
    if (!this.options.stdin) return;

    const subprocess = this.subprocess as BunSubprocess;
    if (!subprocess?.stdin) return;

    // Check if stdin is a FileSink (writable)
    if (typeof subprocess.stdin === "number") return;

    try {
      const stdin = subprocess.stdin;
      const encoder = new TextEncoder();

      for await (const data of this.options.stdin) {
        stdin.write(encoder.encode(data));
      }

      stdin.flush();
      stdin.end();
    } catch (_error) {
      if (!this.killed) {
        throw _error;
      }
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
    } catch (_error) {
      if (!this.killed) {
        throw _error;
      }
    }
  }

  /**
   * Check if process is complete (like AsyncSubject merge/reduce pattern)
   * Only completes after stdout, stderr are closed AND process has exited
   */
  private checkCompletion(): void {
    // Wait for all streams to close and process to exit
    if (!this.stdoutClosed || !this.stderrClosed || this.exitCode === null) {
      return;
    }

    // Already emitted error or complete
    if (this.killed) {
      return;
    }

    this.killed = true;

    // Check exit code
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
        if (this.isPty) {
          (this.subprocess as PtySubprocess).kill("SIGTERM");
        } else {
          (this.subprocess as BunSubprocess).kill();
        }
      } catch (_error) {
        // Process might already be dead
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
   * Works with both PTY and standard processes
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
      if (this.isPty) {
        // PTY process
        const ptyProcess = this.subprocess as PtySubprocess;
        ptyProcess.write(data);
      } else {
        // Standard process
        const subprocess = this.subprocess as BunSubprocess;
        if (!subprocess.stdin) {
          throw new Error("stdin is not available for this process");
        }

        // Check if stdin is a FileSink (writable)
        if (typeof subprocess.stdin === "number") {
          throw new Error("stdin is not writable (file descriptor)");
        }

        const encoder = new TextEncoder();
        const encoded = encoder.encode(data);

        subprocess.stdin.write(encoded);
        subprocess.stdin.flush();
      }
    } catch (error) {
      throw new Error(
        `Failed to write to stdin: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Detach from the process while keeping it running
   * This removes all listeners and allows the process to continue in background
   * @returns The subprocess object for manual management if needed
   */
  detach(): PtySubprocess | BunSubprocess | null {
    if (!this.subprocess) {
      throw new Error("Process not started yet");
    }

    // Remove all event listeners
    this.emitter.removeAllListeners();

    // Mark as detached by setting a flag
    // But don't kill the process
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
   * Useful for advanced operations
   */
  getSubprocess(): PtySubprocess | BunSubprocess | null {
    return this.subprocess;
  }

  /**
   * Check if process is using PTY mode
   */
  isPtyMode(): boolean {
    return this.isPty;
  }

  /**
   * Resize PTY terminal (only works in PTY mode)
   * @param cols - Number of columns
   * @param rows - Number of rows
   */
  resize(cols: number, rows: number): void {
    if (!this.isPty) {
      throw new Error("resize() only works in PTY mode");
    }

    if (!this.subprocess) {
      throw new Error("Process not started yet");
    }

    const ptyProcess = this.subprocess as PtySubprocess;
    ptyProcess.resize(cols, rows);
  }

  /**
   * Static factory method (like Z31 function)
   */
  static spawn(
    command: string,
    args: string[] = [],
    options: SpawnOptions = {},
  ): Spawn<string> {
    return new Spawn<string>(command, args, options);
  }

  /**
   * Static factory method with PTY enabled
   */
  static spawnPty(
    command: string,
    args: string[] = [],
    options: Omit<SpawnOptions, "usePty"> = {},
  ): Spawn<string> {
    return new Spawn<string>(command, args, { ...options, usePty: true });
  }

  /**
   * Static factory method with split output
   */
  static spawnSplit(
    command: string,
    args: string[] = [],
    options: Omit<SpawnOptions, "split"> = {},
  ): Spawn<OutputEvent> {
    return new Spawn<OutputEvent>(command, args, { ...options, split: true });
  }

  /**
   * Static factory for detached processes
   */
  static spawnDetached(
    command: string,
    args: string[] = [],
    options: SpawnOptions = {},
  ): Spawn<string> {
    return new Spawn<string>(command, args, { ...options, detached: true });
  }

  /**
   * Convenience method: spawn and convert to promise
   */
  static async spawnPromise(
    command: string,
    args: string[] = [],
    options: SpawnOptions = {},
  ): Promise<string> {
    const spawn = Spawn.spawn(command, args, options);
    return spawn.toPromise();
  }

  /**
   * Convenience method: spawn with PTY and convert to promise
   */
  static async spawnPtyPromise(
    command: string,
    args: string[] = [],
    options: Omit<SpawnOptions, "usePty"> = {},
  ): Promise<string> {
    const spawn = Spawn.spawnPty(command, args, options);
    return spawn.toPromise();
  }

  /**
   * Convenience method: spawn detached and convert to promise
   */
  static async spawnDetachedPromise(
    command: string,
    args: string[] = [],
    options: SpawnOptions = {},
  ): Promise<string> {
    const spawn = Spawn.spawnDetached(command, args, options);
    return spawn.toPromise();
  }
}
