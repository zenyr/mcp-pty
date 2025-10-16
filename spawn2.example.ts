#!/usr/bin/env bun

/**
 * Spawn2.ts 사용 예제 - bun-pty + xterm/headless 기반
 * 실행 방법: bun run spawn2.example.ts
 */

import stripAnsi from "strip-ansi";
import { Spawn2 } from "./spawn2";

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
// Example 1: 기본 PTY 모드
// ============================================================================
const example1_basicPty = async () => {
  log("Example 1", "기본 PTY 모드");

  const spawn = Spawn2.spawn("echo", ["Hello, Spawn2!"]);

  return new Promise<void>((resolve) => {
    const subscription = spawn.subscribe(
      (data) => {
        const trimmed = data.trim();
        if (trimmed) {
          console.log(`  출력: ${trimmed}`);
        }
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
// Example 2: Promise 패턴
// ============================================================================
const example2_promisePattern = async () => {
  log("Example 2", "Promise 패턴");

  try {
    const output = await Spawn2.spawnPromise("ls", ["-la"]);
    console.log(`  총 출력 길이: ${output.length} bytes`);
    console.log(`  첫 줄: ${output.split("\n")[0]}`);
    success("Promise 패턴 성공");
  } catch (err) {
    error(`에러: ${err instanceof Error ? err.message : String(err)}`);
  }
};

// ============================================================================
// Example 3: stdin 입력
// ============================================================================
const example3_stdinInput = async () => {
  log("Example 3", "stdin 입력");

  // 비동기 제너레이터로 stdin 데이터 생성
  const generateInput = async function* () {
    yield "Hello\n";
    yield "World\n";
    yield "From\n";
    yield "Spawn2\n";
  };

  const spawn = Spawn2.spawn("cat", [], {
    stdin: generateInput(),
    sendEof: true,
  });

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
// Example 4: 동적 stdin 입력 (write 메서드)
// ============================================================================
const example4_dynamicStdin = async () => {
  log("Example 4", "동적 stdin 입력 (write 메서드)");

  const spawn = Spawn2.spawn("cat", []);

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

    (async () => {
      await Bun.sleep(100);
      console.log(`  ${colors.dim}입력 1 전송...${colors.reset}`);
      await spawn.write("First line\n");
      await Bun.sleep(100);

      console.log(`  ${colors.dim}입력 2 전송...${colors.reset}`);
      await spawn.write("Second line\n");
      await Bun.sleep(100);

      console.log(`  ${colors.dim}프로세스 종료...${colors.reset}`);
      subscription.unsubscribe();
      await Bun.sleep(100);
      success("동적 stdin 입력 완료");
      resolve();
    })();
  });
};

// ============================================================================
// Example 5: TUI 모드 활성화 (xterm/headless)
// ============================================================================
const example5_tuiMode = async () => {
  log("Example 5", "TUI 모드 활성화 (xterm/headless)");

  const spawn = Spawn2.spawn("echo", ["Hello from TUI"], { enableTui: true });

  return new Promise<void>((resolve) => {
    spawn.subscribe(
      (_data) => {
        // TUI 모드에서는 터미널 버퍼를 통해 데이터 접근
      },
      (err) => {
        error(`에러: ${err.message}`);
        resolve();
      },
      () => {
        // 터미널 버퍼 캡처
        try {
          const buffer = spawn.captureBuffer();
          console.log(`  ${colors.green}터미널 버퍼 캡처:${colors.reset}`);
          buffer.slice(0, 5).forEach((line, i) => {
            const trimmed = line.trim();
            if (trimmed) {
              console.log(`    [${i}] ${trimmed}`);
            }
          });
          success("TUI 모드 완료");
        } catch (err) {
          error(
            `버퍼 캡처 에러: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
        resolve();
      },
    );
  });
};

// ============================================================================
// Example 6: vi 같은 TUI 에디터 (xterm 통합)
// ============================================================================
const example6_viTui = async () => {
  log("Example 6", "vi 같은 TUI 에디터 (xterm 통합)");

  const tempFile = `/tmp/spawn2-vi-test-${Date.now()}.txt`;

  const spawn = Spawn2.spawn("vi", [tempFile], {
    enableTui: true,
    cols: 80,
    rows: 24,
  });

  return new Promise<void>((resolve) => {
    const subscription = spawn.subscribe(
      (data) => {
        // vi 출력은 복잡하므로 간단히 표시
        const stripped = stripAnsi(data);
        const trimmed = stripped.trim();
        if (trimmed && trimmed.length < 100) {
          console.log(`  VI 출력: ${trimmed.replace(/\n/g, "\\n")}`);
        }
      },
      (err) => {
        console.error(`  에러: ${err.message}`);
        Bun.file(tempFile)
          .delete()
          .catch(() => {});
        resolve();
      },
      () => {
        // 임시 파일 내용 확인
        Bun.file(tempFile)
          .text()
          .then((content) => {
            console.log(`  ${colors.green}생성된 파일 내용:${colors.reset}`);
            console.log(`    ${content.trim().replace(/\n/g, "\n    ")}`);
          })
          .catch(() => {
            console.log(`  ${colors.yellow}파일 읽기 실패${colors.reset}`);
          })
          .finally(() => {
            Bun.file(tempFile)
              .delete()
              .then(() => {
                console.log(
                  `  ${colors.dim}임시 파일 제거됨: ${tempFile}${colors.reset}`,
                );
              })
              .catch(() => {
                console.log(
                  `  ${colors.yellow}임시 파일 제거 실패${colors.reset}`,
                );
              })
              .finally(() => {
                success("VI 입력 시퀀스 완료");
                resolve();
              });
          });
      },
    );

    (async () => {
      await Bun.sleep(500);

      console.log(`  ${colors.dim}Insert 모드 진입 (i)...${colors.reset}`);
      await spawn.write("i");
      await Bun.sleep(100);

      console.log(`  ${colors.dim}텍스트 입력...${colors.reset}`);
      await spawn.write("Hello from Spawn2!\n");
      await spawn.write("This is a TUI test file.\n");
      await spawn.write("Generated with bun-pty + xterm/headless.\n");
      await Bun.sleep(200);

      console.log(`  ${colors.dim}Normal 모드로 전환 (ESC)...${colors.reset}`);
      await spawn.write("\x1b");
      await Bun.sleep(100);

      console.log(`  ${colors.dim}저장 및 종료 (:wq)...${colors.reset}`);
      await spawn.write(":wq\n");
      await Bun.sleep(500);

      setTimeout(() => {
        subscription.unsubscribe();
        resolve();
      }, 1000);
    })();
  });
};

// ============================================================================
// Example 7: man 페이지 TUI 테스트
// ============================================================================
const example7_manTui = async () => {
  log("Example 7", "man 페이지 TUI 테스트");

  const spawn = Spawn2.spawn("man", ["ls"], {
    enableTui: true,
    cols: 80,
    rows: 24,
  });

  return new Promise<void>((resolve) => {
    const subscription = spawn.subscribe(
      (_data) => {
        // man 출력은 xterm 버퍼를 통해 처리
      },
      (err) => {
        error(`에러: ${err.message}`);
        resolve();
      },
      () => {
        success("man 페이지 TUI 완료");
        resolve();
      },
    );

    (async () => {
      // man 페이지 로딩 대기
      await Bun.sleep(1000);

      // 첫 화면 캡처
      try {
        const buffer1 = spawn.captureBuffer();
        console.log(`  ${colors.green}첫 화면 (라인 0-5):${colors.reset}`);
        buffer1.slice(0, 5).forEach((line, i) => {
          const trimmed = line.trim();
          if (trimmed) {
            console.log(`    [${i}] ${trimmed.substring(0, 60)}...`);
          }
        });
      } catch (err) {
        error(
          `버퍼 캡처 실패: ${err instanceof Error ? err.message : String(err)}`,
        );
      }

      // /SYNOPSIS 검색
      console.log(`  ${colors.dim}검색: /SYNOPSIS${colors.reset}`);
      await spawn.write("/SYNOPSIS\n");
      await Bun.sleep(800);

      // 검색 후 화면 캡처
      try {
        const buffer2 = spawn.captureBuffer();
        console.log(`  ${colors.green}검색 후 화면 (라인 0-5):${colors.reset}`);
        buffer2.slice(0, 5).forEach((line, i) => {
          const trimmed = line.trim();
          if (trimmed) {
            console.log(`    [${i}] ${trimmed.substring(0, 60)}...`);
          }
        });
      } catch (err) {
        error(
          `버퍼 캡처 실패: ${err instanceof Error ? err.message : String(err)}`,
        );
      }

      // 종료
      console.log(`  ${colors.dim}종료 (q)${colors.reset}`);
      await spawn.write("q");
      await Bun.sleep(500);

      subscription.unsubscribe();
      resolve();
    })();
  });
};

// ============================================================================
// Example 8: 터미널 리사이즈
// ============================================================================
const example8_resize = async () => {
  log("Example 8", "터미널 리사이즈");

  const spawn = Spawn2.spawn("echo", ["Resize test"], {
    enableTui: true,
    cols: 80,
    rows: 24,
  });

  return new Promise<void>((resolve) => {
    spawn.subscribe(
      (_data) => {
        // 리사이즈 테스트
      },
      (err) => {
        error(`에러: ${err.message}`);
        resolve();
      },
      () => {
        try {
          console.log(`  ${colors.dim}리사이즈 전: 80x24${colors.reset}`);
          spawn.resize(120, 40);
          console.log(`  ${colors.dim}리사이즈 후: 120x40${colors.reset}`);
          const terminal = spawn.getTerminal();
          if (terminal) {
            console.log(
              `  ${colors.green}터미널 크기:${colors.reset} ${terminal.cols}x${terminal.rows}`,
            );
          }
          success("터미널 리사이즈 완료");
        } catch (err) {
          error(
            `리사이즈 에러: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
        resolve();
      },
    );
  });
};

// ============================================================================
// Example 9: 에러 핸들링 (exit code !== 0)
// ============================================================================
const example9_errorHandling = async () => {
  log("Example 9", "에러 핸들링 (exit code !== 0)");

  try {
    await Spawn2.spawnPromise("cat", ["/nonexistent/file.txt"]);
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
// Example 10: 프로세스 Detach
// ============================================================================
const example10_detach = async () => {
  log("Example 10", "프로세스 Detach");

  const spawn = Spawn2.spawn("sleep", ["2"]);

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

    console.log(`  ${colors.dim}프로세스 정리 중...${colors.reset}`);
    try {
      subprocess.kill("SIGTERM");
    } catch (_err) {
      // Ignore errors
    }
  }

  success("Detach 완료");
};

// ============================================================================
// Example 11: top 같은 인터랙티브 프로그램 (q로 종료)
// ============================================================================
const example11_topInteractive = async () => {
  log("Example 11", "top 인터랙티브 프로그램 (q로 종료)");

  const topInput = async function* () {
    // 1초 후 'q' 전송
    await new Promise((resolve) => setTimeout(resolve, 1000));
    yield "q";
  };

  const spawn = Spawn2.spawn("top", ["-l", "3"], {
    stdin: topInput(),
    enableTui: true,
  });

  return new Promise<void>((resolve) => {
    const timeout = setTimeout(() => {
      error("Timeout - top이 종료되지 않음");
      spawn.detach()?.kill("SIGTERM");
      resolve();
    }, 5000);

    spawn.subscribe(
      (_data) => {
        // top 출력 무시
      },
      (err) => {
        clearTimeout(timeout);
        error(`에러: ${err.message}`);
        resolve();
      },
      () => {
        clearTimeout(timeout);
        success("top이 'q' 입력으로 정상 종료됨 (EOF 없이)");
        resolve();
      },
    );
  });
};

// ============================================================================
// Main Runner
// ============================================================================
const main = async () => {
  const args = Bun.argv.slice(2);

  if (args.includes("--help") || args.includes("-h")) {
    console.log(`
${colors.bright}${colors.cyan}Spawn2.ts 예제 실행기${colors.reset}

${colors.yellow}사용법:${colors.reset}
  bun run spawn2.example.ts [예제번호] [--help]

${colors.yellow}옵션:${colors.reset}
  --help, -h    도움말 표시

${colors.yellow}예제 번호:${colors.reset}
  1   기본 PTY 모드
  2   Promise 패턴
  3   stdin 입력
  4   동적 stdin 입력 (write 메서드)
  5   TUI 모드 활성화 (xterm/headless)
  6   vi 같은 TUI 에디터 (xterm 통합)
  7   man 페이지 TUI 테스트
  8   터미널 리사이즈
  9   에러 핸들링 (exit code !== 0)
  10  프로세스 Detach
  11  top 인터랙티브 프로그램 (q로 종료)

${colors.yellow}예시:${colors.reset}
  bun run spawn2.example.ts          # 모든 예제 실행
  bun run spawn2.example.ts 7        # 7번 예제만 실행
  bun run spawn2.example.ts --help   # 도움말 표시
`);
    return;
  }

  console.log(
    `\n${colors.bright}${colors.magenta}═══════════════════════════════════════════════════════════${colors.reset}`,
  );
  console.log(
    `${colors.bright}${colors.magenta}  Spawn2.ts 사용 예제 모음 (bun-pty + xterm/headless)${colors.reset}`,
  );
  console.log(
    `${colors.bright}${colors.magenta}═══════════════════════════════════════════════════════════${colors.reset}\n`,
  );

  const examples = [
    example1_basicPty,
    example2_promisePattern,
    example3_stdinInput,
    example4_dynamicStdin,
    example5_tuiMode,
    example6_viTui,
    example7_manTui,
    example8_resize,
    example9_errorHandling,
    example10_detach,
    example11_topInteractive,
  ];

  // 특정 예제 실행
  if (args.length > 0 && args[0] && /^\d+$/.test(args[0])) {
    const exampleIndex = parseInt(args[0], 10) - 1;
    if (exampleIndex >= 0 && exampleIndex < examples.length) {
      console.log(
        `\n${colors.bright}${colors.magenta}═══════════════════════════════════════════════════════════${colors.reset}`,
      );
      console.log(
        `${colors.bright}${colors.magenta}  Spawn2.ts 예제 ${args[0]} 실행${colors.reset}`,
      );
      console.log(
        `${colors.bright}${colors.magenta}═══════════════════════════════════════════════════════════${colors.reset}\n`,
      );

      try {
        await examples[exampleIndex]!();
      } catch (err) {
        error(
          `예제 실행 중 에러: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
      separator();
      console.log(
        `${colors.bright}${colors.green}예제 ${args[0]} 실행 완료!${colors.reset}\n`,
      );
      return;
    } else {
      error(
        `잘못된 예제 번호: ${args[0]}. 1-${examples.length} 사이의 번호를 입력하세요.`,
      );
      return;
    }
  }

  for (const example of examples) {
    try {
      await example();
    } catch (err) {
      error(
        `예제 실행 중 에러: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
    separator();
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  console.log(
    `${colors.bright}${colors.green}모든 예제 실행 완료!${colors.reset}\n`,
  );
};

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});

