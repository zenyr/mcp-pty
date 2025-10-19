# Spawn Class Interface (Based on Z31 Function)

## Overview
The Spawn class is an advanced process execution interface that spawns processes and handles input/output based on EventEmitter. It improves the original Z31 function by completely removing RxJS dependencies and enhancing type safety. It supports clean output capture and background execution, leveraging the Bun runtime.

## Class Signature
```typescript
class Spawn<T = OutputEvent | string> {
  // Static factory methods
  static spawn(command: string, args?: string[], options?: SpawnOptions): Spawn<string>
  static spawnPty(command: string, args?: string[], options?: Omit<SpawnOptions, "usePty">): Spawn<string>
  static spawnSplit(command: string, args?: string[], options?: Omit<SpawnOptions, "split">): Spawn<OutputEvent>
  static spawnDetached(command: string, args?: string[], options?: SpawnOptions): Spawn<string>
  static spawnPromise(command: string, args?: string[], options?: SpawnOptions): Promise<string>
  static spawnPtyPromise(command: string, args?: string[], options?: Omit<SpawnOptions, "usePty">): Promise<string>
  static spawnDetachedPromise(command: string, args?: string[], options?: SpawnOptions): Promise<string>

  // Instance methods
  subscribe(onData: SpawnListener<T>, onError?: ErrorListener, onComplete?: CompleteListener): SpawnSubscription
  toPromise(): Promise<string>
  toSplitPromise(): Promise<{ stdout: string; stderr: string }>
  onCleanup(callback: () => void): void
  write(data: string): Promise<void>
  detach(): PtySubprocess | BunSubprocess | null
  isRunning(): boolean
  getSubprocess(): PtySubprocess | BunSubprocess | null
  isPtyMode(): boolean
  resize(cols: number, rows: number): void
}
```

## Parameters

### command: string
Command to execute (e.g., "echo", "ls", "/bin/sh")

### args: string[]
Array of arguments to pass to the command

### options: SpawnOptions (optional)
```typescript
interface SpawnOptions {
  stdin?: AsyncIterable<string> | Iterable<string>  // 입력 스트림 (async generator 또는 iterable)
  split?: boolean                                    // 출력 분할 여부
  encoding?: string                                  // 텍스트 인코딩 (기본: "utf8")
  detached?: boolean                                 // detached 모드 (Bun.spawn에서 미지원, 무시됨)
  echoOutput?: boolean                               // stdout/stderr 실시간 콘솔 출력
  cwd?: string                                       // 작업 디렉토리
  env?: Record<string, string>                       // 환경 변수
  usePty?: boolean                                   // PTY 모드 활성화 (대화형 프로그램 지원)
  cols?: number                                      // 터미널 컬럼 수 (PTY 모드, 기본: 80)
  rows?: number                                      // 터미널 행 수 (PTY 모드, 기본: 24)
  onSpawn?: (subprocess: PtySubprocess | BunSubprocess) => void  // Process start callback
}
```

**Notes**:
- The `detached` option is not supported in Bun.spawn and is ignored
- Use the `detach()` method for background execution when needed

## Return Value

### Spawn<string> (default mode)
```typescript
// Receive data via subscribe
Spawn<string>.subscribe((data: string) => {
  // Combined stdout and stderr text stream
})
```

### Spawn<OutputEvent> (split mode)
```typescript
interface OutputEvent {
  source: "stdout" | "stderr"
  text: string
}

// Receive data via subscribe
Spawn<OutputEvent>.subscribe((data: OutputEvent) => {
  // Separated stdout/stderr object stream
})
```

## Key Features

1. **EventEmitter-based I/O**: Asynchronous stream processing using Node.js EventEmitter without RxJS
2. **Type Safety**: Complete TypeScript type definitions, complete removal of `any` types, runtime type guards
3. **Clean Output Capture**: Implementation of AsyncSubject pattern with EventEmitter for complete stdout/stderr capture
4. **Automatic Process Management**: Automatic termination on errors, process kill on subscription unsubscribe
5. **Background Execution Support**: Background process management with detached option and spawnDetached function
6. **Error Handling**: Error generation and propagation based on exit codes, normal handling of SIGTERM(143)
7. **Encoding Support**: UTF-8 default, custom encoding support, safe text transformation
8. **Bun Runtime**: Performance optimization using Bun.spawn() and bun-pty APIs
9. **PTY Support**: Complete PTY mode support via bun-pty (for interactive programs like vim, nano)
10. **Dynamic stdin Input**: Ability to send stdin data dynamically to running processes (write method)
11. **Process Detach**: Ability to detach running processes to background execution
12. **Process Status Queries**: Check process running status with isRunning(), isPtyMode() methods
13. **Low-level Access**: Direct access to Bun subprocess or PTY process objects via getSubprocess() method
14. **Terminal Resize**: Dynamic terminal size adjustment in PTY mode with resize() method
15. **Safe Stream Processing**: Type checking of stdin/stdout/stderr to prevent file descriptor errors

