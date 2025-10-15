# Spawn Class Interface (Based on Z31 Function)

## Overview
Spawn 클래스는 프로세스를 스폰하고 EventEmitter 기반으로 입출력을 처리하는 고급 프로세스 실행 인터페이스입니다. 원래의 Z31 함수를 개선하여 RxJS 의존성을 완전히 제거하고 타입 안정성을 강화했습니다. 깔끔한 아웃풋 캡처와 백그라운드 실행을 지원하며 Bun 런타임을 활용합니다.

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
실행할 명령어 (예: "echo", "ls", "/bin/sh")

### args: string[]
명령어에 전달할 인자 배열

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
  onSpawn?: (subprocess: PtySubprocess | BunSubprocess) => void  // 프로세스 시작 콜백
}
```

**주의사항**:
- `detached` 옵션은 Bun.spawn에서 미지원되어 실제로는 무시됩니다
- 백그라운드 실행이 필요한 경우 `detach()` 메서드를 사용하세요

## Return Value

### Spawn<string> (기본 모드)
```typescript
// subscribe를 통한 데이터 수신
Spawn<string>.subscribe((data: string) => {
  // stdout과 stderr이 합쳐진 텍스트 스트림
})
```

### Spawn<OutputEvent> (split 모드)
```typescript
interface OutputEvent {
  source: "stdout" | "stderr"
  text: string
}

// subscribe를 통한 데이터 수신
Spawn<OutputEvent>.subscribe((data: OutputEvent) => {
  // stdout/stderr 분리된 객체 스트림
})
```

## Key Features

1. **EventEmitter 기반 입출력**: RxJS 없이 Node.js EventEmitter를 사용한 비동기 스트림 처리
2. **타입 안정성**: 완전한 TypeScript 타입 정의, `any` 타입 완전 제거, 런타임 타입 가드
3. **깔끔한 아웃풋 캡처**: AsyncSubject 패턴을 EventEmitter로 구현하여 stdout/stderr 완전 캡처
4. **자동 프로세스 관리**: 에러 발생 시 자동 종료, 구독 해제 시 프로세스 킬
5. **백그라운드 실행 지원**: detached 옵션과 spawnDetached 함수로 백그라운드 프로세스 관리
6. **에러 처리**: exit code 기반 에러 생성 및 전파, SIGTERM(143) 정상 처리
7. **인코딩 지원**: UTF-8 기본, 커스텀 인코딩 지원, 안전한 텍스트 변환
8. **Bun 런타임**: Bun.spawn() 및 bun-pty API 활용으로 성능 최적화
9. **PTY 지원**: bun-pty를 통한 완전한 PTY 모드 지원 (vim, nano 등 대화형 프로그램)
10. **동적 stdin 입력**: 실행 중인 프로세스에 동적으로 stdin 데이터 전송 가능 (write 메서드)
11. **프로세스 Detach**: 실행 중인 프로세스를 detach하여 백그라운드 실행으로 전환 가능
12. **프로세스 상태 조회**: isRunning(), isPtyMode() 메서드로 프로세스 실행 상태 확인
13. **저수준 접근**: getSubprocess() 메서드로 Bun subprocess 또는 PTY 프로세스 객체 직접 접근
14. **터미널 리사이즈**: PTY 모드에서 resize() 메서드로 동적 터미널 크기 조정
15. **안전한 스트림 처리**: stdin/stdout/stderr의 타입 체크로 file descriptor 오류 방지

## Usage Examples

### 1. 기본 Subscribe 패턴
```typescript
const spawn = Spawn.spawn("echo", ["Hello, World!"]);

