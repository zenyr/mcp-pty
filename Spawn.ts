#!/usr/bin/env bun

/**
 * Spawn.ts - Bun 전용 PTY 관리자 (bun-pty + xterm.js 기반)
 */

import { Terminal } from "@xterm/headless";
import { type IPty, spawn } from "bun-pty";

export interface SpawnOptions {
  cols?: number;
  rows?: number;
  enableTui?: boolean;
  stdin?: AsyncIterable<string>;
  sendEof?: boolean;
}

export interface SpawnResult {
  exitCode: number;
  signal?: string;
  output: string;
}

export class Spawn {
  private term: Terminal;
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

  constructor(
    private command: string,
    private args: string[] = [],
    private options: SpawnOptions = {},
  ) {
    this.term = new Terminal({
      cols: options.cols ?? 80,
      rows: options.rows ?? 24,
      convertEol: true,
      allowProposedApi: true,
    });

    this.initPromise = this.init();
  }

  private async init(): Promise<void> {
    this.pty = spawn(this.command, this.args, {
      name: "xterm-256color",
      cols: this.term.cols,
      rows: this.term.rows,
    });

    // PTY output -> xterm and subscribers
    this.pty.onData((data: string) => {
      this.outputBuffer += data;
      this.term.write(data);
      this.subscribers.forEach((sub) => void sub.onData(data));
    });

    // PTY exit
    this.pty.onExit(({ exitCode }) => {
      this.exitCode = exitCode;
      this.subscribers.forEach((sub) => void sub.onComplete());
    });

    // xterm -> PTY stdin
    this.term.onData((data: string) => {
      this.pty?.write(data);
    });

    // stdin 입력 처리 (non-blocking)
    if (this.options.stdin) {
      void this.consumeStdin(this.options.stdin);
    }
  }

  private async consumeStdin(generator: AsyncIterable<string>): Promise<void> {
    try {
      for await (const chunk of generator) {
        this.pty?.write(chunk);
      }
      if (this.options.sendEof) {
        this.pty?.write("\x04"); // EOF
      }
    } catch (err) {
      console.error("stdin consumer error:", err);
    }
  }

  async ready(): Promise<void> {
    await this.initPromise;
  }

  getExitCode(): number | null {
    return this.exitCode;
  }

  subscribe(
    onData: (data: string) => void,
    onError: (error: Error) => void,
    onComplete: () => void,
  ): { unsubscribe: () => void } {
    const subscriber = { onData, onError, onComplete };
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

  async write(data: string): Promise<void> {
    this.pty?.write(data);
  }

  async toPromise(): Promise<string> {
    await this.ready();
    return new Promise<string>((resolve, reject) => {
      const _sub = this.subscribe(
        () => {}, // data는 outputBuffer에 누적
        (err) => {
          this.dispose();
          reject(err);
        },
        () => {
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
      );
    });
  }

  captureBuffer(): string[] {
    const lines: string[] = [];
    for (let i = 0; i < this.term.buffer.active.length; i++) {
      const line = this.term.buffer.active.getLine(i);
      if (line) {
        lines.push(line.translateToString());
      }
    }
    return lines;
  }

  resize(cols: number, rows: number): void {
    this.term.resize(cols, rows);
    this.pty?.resize(cols, rows);
  }

  getTerminal(): Terminal {
    return this.term;
  }

  dispose(): void {
    if (this.isDisposed) {
      return;
    }

    this.isDisposed = true;
    this.subscribers = [];

    if (this.pty) {
      // Only kill if process is still running (exitCode is null)
      if (this.exitCode === null) {
        try {
          this.pty.kill("SIGTERM");
        } catch {
          // Ignore errors
        }
      }
      this.pty = null;
    }

    try {
      this.term.dispose();
    } catch {
      // Ignore errors during terminal disposal
    }
  }

  static async spawn(
    command: string,
    args: string[] = [],
    options: SpawnOptions = {},
  ): Promise<Spawn> {
    const instance = new Spawn(command, args, options);
    await instance.ready();
    return instance;
  }
}
