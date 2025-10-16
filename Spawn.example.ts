#!/usr/bin/env bun
/**
 * Spawn.ts 사용 예제
 * 실행 방법: bun run Spawn.example.ts
 */

import { Spawn } from "./Spawn";

// 색상 출력 헬퍼
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  dim: "\x1b[2m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  red: "\x1b[31m",
};

const log = (title: string, message: string) => {
  console.log(
    `${colors.cyan}${colors.bright}[${title}]${colors.reset} ${message}`,
  );
};

const success = (message: string) => {
  console.log(`${colors.green}✓${colors.reset} ${message}`);
};

const error = (message: string) => {
  console.log(`${colors.red}✗${colors.reset} ${message}`);
};

const separator = () => {
  console.log(`${colors.dim}${"─".repeat(60)}${colors.reset}\n`);
};

// ============================================================================
// Example 1: 기본 Subscribe 패턴
// ============================================================================
const example1_basicSubscribe = async () => {
  log("Example 1", "기본 Subscribe 패턴");

  const spawn = Spawn.spawn("echo", ["Hello, World!"]);

  return new Promise<void>((resolve) => {
    const subscription = spawn.subscribe(
      (data) => {
        console.log(`  출력: ${data.trim()}`);
      },
      (err) => {
        error(`에러 발생: ${err.message}`);
        resolve();
      },
      () => {
        success("프로세스 완료");
        subscription.unsubscribe();
        resolve();
      },
    );
  });
};

// ============================================================================
// Example 2: Promise 패턴 (가장 간단)
// ============================================================================
const example2_promisePattern = async () => {
  log("Example 2", "Promise 패턴");

  try {
    const output = await Spawn.spawnPromise("ls", ["-la"]);
    console.log(`  총 출력 길이: ${output.length} bytes`);
    console.log(`  첫 줄: ${output.split("\n")[0]}`);
    success("Promise 패턴 성공");
  } catch (err) {
    error(`에러: ${err instanceof Error ? err.message : String(err)}`);
  }
};

// ============================================================================
// Example 3: Split 모드 (stdout/stderr 분리)
// ============================================================================
const example3_splitMode = async () => {
  log("Example 3", "Split 모드 - stdout/stderr 분리");

  const spawn = Spawn.spawnSplit("sh", [
    "-c",
    'echo "stdout output" && echo "stderr output" >&2',
  ]);

  return new Promise<void>((resolve) => {
    const subscription = spawn.subscribe(
      (data) => {
        if (data.source === "stdout") {
          console.log(
            `  ${colors.green}[stdout]${colors.reset} ${data.text.trim()}`,
          );
        } else {
          console.log(
            `  ${colors.yellow}[stderr]${colors.reset} ${data.text.trim()}`,
          );
        }
      },
      (err) => {
        error(`에러: ${err.message}`);
        resolve();
      },
      () => {
        success("Split 모드 완료");
        subscription.unsubscribe();
        resolve();
      },
    );
  });
};

// ============================================================================
// Example 4: Split Promise 패턴
// ============================================================================
const example4_splitPromise = async () => {
  log("Example 4", "Split Promise 패턴");

  const spawn = Spawn.spawnSplit("sh", [
    "-c",
    'echo "Line 1 to stdout" && echo "Line 1 to stderr" >&2 && echo "Line 2 to stdout"',
  ]);

  try {
    const { stdout, stderr } = await spawn.toSplitPromise();
    console.log(`  ${colors.green}stdout:${colors.reset} ${stdout.trim()}`);
    console.log(`  ${colors.yellow}stderr:${colors.reset} ${stderr.trim()}`);
    success("Split Promise 완료");
  } catch (err) {
    error(`에러: ${err instanceof Error ? err.message : String(err)}`);
  }
};

// ============================================================================
// Example 5: stdin 입력
// ============================================================================
const example5_stdinInput = async () => {
  log("Example 5", "stdin 입력");

  // 비동기 제너레이터로 stdin 데이터 생성
  const generateInput = async function* () {
    yield "Hello\n";
    yield "World\n";
    yield "From\n";
    yield "Spawn\n";
  };

  const spawn = Spawn.spawn("cat", [], { stdin: generateInput() });

  try {
    const output = await spawn.toPromise();
    console.log(
      `  받은 출력:\n${output
        .split("\n")
        .map((l) => `    ${l}`)
        .join("\n")}`,
    );
    success("stdin 입력 완료");
  } catch (err) {
    error(`에러: ${err instanceof Error ? err.message : String(err)}`);
  }
};