const subscription = spawn.subscribe(
  (data) => {
    console.log(`출력: ${data}`);
  },
  (err) => {
    console.error(`에러: ${err.message}`);
  },
  () => {
    console.log("프로세스 완료");
    subscription.unsubscribe();
  }
);
```

### 2. Promise 패턴 (가장 간단)
```typescript
const output = await Spawn.spawnPromise("ls", ["-la"]);
console.log(output);
```

### 3. Split 모드 (stdout/stderr 분리)
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

### 4. Split Promise 패턴
```typescript
const spawn = Spawn.spawnSplit("sh", ["-c", 'echo "out" && echo "err" >&2']);
const { stdout, stderr } = await spawn.toSplitPromise();
console.log(`stdout: ${stdout}`);
console.log(`stderr: ${stderr}`);
```

### 5. stdin 입력 (Async Generator)
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

### 6. 에러 핸들링 (exit code !== 0)
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

### 7. Echo Output (실시간 출력)
```typescript
await Spawn.spawnPromise("sh", ["-c", 'for i in 1 2 3; do echo "Count: $i"; sleep 0.1; done'], {
  echoOutput: true,  // 콘솔에 실시간으로 출력됨
});
```

### 8. Cleanup 콜백
```typescript
const spawn = Spawn.spawn("long-running-command", []);

spawn.onCleanup(() => {
  console.log("프로세스 정리 중...");
});

const subscription = spawn.subscribe(
  (data) => console.log(data),
  (err) => console.error(err),
  () => console.log("완료")
);

// 필요 시 강제 종료
setTimeout(() => {
  subscription.unsubscribe(); // cleanup 콜백 실행됨
}, 5000);
```

### 9. 병렬 실행
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

### 10. Detached 백그라운드 프로세스
```typescript
const spawn = Spawn.spawnDetached("long-running-daemon", []);

// 또는 Promise 패턴
const output = await Spawn.spawnDetachedPromise("background-task", []);
```

### 11. 실행 중인 프로세스에 동적으로 stdin 입력
```typescript
// 대화형 프로세스 시작
const spawn = Spawn.spawn("python3", ["-i"]);

spawn.subscribe((data) => {
  console.log(data);
});

// 프로세스 시작 후 동적으로 명령어 입력
await spawn.write("print('Hello from stdin')\n");
await spawn.write("x = 10\n");
await spawn.write("print(x * 2)\n");

// write() 메서드는 PTY와 Standard 모드 모두 지원
// - Standard 모드: stdin이 FileSink인지 체크 후 write
// - PTY 모드: PTY process의 write 메서드 사용
```

### 12. 실행 중인 프로세스 Detach
```typescript
// 프로세스 시작
const spawn = Spawn.spawn("long-running-server", []);

const subscription = spawn.subscribe((data) => {
  console.log(data);
});

// 잠시 후 detach하여 백그라운드에서 계속 실행
setTimeout(() => {
  const subprocess = spawn.detach();
  console.log("Process detached but still running");

  // 필요시 subprocess 객체로 직접 관리 가능
  if (subprocess) {
    console.log("PID:", subprocess.pid);
  }
}, 5000);
```

### 13. 프로세스 상태 확인
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

### 14. 고급: subprocess 객체 직접 접근
```typescript
const spawn = Spawn.spawn("node", ["-v"]);

spawn.subscribe((data) => console.log(data));

const subprocess = spawn.getSubprocess();
if (subprocess) {
  console.log("Process ID:", subprocess.pid);
  console.log("Exit code (when done):", await subprocess.exited);
}
```

### 15. PTY 모드로 대화형 프로그램 실행
```typescript
// vim 편집기 실행 (PTY 필수)
const spawn = Spawn.spawnPty("vim", ["test.txt"]);

spawn.subscribe((data) => {
  console.log("Screen output:", data);
});

// vim 명령어 입력
await spawn.write("i");           // Insert 모드 진입
await spawn.write("Hello, World!\n");  // 텍스트 입력
await spawn.write("\x1b");        // ESC 키 (종료 모드)
await spawn.write(":wq\n");       // 저장 후 종료
```

### 16. PTY 모드로 Python 대화형 세션
```typescript
const spawn = Spawn.spawnPty("python3", ["-i"]);

spawn.subscribe((data) => {
  console.log(data);
});

// Python 명령어 동적 입력
await spawn.write("x = 10\n");
await spawn.write("y = 20\n");
await spawn.write("print(x + y)\n");
await spawn.write("exit()\n");
```

### 17. PTY 터미널 리사이즈
```typescript
const spawn = Spawn.spawnPty("top", []);