## Usage Examples

### 1. Basic Subscribe Pattern
```typescript
const spawn = Spawn.spawn("echo", ["Hello, World!"]);

const subscription = spawn.subscribe(
  (data) => {
    console.log(`Output: ${data}`);
  },
  (err) => {
    console.error(`Error: ${err.message}`);
  },
  () => {
    console.log("Process completed");
    subscription.unsubscribe();
  }
);
```

### 2. Promise Pattern (Simplest)
```typescript
const output = await Spawn.spawnPromise("ls", ["-la"]);
console.log(output);
```

### 3. Split Mode (stdout/stderr separation)
```typescript
const spawn = Spawn.spawnSplit("sh", ["-c", 'echo "stdout" && echo "stderr" >&2']);

spawn.subscribe((data) => {
  if (data.source === "stdout") {
    console.log(`[stdout] ${data.text}`);
  } else {
    console.log(`[stderr] ${data.text}`);
  }
});
```

### 4. Split Promise Pattern
```typescript
const spawn = Spawn.spawnSplit("sh", ["-c", 'echo "out" && echo "err" >&2']);
const { stdout, stderr } = await spawn.toSplitPromise();
console.log(`stdout: ${stdout}`);
console.log(`stderr: ${stderr}`);
```

### 5. stdin Input (Async Generator)
```typescript
async function* generateInput() {
  yield "Hello\n";
  yield "World\n";
}

const spawn = Spawn.spawn("cat", [], {
  stdin: generateInput(),
});

const output = await spawn.toPromise();
console.log(output); // "Hello\nWorld\n"
```

### 6. Error Handling (exit code !== 0)
```typescript
try {
  await Spawn.spawnPromise("cat", ["/nonexistent/file.txt"]);
} catch (err) {
  if (err instanceof Error && "exitCode" in err) {
    const exitCode = (err as SpawnError).exitCode;
    console.log(`Exit Code: ${exitCode}`);
    console.log(`Error: ${err.message}`);
  }
}
```

### 7. Echo Output (Real-time output)
```typescript
await Spawn.spawnPromise("sh", ["-c", 'for i in 1 2 3; do echo "Count: $i"; sleep 0.1; done'], {
  echoOutput: true,  // Output to console in real-time
});
```

### 8. Cleanup Callback
```typescript
const spawn = Spawn.spawn("long-running-command", []);

spawn.onCleanup(() => {
  console.log("Cleaning up process...");
});

const subscription = spawn.subscribe(
  (data) => console.log(data),
  (err) => console.error(err),
  () => console.log("Completed")
);

// Force termination if needed
setTimeout(() => {
  subscription.unsubscribe(); // cleanup callback executed
}, 5000);
```

### 9. Parallel Execution
```typescript
const commands = [
  { cmd: "echo", args: ["Process 1"] },
  { cmd: "echo", args: ["Process 2"] },
  { cmd: "echo", args: ["Process 3"] },
];

const results = await Promise.all(
  commands.map(({ cmd, args }) => Spawn.spawnPromise(cmd, args))
);

results.forEach((output, i) => {
  console.log(`[${i + 1}] ${output.trim()}`);
});
```

### 10. Detached Background Process
```typescript
// Or Promise pattern
const output = await Spawn.spawnDetachedPromise("background-task", []);
```

### 11. Dynamic stdin Input to Running Process
```typescript
// Start interactive process
const spawn = Spawn.spawn("python3", ["-i"]);

spawn.subscribe((data) => {
  console.log(data);
});

// Input commands dynamically after process starts
await spawn.write("print('Hello from stdin')\n");
await spawn.write("x = 10\n");
await spawn.write("print(x * 2)\n");

// write() method supports both PTY and Standard modes
// - Standard mode: Check if stdin is FileSink then write
// - PTY mode: Use PTY process's write method
```

### 12. Detach Running Process
```typescript
// Start process
const spawn = Spawn.spawn("long-running-server", []);

const subscription = spawn.subscribe((data) => {
  console.log(data);
});

// Detach after a while to continue running in background
setTimeout(() => {
  const subprocess = spawn.detach();
  console.log("Process detached but still running");

  // Can manage directly with subprocess object if needed
  if (subprocess) {
    console.log("PID:", subprocess.pid);
  }
}, 5000);
```

### 13. Process Status Check
```typescript
const spawn = Spawn.spawn("echo", ["test"]);

console.log("Running:", spawn.isRunning()); // true

spawn.subscribe(
  (data) => console.log(data),
  undefined,
  () => {
    console.log("Running:", spawn.isRunning()); // false
  }
);
```