// ============================================================================
// Example 6: 에러 핸들링 (exit code !== 0)
// ============================================================================
const example6_errorHandling = async () => {
  log("Example 6", "에러 핸들링 (exit code !== 0)");

  try {
    // 존재하지 않는 파일 읽기 시도
    await Spawn.spawnPromise("cat", ["/nonexistent/file.txt"]);
  } catch (err) {
    if (
      err instanceof Error &&
      "exitCode" in err &&
      typeof err.exitCode === "number"
    ) {
      console.log(
        `  ${colors.yellow}Exit Code:${colors.reset} ${err.exitCode}`,
      );
      console.log(
        `  ${colors.yellow}Error:${colors.reset} ${err.message.split("\n")[0]}`,
      );
      success("에러를 올바르게 캐치했습니다");
    } else {
      error("예상치 못한 에러 타입");
    }
  }
};

// ============================================================================
// Example 7: Echo Output (실시간 출력)
// ============================================================================
const example7_echoOutput = async () => {
  log("Example 7", "Echo Output - 실시간 콘솔 출력");

  console.log(`  ${colors.dim}실시간 출력 시작...${colors.reset}`);

  try {
    await Spawn.spawnPromise(
      "sh",
      ["-c", 'for i in 1 2 3; do echo "Count: $i"; sleep 0.1; done'],
      { echoOutput: true },
    );
    success("Echo output 완료");
  } catch (err) {
    error(`에러: ${err instanceof Error ? err.message : String(err)}`);
  }
};

// ============================================================================
// Example 8: Cleanup 콜백
// ============================================================================
const example8_cleanupCallback = async () => {
  log("Example 8", "Cleanup 콜백");

  const spawn = Spawn.spawn("sleep", ["1"]);

  // Cleanup 콜백 등록
  spawn.onCleanup(() => {
    console.log(`  ${colors.magenta}Cleanup 콜백 실행됨${colors.reset}`);
  });

  return new Promise<void>((resolve) => {
    const subscription = spawn.subscribe(
      (data) => {
        console.log(`  출력: ${data}`);
      },
      (err) => {
        error(`에러: ${err.message}`);
        resolve();
      },
      () => {
        success("프로세스 완료");
        subscription.unsubscribe();
        resolve();
      },
    );

    // 0.5초 후 강제 종료
    setTimeout(() => {
      console.log(`  ${colors.yellow}0.5초 후 강제 종료...${colors.reset}`);
      subscription.unsubscribe(); // 이때 cleanup 콜백이 실행됨
      success("강제 종료 완료");
      resolve();
    }, 500);
  });
};

// ============================================================================
// Example 15: PTY 모드 - 기본 명령어 테스트
// ============================================================================
const example15_ptyPython = async () => {
  log("Example 15", "PTY 모드 - 기본 명령어 테스트");

  const spawn = Spawn.spawnPty("echo", ["Hello", "from", "PTY"]);

  console.log(`  ${colors.dim}PTY 모드로 echo 실행 중...${colors.reset}`);

  return new Promise<void>((resolve) => {
    const timeout = setTimeout(() => {
      success("PTY echo 실행 완료 (timeout)");
      resolve();
    }, 1000);

    spawn.subscribe(
      (data) => {
        const trimmed = data.trim();
        if (trimmed) {
          console.log(`  PTY 출력: ${trimmed}`);
        }
      },
      (err) => {
        clearTimeout(timeout);
        error(`에러: ${err.message}`);
        resolve();
      },
      () => {
        clearTimeout(timeout);
        success("PTY echo 실행 완료");
        resolve();
      },
    );
  });
};

// ============================================================================
// Example 9: 여러 프로세스 병렬 실행
// ============================================================================
const example9_parallelExecution = async () => {
  log("Example 9", "여러 프로세스 병렬 실행");

  const commands = [
    { cmd: "echo", args: ["Process 1"] },
    { cmd: "echo", args: ["Process 2"] },
    { cmd: "echo", args: ["Process 3"] },
  ];

  try {
    const results = await Promise.all(
      commands.map(({ cmd, args }) => Spawn.spawnPromise(cmd, args)),
    );

    results.forEach((output, index) => {
      console.log(
        `  ${colors.blue}[${index + 1}]${colors.reset} ${output.trim()}`,
      );
    });

    success(`${results.length}개 프로세스 병렬 실행 완료`);
  } catch (err) {
    error(`에러: ${err instanceof Error ? err.message : String(err)}`);
  }
};

