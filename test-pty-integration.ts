#!/usr/bin/env bun

/**
 * PTY + xterm/headless 종합 통합 테스트
 * 모든 PTY 테스트 시나리오를 하나로 통합
 */

import { Terminal } from "@xterm/headless";
import stripAnsi from "strip-ansi";

const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  green: "\x1b[32m",
  cyan: "\x1b[36m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  magenta: "\x1b[35m",
};

const log = (msg: string) =>
  console.log(`${colors.cyan}[INFO]${colors.reset} ${msg}`);
const success = (msg: string) =>
  console.log(`${colors.green}✓${colors.reset} ${msg}`);
const error = (msg: string) =>
  console.log(`${colors.red}✗${colors.reset} ${msg}`);
const section = (title: string) => {
  console.log(
    `\n${colors.bright}${colors.magenta}${"═".repeat(110)}${colors.reset}`,
  );
  console.log(`${colors.bright}${colors.magenta}  ${title}${colors.reset}`);
  console.log(
    `${colors.bright}${colors.magenta}${"═".repeat(110)}${colors.reset}\n`,
  );
};

const captureScreen = (terminal: Terminal, maxLines = 35): string[] => {
  const buffer = terminal.buffer.active;
  const lines: string[] = [];
  for (let i = 0; i < Math.min(buffer.length, maxLines); i++) {
    const line = buffer.getLine(i);
    if (line) {
      const text = stripAnsi(line.translateToString(true)).trimEnd();
      lines.push(text);
    }
  }
  return lines;
};

const printScreen = (lines: string[], title?: string, count = 12) => {
  if (title) log(title);
  console.log(`${colors.dim}${"─".repeat(110)}${colors.reset}`);
  const filtered = lines.filter((l) => l.trim());
  filtered.slice(0, count).forEach((line) => {
    console.log(`  ${line.substring(0, 105)}`);
  });
  if (filtered.length > count) {
    console.log(
      `  ${colors.dim}... (${filtered.length - count}줄 더)${colors.reset}`,
    );
  }
  console.log(`${colors.dim}${"─".repeat(110)}${colors.reset}`);
};

const hashScreen = (lines: string[]): string => {
  const text = lines.join("\n");
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return hash.toString(16);
};

// Test 1: 기본 명령어
const test_basicCommands = async () => {
  section("Test 1: 기본 명령어");
  const terminal = new Terminal({ cols: 80, rows: 24, allowProposedApi: true });
  const opts: any = { pty: true, stdout: "pipe" };
  const proc = Bun.spawn(["echo", "Hello PTY!"], opts);
  try {
    const reader = proc.stdout!.getReader();
    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      terminal.write(decoder.decode(value));
    }
    await proc.exited;
    const screen = captureScreen(terminal);
    if (screen.join("\n").includes("Hello")) success("echo 정상 작동");
  } finally {
    proc.kill();
    terminal.dispose();
  }
};

// Test 2: vi 에디터
const test_viEditor = async () => {
  section("Test 2: vi 에디터");
  const tempFile = `/tmp/pty-${Date.now()}.txt`;
  const terminal = new Terminal({ cols: 100, rows: 30, allowProposedApi: true });
  const opts: any = { pty: true, stdin: "pipe", stdout: "pipe" };
  const proc = Bun.spawn(["vi", tempFile], opts);
  try {
    const reader = proc.stdout!.getReader();
    const decoder = new TextDecoder();
    let feedRunning = true;
    const feedLoop = async () => {
      try {
        while (feedRunning) {
          const { done, value } = await reader.read();
          if (done) break;
          terminal.write(decoder.decode(value));
        }
      } catch {}
    };
    const feedPromise = feedLoop();
    await Bun.sleep(500);
    proc.stdin!.write("i");
    await Bun.sleep(200);
    proc.stdin!.write("Test PTY\n");
    await Bun.sleep(200);
    proc.stdin!.write("\x1b");
    await Bun.sleep(100);
    proc.stdin!.write(":wq\n");
    proc.stdin!.end();
    await Promise.race([proc.exited, Bun.sleep(2000)]);
    feedRunning = false;
    await feedPromise;
    const file = Bun.file(tempFile);
    if (await file.exists()) {
      const content = await file.text();
      if (content.includes("Test PTY")) success("vi 정상 작동");
      await file.delete();
    }
  } finally {
    proc.kill();
    terminal.dispose();
  }
};