spawn.subscribe((data) => {
  console.log(data);
});

// 터미널 크기 변경
setTimeout(() => {
  spawn.resize(120, 40);
  console.log("Terminal resized to 120x40");
}, 2000);
```

### 18. PTY 모드 확인
```typescript
const spawn1 = Spawn.spawn("echo", ["test"]);
console.log("Is PTY mode?", spawn1.isPtyMode()); // false

const spawn2 = Spawn.spawnPty("vim", ["test.txt"]);
console.log("Is PTY mode?", spawn2.isPtyMode()); // true
```

### 19. PTY Promise 패턴
```typescript
// vim으로 파일 편집 후 결과 캡처
const output = await Spawn.spawnPtyPromise("vim", ["test.txt"]);
console.log("Final output:", output);
```

## Deep Dive: Output Capture Mechanism

### EventEmitter 기반 AsyncSubject 패턴 구현
- **stdout/stderr 분리 관리**: 각 스트림을 독립적으로 읽고 완료 상태 추적
- **완전성 보장**: `stdoutClosed`, `stderrClosed`, `exitCode` 모두 준비될 때까지 대기
- **청크 처리**: ReadableStream의 각 청크마다 텍스트 변환 및 EventEmitter로 전송
- **안전한 변환**: Uint8Array → String 변환 시 예외 처리 및 fallback 메시지

### Text Transformation Process (processChunk 함수)
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

### Completion Detection (checkCompletion 메서드)
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
- **split: true**: `{source: "stdout"|"stderr", text: string}` 객체 스트림 (타입: `Spawn<OutputEvent>`)
- **split: false**: 순수 텍스트 스트림 (기본값, 타입: `Spawn<string>`)

## Process Lifecycle Management

### 프로세스 생명주기
1. **Spawn**: `Bun.spawn()`으로 프로세스 생성
2. **Stream Setup**: stdin/stdout/stderr ReadableStream/WritableStream 설정
3. **Data Flow**: 각 스트림에서 청크 단위로 데이터 읽기 및 EventEmitter로 전송
4. **Completion**: stdout/stderr close + process exit 확인 후 complete 이벤트 발생
5. **Cleanup**: 구독 해제 시 프로세스 kill 및 cleanup 콜백 실행

### Subscription Management
```typescript
interface SpawnSubscription {
  unsubscribe(): void
}

// 구독 시작
const subscription = spawn.subscribe(onData, onError, onComplete);

// 구독 해제 (프로세스 자동 종료)
subscription.unsubscribe();
```

### Automatic Cleanup
- 모든 구독자가 unsubscribe하면 프로세스 자동 kill
- `onCleanup()` 콜백을 통해 커스텀 정리 로직 추가 가능
- 프로세스 종료 시 모든 cleanup 콜백 실행

## Error Handling

### SpawnError 인터페이스
```typescript
interface SpawnError extends Error {
  exitCode: number
  code: number
}
```

### 에러 전파
- 프로세스 에러: EventEmitter의 "error" 이벤트로 전파
- 비정상 종료: exit code !== 0 && !== 143일 때 SpawnError 생성 및 전파
- SIGTERM 처리: exit code 143 (SIGTERM)은 정상 종료로 간주 (complete 이벤트 발생)
- stdin 쓰기 에러: writeStdin() 실패 시 에러 이벤트 발생
- 스트림 읽기 에러: readStream() 실패 시 에러 이벤트 발생
- stdin 타입 에러: file descriptor (number) 타입일 경우 명시적 에러

### Exit Code 처리 정책
- **0**: 정상 종료 (complete)
- **143**: SIGTERM으로 종료, 정상 종료로 간주 (complete)
- **기타**: 비정상 종료로 간주 (error)

### Type Guards
```typescript
// OutputEvent 타입 가드
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

// SpawnError 타입 가드
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
- **Dual Runtime Support**: `Bun.spawn()` (일반 프로세스) 및 `bun-pty` (PTY 모드) 양쪽 지원
- **PTY Integration**: bun-pty를 통한 완전한 가상 터미널 지원, vim/nano 등 대화형 프로그램 실행
- **No Dependencies**: RxJS, Lodash 등 외부 의존성 완전 제거
- **Type Safety**: 모든 `any` 타입 제거, 완전한 TypeScript 타입 안정성