// ============================================================================
// Example 10: 복잡한 파이프라인 시뮬레이션
// ============================================================================
const example10_pipelineSimulation = async () => {
  log("Example 10", "복잡한 파이프라인 시뮬레이션");

  // Step 1: 데이터 생성
  console.log(`  ${colors.dim}Step 1: 데이터 생성${colors.reset}`);
  const step1 = await Spawn.spawnPromise("echo", [
    "apple\nbanana\ncherry\ndate",
  ]);

  // Step 2: 정렬 (stdin 사용)
  console.log(`  ${colors.dim}Step 2: 정렬${colors.reset}`);
  const inputStep2 = async function* () {
    yield step1;
  };
  const spawn2 = Spawn.spawn("sort", [], { stdin: inputStep2() });
  const step2 = await spawn2.toPromise();

  // Step 3: 카운트
  console.log(`  ${colors.dim}Step 3: 라인 수 계산${colors.reset}`);
  const lineCount = step2.trim().split("\n").length;

  console.log(`  ${colors.green}정렬된 결과:${colors.reset}`);
  step2
    .trim()
    .split("\n")
    .forEach((line, i) => {
      console.log(`    ${i + 1}. ${line}`);
    });
  console.log(`  ${colors.green}총 라인 수:${colors.reset} ${lineCount}`);

  success("파이프라인 시뮬레이션 완료");
};

// ============================================================================
// Example 11: 타입 안정성 데모
// ============================================================================
const example11_typeSafety = async () => {
  log("Example 11", "타입 안정성 데모");

  // spawn() - Spawn<string> 반환
  const normalSpawn = Spawn.spawn("echo", ["test"]);
  normalSpawn.subscribe((data: string) => {
    console.log(`  일반 모드 - 타입: ${typeof data}, 값: ${data.trim()}`);
  });

  await new Promise((resolve) => setTimeout(resolve, 100));

  // spawnSplit() - Spawn<OutputEvent> 반환
  const splitSpawn = Spawn.spawnSplit("echo", ["test"]);
  splitSpawn.subscribe((data) => {
    // data는 OutputEvent 타입이 보장됨
    console.log(
      `  Split 모드 - source: ${data.source}, text: ${data.text.trim()}`,
    );
  });

  await new Promise((resolve) => setTimeout(resolve, 100));

  success("타입 안정성 검증 완료");
};

// ============================================================================
// Example 12: 인코딩 지정
// ============================================================================
const example12_encoding = async () => {
  log("Example 12", "인코딩 지정");

  try {
    // UTF-8 인코딩으로 한글 출력
    const output = await Spawn.spawnPromise("echo", ["안녕하세요 🚀"], {
      encoding: "utf8",
    });
    console.log(`  출력: ${output.trim()}`);
    success("인코딩 지정 완료");
  } catch (err) {
    error(`에러: ${err instanceof Error ? err.message : String(err)}`);
  }
};

// ============================================================================
// Example 13: 동적 stdin 입력 (write 메서드)
// ============================================================================
const example13_dynamicStdin = async () => {
  log("Example 13", "동적 stdin 입력 (write 메서드)");

  const spawn = Spawn.spawn("cat", []);

  return new Promise<void>((resolve) => {
    const subscription = spawn.subscribe(
      (data) => {
        const trimmed = data.trim();
        if (trimmed) {
          console.log(`  Cat 출력: ${trimmed}`);
        }
      },
      (err) => {
        console.error(`  에러: ${err.message}`);
        resolve();
      },
      () => {
        success("동적 stdin 입력 완료");
        resolve();
      },
    );

    // Send input asynchronously with timeout
    (async () => {
      await Bun.sleep(100);
      console.log(`  ${colors.dim}입력 1 전송...${colors.reset}`);
      await spawn.write("First line\n");
      await Bun.sleep(100);

      console.log(`  ${colors.dim}입력 2 전송...${colors.reset}`);
      await spawn.write("Second line\n");
      await Bun.sleep(100);

      console.log(`  ${colors.dim}프로세스 종료...${colors.reset}`);
      // Instead of EOF, just unsubscribe to kill the process
      subscription.unsubscribe();
      await Bun.sleep(100);
      success("동적 stdin 입력 완료");
      resolve();
    })();
  });
};

// ============================================================================
// Example 14: 프로세스 상태 확인
// ============================================================================
const example14_processStatus = async () => {
  log("Example 14", "프로세스 상태 확인");

  const spawn = Spawn.spawn("sleep", ["1"]);

  console.log(`  ${colors.green}시작 시:${colors.reset}`);
  console.log(`    - isRunning(): ${spawn.isRunning()}`);
  console.log(`    - isPtyMode(): ${spawn.isPtyMode()}`);

  return new Promise<void>((resolve) => {
    spawn.subscribe(
      (data) => console.log(data),
      (err) => {
        error(`에러: ${err.message}`);
        resolve();
      },
      () => {
        console.log(`  ${colors.yellow}완료 후:${colors.reset}`);
        console.log(`    - isRunning(): ${spawn.isRunning()}`);
        success("상태 확인 완료");
        resolve();
      },
    );
  });
};