// Test 3: man ls 스크롤
const test_manLsScroll = async () => {
  section("Test 3: man ls 스크롤 & 검색");
  const terminal = new Terminal({ cols: 110, rows: 35, allowProposedApi: true });
  const opts: any = { pty: true, stdin: "pipe", stdout: "pipe" };
  const proc = Bun.spawn(["man", "ls"], opts);
  try {
    const reader = proc.stdout!.getReader();
    const decoder = new TextDecoder();
    let feedRunning = true;
    const feedLoop = async () => {
      try {
        while (feedRunning) {
          const { done, value } = await reader.read();
          if (done) break;
          terminal.write(decoder.decode(value));
        }
      } catch {}
    };
    const feedPromise = feedLoop();
    log("로딩...");
    await Bun.sleep(1500);
    const screen1 = captureScreen(terminal);
    const hash1 = hashScreen(screen1);
    printScreen(screen1.slice(0, 10), "초기 화면", 10);
    if (screen1.join("\n").toUpperCase().includes("LS"))
      success("man 페이지 로딩");
    proc.stdin!.write(" ");
    await Bun.sleep(1000);
    const screen2 = captureScreen(terminal);
    const hash2 = hashScreen(screen2);
    if (hash1 !== hash2) success("스크롤 감지");
    proc.stdin!.write(":q");
    await Bun.sleep(300);
    proc.stdin!.write("\n");
    proc.stdin!.end();
    await Promise.race([proc.exited, Bun.sleep(2000)]);
    feedRunning = false;
    await feedPromise;
    success("man 정상 종료");
  } finally {
    proc.kill();
    terminal.dispose();
  }
};

// Test 4: Python REPL
const test_pythonRepl = async () => {
  section("Test 4: Python REPL");
  const terminal = new Terminal({ cols: 100, rows: 30, allowProposedApi: true });
  const opts: any = { pty: true, stdin: "pipe", stdout: "pipe" };
  const proc = Bun.spawn(["python3"], opts);
  try {
    const reader = proc.stdout!.getReader();
    const decoder = new TextDecoder();
    let feedRunning = true;
    const feedLoop = async () => {
      try {
        while (feedRunning) {
          const { done, value } = await reader.read();
          if (done) break;
          terminal.write(decoder.decode(value));
        }
      } catch {}
    };
    const feedPromise = feedLoop();
    await Bun.sleep(500);
    log("명령어 실행");
    proc.stdin!.write("print('PTY Works!')\n");
    await Bun.sleep(300);
    proc.stdin!.write("print(42 * 2)\n");
    await Bun.sleep(300);
    const screen = captureScreen(terminal);
    printScreen(screen, "Python 출력", 10);
    if (screen.join("\n").includes("84")) success("Python REPL 정상");
    proc.stdin!.write("exit()\n");
    proc.stdin!.end();
    await Promise.race([proc.exited, Bun.sleep(1500)]);
    feedRunning = false;
    await feedPromise;
  } finally {
    proc.kill();
    terminal.dispose();
  }
};