### 14. Advanced: Direct Access to subprocess Object
```typescript
const spawn = Spawn.spawn("node", ["-v"]);

spawn.subscribe((data) => console.log(data));

const subprocess = spawn.getSubprocess();
if (subprocess) {
  console.log("Process ID:", subprocess.pid);
  console.log("Exit code (when done):", await subprocess.exited);
}
```

### 15. Run Interactive Programs in PTY Mode
```typescript
// Run vim editor (PTY required)
const spawn = Spawn.spawnPty("vim", ["test.txt"]);

spawn.subscribe((data) => {
  console.log("Screen output:", data);
});

// Input vim commands
await spawn.write("i");           // Enter insert mode
await spawn.write("Hello, World!\n");  // Input text
await spawn.write("\x1b");        // ESC key (exit mode)
await spawn.write(":wq\n");       // Save and quit
```

### 16. Python Interactive Session in PTY Mode
```typescript
const spawn = Spawn.spawnPty("python3", ["-i"]);

spawn.subscribe((data) => {
  console.log(data);
});

// Input Python commands dynamically
await spawn.write("x = 10\n");
await spawn.write("y = 20\n");
await spawn.write("print(x + y)\n");
await spawn.write("exit()\n");
```

### 17. PTY Terminal Resize
```typescript
const spawn = Spawn.spawnPty("top", []);

spawn.subscribe((data) => {
  console.log(data);
});

// Change terminal size
setTimeout(() => {
  spawn.resize(120, 40);
  console.log("Terminal resized to 120x40");
}, 2000);
```

### 18. PTY Mode Check
```typescript
const spawn1 = Spawn.spawn("echo", ["test"]);
console.log("Is PTY mode?", spawn1.isPtyMode()); // false

const spawn2 = Spawn.spawnPty("vim", ["test.txt"]);
console.log("Is PTY mode?", spawn2.isPtyMode()); // true
```

### 19. PTY Promise Pattern
```typescript
// Edit file with vim and capture result
const output = await Spawn.spawnPtyPromise("vim", ["test.txt"]);
console.log("Final output:", output);
```

## Deep Dive: Output Capture Mechanism

### EventEmitter-based AsyncSubject Pattern Implementation
- **stdout/stderr Separate Management**: Read each stream independently and track completion status
- **Completeness Guarantee**: Wait until `stdoutClosed`, `stderrClosed`, `exitCode` are all ready
- **Chunk Processing**: Text transformation and EventEmitter transmission for each chunk of ReadableStream
- **Safe Transformation**: Exception handling and fallback messages during Uint8Array → String conversion

### Text Transformation Process (processChunk function)
```typescript
const processChunk = (source: "stdout" | "stderr", chunk: Uint8Array): void => {
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
    text = `<< Lost chunk of process output for ${command} - length was ${chunk.length} >>`;
  }

  // Emit data based on split mode
  if (split) {
    emitter.emit("data", { source, text });
  } else {
    emitter.emit("data", text);
  }
};
```

### Completion Detection (checkCompletion method)
```typescript
private checkCompletion(): void {
  // Wait for all streams to close and process to exit
  if (!this.stdoutClosed || !this.stderrClosed || this.exitCode === null) {
    return;
  }

  // Check exit code
  if (this.exitCode === 0) {
    this.emitter.emit("complete");
  } else {
    const error = createSpawnError(`Failed with exit code: ${this.exitCode}`, this.exitCode);
    this.emitter.emit("error", error);
  }
}
```

### Split vs Non-Split Output
- **split: true**: `{source: "stdout"|"stderr", text: string}` object stream (type: `Spawn<OutputEvent>`)
- **split: false**: Pure text stream (default, type: `Spawn<string>`)

## Process Lifecycle Management

### Process Lifecycle
1. **Spawn**: Create process with `Bun.spawn()`
2. **Stream Setup**: Set up stdin/stdout/stderr ReadableStream/WritableStream
3. **Data Flow**: Read data in chunks from each stream and transmit via EventEmitter
4. **Completion**: Emit complete event after confirming stdout/stderr close + process exit
5. **Cleanup**: Kill process and execute cleanup callbacks on subscription unsubscribe

### Subscription Management
```typescript
interface SpawnSubscription {
  unsubscribe(): void
}

// Start subscription
const subscription = spawn.subscribe(onData, onError, onComplete);

// Unsubscribe (automatic process termination)
subscription.unsubscribe();
```

### Automatic Cleanup
- Automatically kill process when all subscribers unsubscribe
- Add custom cleanup logic via `onCleanup()` callback
- Execute all cleanup callbacks when process terminates

## Error Handling