### Output Safety
- 모든 청크를 TextDecoder로 변환, 실패 시 fallback 메시지
- 스트림 완전 캡처 (AsyncSubject 패턴)
- 손실 방지 메커니즘 내장
- stdout/stderr 타입 체크: `ReadableStream` vs `number` (file descriptor) 구분

### Resource Management
- EventEmitter 기반 구독 관리
- 메모리 누수 방지 (자동 리스너 제거)
- 프로세스 자동 정리 (unsubscribe 시 kill)
- SIGTERM(143) 정상 종료 처리로 cleanup 안정성 향상

### Stream Type Safety
- **stdin 체크**: `typeof stdin === "number"` 체크로 file descriptor 필터링
- **stdout/stderr 체크**: `instanceof ReadableStream` 체크로 안전한 스트림 읽기
- **FileSink 타입**: stdin이 FileSink가 아닌 number일 경우 명시적 에러 발생

### Encoding Robustness
- UTF-8 기본, 커스텀 인코딩 지원
- TextDecoder로 안전한 변환
- fallback 에러 처리로 안정성 보장

## Differences from Original Z31

### 제거된 기능
- **RxJS Observable**: EventEmitter로 대체
- **Windows Jobber**: Bun 런타임이 프로세스 관리 담당
- **stdio 옵션**: Bun.spawn이 자동 처리
- **detached 옵션**: Bun.spawn에서 미지원 (대신 `detach()` 메서드 제공)

### 개선된 기능
- **타입 안정성**: `any` 완전 제거, 모든 타입 명시
- **인터페이스**: BunSubprocess, PtySubprocess, SpawnError 등 명확한 타입 정의
- **Type Guards**: isOutputEvent, isSpawnError로 런타임 타입 검증
- **Static Methods**: spawn, spawnPty, spawnSplit, spawnPromise 등 편의 메서드
- **Cleanup System**: onCleanup 콜백으로 확장 가능한 정리 로직

### 새로운 기능
- **PTY Mode**: bun-pty 통합으로 완전한 가상 터미널 지원
- **Dynamic stdin**: write() 메서드로 실행 중 stdin 입력
- **Process Detach**: detach() 메서드로 프로세스를 백그라운드로 전환
- **Terminal Resize**: PTY 모드에서 resize() 메서드로 동적 크기 조정
- **Status Queries**: isRunning(), isPtyMode() 메서드로 상태 조회
- **toSplitPromise()**: stdout/stderr 분리된 Promise 반환
- **Generic Types**: `Spawn<T>` 제네릭으로 split/non-split 구분
- **Async Iterable stdin**: async generator 지원으로 유연한 입력 처리
- **Runtime Type Guards**: stdin/stdout/stderr 타입 체크로 런타임 안정성 보장
- **SIGTERM Handling**: exit code 143 (SIGTERM) 정상 종료 처리
- **Stream Type Safety**: file descriptor vs stream 구분으로 타입 에러 방지

## PTY vs Standard Mode

### PTY 모드 (usePty: true)
- **장점**:
  - 완전한 터미널 에뮬레이션 (vim, nano, htop 등 대화형 프로그램 지원)
  - ANSI 이스케이프 코드 완전 지원
  - 터미널 크기 조정 가능 (resize)
  - 프로세스가 TTY에 연결되었다고 인식
- **단점**:
  - stdout/stderr 구분 불가 (단일 스트림)
  - 약간의 오버헤드

### Standard 모드 (기본값)
- **장점**:
  - stdout/stderr 분리 가능 (split 옵션)
  - 가벼운 오버헤드
  - 단순한 명령어 실행에 최적화
- **단점**:
  - 대화형 프로그램 실행 제한
  - TTY 기반 기능 미지원

### 사용 가이드
- **PTY 사용 시기**: vim, nano, python -i, node repl, ssh, top 등
- **Standard 사용 시기**: ls, cat, echo, grep 등 단순 명령어