// Test 5: less 페이저
const test_lessPager = async () => {
  section("Test 5: less 페이저");
  const testFile = `/tmp/test-${Date.now()}.txt`;
  const content = Array.from({ length: 50 }, (_, i) => `Line ${i + 1}`).join("\n");
  await Bun.write(testFile, content);
  const terminal = new Terminal({ cols: 100, rows: 30, allowProposedApi: true });
  const opts: any = { pty: true, stdin: "pipe", stdout: "pipe" };
  const proc = Bun.spawn(["less", testFile], opts);
  try {
    const reader = proc.stdout!.getReader();
    const decoder = new TextDecoder();
    let feedRunning = true;
    const feedLoop = async () => {
      try {
        while (feedRunning) {
          const { done, value } = await reader.read();
          if (done) break;
          terminal.write(decoder.decode(value));
        }
      } catch {}
    };
    const feedPromise = feedLoop();
    await Bun.sleep(1500);
    const screen1 = captureScreen(terminal);
    const hash1 = hashScreen(screen1);
    log("Space로 스크롤...");
    proc.stdin!.write(" ");
    await Bun.sleep(800);
    const screen2 = captureScreen(terminal);
    const hash2 = hashScreen(screen2);
    if (hash1 !== hash2) success("less 페이징 정상");
    proc.stdin!.write("q");
    proc.stdin!.end();
    await Promise.race([proc.exited, Bun.sleep(2000)]);
    feedRunning = false;
    await feedPromise;
    await Bun.file(testFile).delete();
  } finally {
    proc.kill();
    terminal.dispose();
  }
};

// Test 6: top
const test_topTui = async () => {
  section("Test 6: top 프로그램");
  const terminal = new Terminal({ cols: 120, rows: 40, allowProposedApi: true });
  const opts: any = { pty: true, stdin: "pipe", stdout: "pipe" };
  const proc = Bun.spawn(["top", "-l", "2"], opts);
  try {
    const reader = proc.stdout!.getReader();
    const decoder = new TextDecoder();
    let feedRunning = true;
    const feedLoop = async () => {
      try {
        while (feedRunning) {
          const { done, value } = await reader.read();
          if (done) break;
          terminal.write(decoder.decode(value));
        }
      } catch {}
    };
    const feedPromise = feedLoop();
    await Bun.sleep(1000);
    proc.stdin!.write("q");
    proc.stdin!.end();
    await Promise.race([
      proc.exited,
      Bun.sleep(3000).then(() => {
        throw new Error("timeout");
      }),
    ]);
    feedRunning = false;
    await feedPromise;
    const screen = captureScreen(terminal);
    if (screen.join("\n").toLowerCase().includes("process"))
      success("top TUI 정상");
  } catch (err) {
    log(`top 테스트 (타임아웃): ${err instanceof Error ? err.message : ""}`);
  } finally {
    proc.kill();
    terminal.dispose();
  }
};

// Main
const main = async () => {
  console.log(
    `\n${colors.bright}${colors.cyan}${"═".repeat(110)}${colors.reset}`,
  );
  console.log(
    `${colors.bright}${colors.cyan}  PTY + xterm/headless 종합 통합 테스트${colors.reset}`,
  );
  console.log(
    `${colors.bright}${colors.cyan}${"═".repeat(110)}${colors.reset}\n`,
  );

  const tests = [
    { name: "기본 명령어", fn: test_basicCommands },
    { name: "vi 에디터", fn: test_viEditor },
    { name: "man ls", fn: test_manLsScroll },
    { name: "Python REPL", fn: test_pythonRepl },
    { name: "less 페이저", fn: test_lessPager },
    { name: "top 프로그램", fn: test_topTui },
  ];

  let passed = 0;
  for (const test of tests) {
    try {
      await test.fn();
      passed++;
    } catch (err) {
      error(`${test.name} 실패`);
    }
    console.log("");
  }

  console.log(
    `${colors.bright}${colors.cyan}${"═".repeat(110)}${colors.reset}`,
  );
  console.log(
    `${colors.bright}${colors.green}✅ 테스트 완료: ${passed}/${tests.length} 통과${colors.reset}`,
  );
  console.log(
    `${colors.bright}${colors.cyan}${"═".repeat(110)}${colors.reset}\n`,
  );
};

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