// ============================================================================
// Example 16: PTY 모드 확인
// ============================================================================
const example16_ptyModeCheck = async () => {
  log("Example 16", "PTY 모드 확인");

  const spawn1 = Spawn.spawn("echo", ["Standard mode"]);
  const spawn2 = Spawn.spawnPty("echo", ["PTY mode"]);

  await Promise.all([
    new Promise<void>((resolve) => {
      spawn1.subscribe(
        () => {
          // Check after process starts
          console.log(
            `  ${colors.blue}Standard spawn:${colors.reset} isPtyMode() = ${spawn1.isPtyMode()}`,
          );
        },
        () => resolve(),
        () => resolve(),
      );
    }),
    new Promise<void>((resolve) => {
      const sub2 = spawn2.subscribe(
        () => {
          // Check after process starts
          console.log(
            `  ${colors.magenta}PTY spawn:${colors.reset} isPtyMode() = ${spawn2.isPtyMode()}`,
          );
        },
        () => resolve(),
        () => resolve(),
      );
      // PTY 프로세스는 자동으로 종료되지 않을 수 있으므로 타임아웃 추가
      setTimeout(() => {
        sub2.unsubscribe();
        resolve();
      }, 1000);
    }),
  ]);

  success("PTY 모드 확인 완료");
};

// ============================================================================
// Example 17: 프로세스 Detach
// ============================================================================
const example17_detach = async () => {
  log("Example 17", "프로세스 Detach");

  const spawn = Spawn.spawn("sleep", ["2"]);

  spawn.subscribe((data) => {
    console.log(`  출력: ${data}`);
  });

  await Bun.sleep(500);

  console.log(`  ${colors.yellow}0.5초 후 detach 실행...${colors.reset}`);
  const subprocess = spawn.detach();

  if (subprocess) {
    console.log(
      `  ${colors.green}Detached!${colors.reset} 프로세스는 백그라운드에서 계속 실행됩니다.`,
    );
    console.log(`  프로세스 PID: ${subprocess.pid}`);

    // Kill the detached process to prevent hanging
    console.log(`  ${colors.dim}프로세스 정리 중...${colors.reset}`);
    try {
      subprocess.kill();
      // Wait for process exit only for standard subprocess
      if ("exited" in subprocess) {
        await subprocess.exited;
      }
    } catch (_err) {
      // Ignore SIGTERM exit code (143)
    }
  }

  success("Detach 완료");
};

// ============================================================================
// Example 18: PTY 모드에서 write 테스트
// ============================================================================
const example18_ptyWrite = async () => {
  log("Example 18", "PTY 모드에서 동적 write 테스트");

  const spawn = Spawn.spawnPty("cat", []);

  return new Promise<void>((resolve) => {
    const subscription = spawn.subscribe(
      (data) => {
        const trimmed = data.trim();
        if (trimmed) {
          console.log(`  PTY Cat 출력: ${trimmed}`);
        }
      },
      (err) => {
        console.error(`  에러: ${err.message}`);
        resolve();
      },
      () => {
        success("PTY write 완료");
        resolve();
      },
    );

    (async () => {
      await Bun.sleep(100);
      console.log(`  ${colors.dim}PTY 입력 1 전송...${colors.reset}`);
      await spawn.write("First PTY line\n");
      await Bun.sleep(100);

      console.log(`  ${colors.dim}PTY 입력 2 전송...${colors.reset}`);
      await spawn.write("Second PTY line\n");
      await Bun.sleep(100);

      console.log(`  ${colors.dim}PTY 프로세스 종료...${colors.reset}`);
      subscription.unsubscribe();
      success("PTY write 완료");
      await Bun.sleep(100);
      resolve();
    })();
  });
};

// ============================================================================
// Main Runner
// ============================================================================
const main = async () => {
  console.log(
    `\n${colors.bright}${colors.magenta}═══════════════════════════════════════════════════════════${colors.reset}`,
  );
  console.log(
    `${colors.bright}${colors.magenta}  Spawn.ts 사용 예제 모음${colors.reset}`,
  );
  console.log(
    `${colors.bright}${colors.magenta}═══════════════════════════════════════════════════════════${colors.reset}\n`,
  );

  const examples = [
    example1_basicSubscribe,
    example2_promisePattern,
    example3_splitMode,
    example4_splitPromise,
    example5_stdinInput,
    example6_errorHandling,
    example7_echoOutput,
    example8_cleanupCallback,
    example9_parallelExecution,
    example10_pipelineSimulation,
    example11_typeSafety,
    example12_encoding,
    example13_dynamicStdin,
    example14_processStatus,
    example15_ptyPython,
    example16_ptyModeCheck,
    example17_detach,
    example18_ptyWrite,
  ];

  for (const example of examples) {
    try {
      await example();
    } catch (err) {
      error(
        `예제 실행 중 에러: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
    separator();
    await new Promise((resolve) => setTimeout(resolve, 200)); // 예제 간 딜레이
  }

  console.log(
    `${colors.bright}${colors.green}모든 예제 실행 완료!${colors.reset}\n`,
  );
};

// Run all examples
main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