### SpawnError Interface
```typescript
interface SpawnError extends Error {
  exitCode: number
  code: number
}
```

### Error Propagation
- Process error: Propagated via EventEmitter's "error" event
- Abnormal termination: SpawnError generated and propagated when exit code !== 0 && !== 143
- SIGTERM handling: exit code 143 (SIGTERM) considered normal termination (complete event)
- stdin write error: Error event on writeStdin() failure
- Stream read error: Error event on readStream() failure
- stdin type error: Explicit error when stdin is number (file descriptor) type

### Exit Code Handling Policy
- **0**: Normal termination (complete)
- **143**: Terminated by SIGTERM, considered normal termination (complete)
- **Others**: Considered abnormal termination (error)

### Type Guards
```typescript
// OutputEvent type guard
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

// SpawnError type guard
function isSpawnError(error: unknown): error is SpawnError {
  return (
    error instanceof Error &&
    "exitCode" in error &&
    typeof (error as SpawnError).exitCode === "number"
  );
}
```

## Implementation Notes

### Core Engine
- **Dual Runtime Support**: Support for both `Bun.spawn()` (regular processes) and `bun-pty` (PTY mode)
- **PTY Integration**: Complete virtual terminal support via bun-pty, for running interactive programs like vim/nano
- **No Dependencies**: Complete removal of external dependencies like RxJS, Lodash
- **Type Safety**: Removal of all `any` types, complete TypeScript type safety

### Output Safety
- Transform all chunks with TextDecoder, fallback messages on failure
- Complete stream capture (AsyncSubject pattern)
- Built-in loss prevention mechanisms
- stdout/stderr type checking: Distinguish `ReadableStream` vs `number` (file descriptor)

### Resource Management
- EventEmitter-based subscription management
- Memory leak prevention (automatic listener removal)
- Automatic process cleanup (kill on unsubscribe)
- Improved cleanup stability with SIGTERM(143) normal termination handling

### Stream Type Safety
- **stdin check**: Filter file descriptors with `typeof stdin === "number"` check
- **stdout/stderr check**: Safe stream reading with `instanceof ReadableStream` check
- **FileSink type**: Explicit error when stdin is number instead of FileSink

### Encoding Robustness
- UTF-8 default, custom encoding support
- Safe transformation with TextDecoder
- Stability guaranteed with fallback error handling

## Differences from Original Z31

### Removed Features
- **RxJS Observable**: Replaced with EventEmitter
- **Windows Jobber**: Process management handled by Bun runtime
- **stdio option**: Automatically handled by Bun.spawn
- **detached option**: Not supported in Bun.spawn (provided via `detach()` method instead)

### Improved Features
- **Type Safety**: Complete removal of `any`, all types explicit
- **Interfaces**: Clear type definitions like BunSubprocess, PtySubprocess, SpawnError
- **Type Guards**: Runtime type validation with isOutputEvent, isSpawnError
- **Static Methods**: Convenience methods like spawn, spawnPty, spawnSplit, spawnPromise
- **Cleanup System**: Extensible cleanup logic with onCleanup callbacks

### New Features
- **PTY Mode**: Complete virtual terminal support with bun-pty integration
- **Dynamic stdin**: Input stdin to running processes with write() method
- **Process Detach**: Switch processes to background with detach() method
- **Terminal Resize**: Dynamic size adjustment in PTY mode with resize() method
- **Status Queries**: Query status with isRunning(), isPtyMode() methods
- **toSplitPromise()**: Return Promise with separated stdout/stderr
- **Generic Types**: Distinguish split/non-split with `Spawn<T>` generic
- **Async Iterable stdin**: Flexible input handling with async generator support
- **Runtime Type Guards**: Runtime stability with stdin/stdout/stderr type checking
- **SIGTERM Handling**: Normal termination handling for exit code 143 (SIGTERM)
- **Stream Type Safety**: Prevent type errors by distinguishing file descriptor vs stream

## PTY vs Standard Mode

### PTY Mode (usePty: true)
- **Advantages**:
  - Complete terminal emulation (supports interactive programs like vim, nano, htop)
  - Full ANSI escape code support
  - Terminal size adjustment possible (resize)
  - Process recognizes it's connected to TTY
- **Disadvantages**:
  - Cannot distinguish stdout/stderr (single stream)
  - Slight overhead

### Standard Mode (default)
- **Advantages**:
  - Can separate stdout/stderr (split option)
  - Lightweight overhead
  - Optimized for simple command execution
- **Disadvantages**:
  - Limited interactive program execution
  - No TTY-based features supported

### Usage Guide
- **When to use PTY**: vim, nano, python -i, node repl, ssh, top, etc.
- **When to use Standard**: ls, cat, echo, grep, etc. simple commands
