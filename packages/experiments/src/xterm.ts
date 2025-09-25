import { appendFile } from "node:fs/promises";
import { Terminal } from "@xterm/headless";
import { spawn } from "bun-pty";
import type { IPty } from "bun-pty";

/**
 * 로그 파일에 기록하는 헬퍼 함수
 */
const logToFile = async (filePath: string, message: string) => {
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] ${message}\n`;
  await appendFile(filePath, logEntry);
};

/**
 * TUI 앱 (man) 테스트: xterm.js와 터미널 크기 맞춤, 검색 지원 체크
 */
const testTuiMan = async () => {
  const logFile = "xterm.tui.log";

  // 로그 파일 초기화
  await Bun.write(Bun.file(logFile), "");

  await logToFile(logFile, "=== Starting TUI Man Test ===");

  // xterm.js 터미널 생성
  const xterm = new Terminal({ cols: 80, rows: 24, allowProposedApi: true });

  // bun-pty로 man ls 실행 (PTY 지원)
  const pty: IPty = spawn("man", ["ls"], {
    name: "xterm-256color",
    cols: 80,
    rows: 24,
    env: process.env as Record<string, string>,
  });

  await logToFile(logFile, "man ls started with bun-pty (cols=80 rows=24)");

  // onData로 출력 캡처
  pty.onData((data: string) => {
    xterm.write(data);
  });

  // 초기 출력 대기
  await new Promise((resolve) => setTimeout(resolve, 2000));

  // 첫 화면 캡처
  const captureScreen = (label: string): string => {
    const buffer = xterm.buffer.active;
    let screenText = `${label}\n`;
    for (let i = 0; i < Math.min(buffer.length, 24); i++) {
      const line = buffer.getLine(i);
      if (line) {
        screenText += line.translateToString() + "\n";
      }
    }
    return screenText;
  };

  const initialScreen = captureScreen("Initial Screen:");
  await logToFile(logFile, initialScreen);

  // /SYNOPSIS 검색 입력
  await logToFile(logFile, "Sending /SYNOPSIS for search");
  pty.write("/SYNOPSIS\n");
  await new Promise((resolve) => setTimeout(resolve, 1000));

  // 검색 후 화면 캡처
  const searchedScreen = captureScreen("After /SYNOPSIS search:");
  await logToFile(logFile, searchedScreen);

  // q 입력으로 종료
  await logToFile(logFile, "Sending 'q' to exit");
  pty.write("q\n");

  // onExit로 종료 대기
  await new Promise((resolve) => {
    pty.onExit(({ exitCode, signal }) => {
      logToFile(
        logFile,
        `Process ended with exit code: ${exitCode}, signal: ${signal}`,
      );
      resolve(void 0);
    });
  });

  await logToFile(logFile, "=== TUI Man Test Ended ===");
};

// 실행
if (import.meta.main) {
  testTuiMan().catch(console.error);
}

export { testTuiMan };
